import { Router, type Request, type Response } from "express";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import path from "path";
import { sessionStore } from "../lib/session-store";
import { SDKReportAgent } from "../lib/sdk-agent";
import "../lib/humanize-util"; // kept for the /humanize route
import { fillDocxTemplate, FILLED_DOCX_NAME } from "../lib/docx-template-fill";
import { checkSectionAccess } from "../lib/plan-guard";
import { recordAction } from "../lib/abuse-guard";
import { sendErrorAlert } from "../lib/email";
import { logger } from "../lib/logger";

const router = Router();
const ANTHROPIC_API = "https://api.anthropic.com/v1/messages";

// Partie I/II are generated SECTION BY SECTION (one subsection per turn, humanized
// incrementally), not in one 29-min shot.
const PARTIE_SECTIONS = new Set(["partie-i", "partie-ii"]);

// ─── Section → Zustand key mapping ───────────────────────────────────────────

const ZUSTAND_KEY: Record<string, string> = {
  "page-de-garde":  "pageDeGarde",
  "dedicaces":      "dedicaces",
  "remerciements":  "remerciements",
  "resume":         "resumeFr",
  "abstract":       "abstractEn",
  "sommaire":       "sommaire",
  "introduction":   "introduction",
  "partie-i":       "partieI",
  "partie-ii":      "partieII",
  "conclusion":     "conclusion",
  "bibliographie":  "bibliographie",
  "abbreviations":  "abreviations",
  "liste-figures":  "listeDesFigures",
  "liste-tableaux": "listeDesTableaux",
};

// ─── Section id normalization ─────────────────────────────────────────────────
// The coordinator is an LLM and sometimes emits non-canonical section ids like
// "[introduction-generale]", "introduction générale", "partie 1", "résumé".
// Without this, the writer never produces "<bogus-id>.md" and the user hits
// "Le fichier X.md n'a pas été écrit". Map every reasonable variant to a real id.

const CANONICAL_SECTIONS = new Set<string>([
  "page-de-garde", "sommaire", "dedicaces", "remerciements", "resume", "abstract",
  "introduction", "partie-i", "partie-ii", "conclusion", "bibliographie",
  "abbreviations", "annexes", "liste-figures", "liste-tableaux",
]);

const SECTION_ALIASES: Record<string, string> = {
  // introduction / conclusion (the "-generale" suffix the LLM loves to add)
  "introduction-generale": "introduction", "intro": "introduction",
  "conclusion-generale": "conclusion", "conclusion-generale-et-perspectives": "conclusion",
  // parties (digits, words, ordinals)
  "partie-1": "partie-i", "partie1": "partie-i", "partie-une": "partie-i",
  "premiere-partie": "partie-i", "1ere-partie": "partie-i", "chapitre-1": "partie-i",
  "partie-2": "partie-ii", "partie2": "partie-ii", "partie-deux": "partie-ii",
  "deuxieme-partie": "partie-ii", "2eme-partie": "partie-ii", "chapitre-2": "partie-ii",
  // front matter
  "page-garde": "page-de-garde", "garde": "page-de-garde", "couverture": "page-de-garde",
  "table-des-matieres": "sommaire", "plan": "sommaire", "table-of-contents": "sommaire",
  "dedicace": "dedicaces", "remerciement": "remerciements",
  "resume-francais": "resume", "abstract-anglais": "abstract", "summary": "abstract",
  // back matter
  "references": "bibliographie", "bibliography": "bibliographie", "references-bibliographiques": "bibliographie",
  "abreviations": "abbreviations", "sigles": "abbreviations", "liste-des-abreviations": "abbreviations",
  "annexe": "annexes",
  "liste-des-figures": "liste-figures", "figures": "liste-figures", "table-des-figures": "liste-figures",
  "liste-des-tableaux": "liste-tableaux", "tableaux": "liste-tableaux", "table-des-tableaux": "liste-tableaux",
};

function normalizeSectionId(raw: string): string | null {
  let s = raw
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // strip accents
    .replace(/[[\]"'`()]/g, " ")                        // strip brackets/quotes/parens
    .trim()
    .replace(/[\s_]+/g, "-")                            // spaces/underscores → hyphen
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!s) return null;
  if (CANONICAL_SECTIONS.has(s)) return s;
  if (SECTION_ALIASES[s]) return SECTION_ALIASES[s];
  // last resort: a canonical id appears as a prefix (e.g. "introduction-du-rapport")
  for (const id of CANONICAL_SECTIONS) {
    if (s.startsWith(id)) return id;
  }
  return null;
}

// Normalize + dedupe a list of raw section ids; drop anything unresolvable.
function normalizeSections(raw: string[]): { sections: string[]; dropped: string[] } {
  const sections: string[] = [];
  const dropped: string[] = [];
  for (const r of raw) {
    const id = normalizeSectionId(r);
    if (id && !sections.includes(id)) sections.push(id);
    else if (!id) dropped.push(r);
  }
  return { sections, dropped };
}

// ─── Coordinator system prompts ───────────────────────────────────────────────

const COORDINATOR_SYSTEMS: Record<string, string> = {
  "2": `Tu es RapportAI. Mission : page de garde.
PREMIER MESSAGE : "Salut [prénom] ! On prépare ta page de garde — le premier visuel que ton jury verra. Il me manque juste une chose : le nom de ton encadrant pédagogique ?" (+ encadrant pro et entreprise si PFE/Stage, UNE question à la fois).
Dès que tu as l'encadrant pédago → propose en 1 phrase ce que la page contiendra, et demande "On y va ?".
"génère", "vas-y", "oui", "réessaie", "continue", "peu importe" → génère avec ce que tu as.
Si l'étudiant joint un modèle (PDF/DOCX) : il sert à EXTRAIRE les informations (noms, titres, mentions) et l'ordre des éléments — ne promets JAMAIS de reproduire son style visuel (polices, couleurs, logos) : la mise en page suit le format standard RapportAI, personnalisable à l'export Word.`,

  "3": `Tu es RapportAI. Mission : dédicaces et remerciements.
PREMIER MESSAGE : salue [prénom] chaleureusement, puis ACTION: ask_user avec QUESTION: "Pour tes dédicaces et remerciements, tu préfères :" et CHOICES: [Style classique — je m'occupe de tout | Je veux les personnaliser]
- "Style classique" → génère immédiatement (famille, encadrants, corps professoral).
- "Je veux les personnaliser" → pose UNE SEULE question : "Qui veux-tu remercier (noms + rôles), et veux-tu suivre un style ou un exemple précis ?". Dès la réponse, génère.
RÈGLE ANTI-BOUCLE (impérative) : tu ne poses une question de personnalisation qu'UNE SEULE FOIS. Dès que l'étudiant répond QUOI QUE CE SOIT — un clic d'option, des noms, "les mêmes", "comme l'exemple", ou un texte d'exemple collé — tu passes IMMÉDIATEMENT à ACTION: generate. Tu ne redemandes JAMAIS de précisions, tu ne reformules JAMAIS la même question. Utilise le profil (encadrants, école, entreprise) + sa réponse, et pour tout nom manquant garde un placeholder clair entre crochets.
Si l'étudiant colle un EXEMPLE de remerciements ou de style : mets-le INTÉGRALEMENT dans CONTEXT et demande à la génération de s'en inspirer (ton, structure, longueur) en réutilisant les vrais noms et faits du profil.
"peu importe", "génère", "continue", "réessaie", "les mêmes", "comme l'exemple" → génère immédiatement.
RÉGÉNÉRATION CIBLÉE : si l'étudiant demande de régénérer (ou modifier) UNIQUEMENT les remerciements → SECTIONS: remerciements seulement. UNIQUEMENT les dédicaces → SECTIONS: dedicaces seulement. Ne régénère PAS l'autre section s'il n'en parle pas.
Sinon (première génération ou "les deux") → SECTIONS: dedicaces,remerciements.`,

  "4": `Tu es RapportAI. Mission : résumé français + abstract anglais.
Tu as tout dans le profil — ne pose AUCUNE question ouverte.
PREMIER MESSAGE : salue [prénom], annonce en 1 phrase le plan ("un résumé d'une page en français + son Abstract en anglais"), puis ACTION: ask_user avec QUESTION: "Pour les mots-clés du résumé, tu préfères :" et CHOICES: [L'IA les choisit pour moi | Je veux les préciser moi-même]
- "L'IA les choisit pour moi" (ou "génère", "peu importe", "réessaie") → génère IMMÉDIATEMENT les deux sections.
- "Je veux les préciser moi-même" → demande ses mots-clés, puis génère dès sa réponse.
Le résumé (resume) est un TEXTE CONTINU en FRANÇAIS (350-450 mots), sans titres internes, terminé par "Mots-clés : ...".
L'abstract est la traduction FIDÈLE en ANGLAIS du résumé (même longueur, même structure), terminé par "Keywords: ...". L'abstract doit être entièrement en anglais — pas un seul mot en français.
SECTIONS: resume,abstract`,

  "5": `Tu es RapportAI. Mission : générer le sommaire complet du rapport.
PREMIER MESSAGE — PLAN D'ABORD, ne génère PAS encore :
Salue [prénom], puis propose dans le chat un mini-plan adapté à son thème :
"Voici ce que je propose pour structurer ton rapport :
— Partie I (théorique) : [titre proposé contextualisé] — 2 chapitres
— Partie II (empirique) : [titre proposé contextualisé] — 2 chapitres"
Puis ACTION: ask_user avec QUESTION: "Cette structure te convient ?" et CHOICES: [Parfait, génère le sommaire | Je veux 3 chapitres par partie | Je veux modifier les titres]
- Validation (ou "génère", "vas-y", "ok") → génère le sommaire complet avec ce plan.
- Modification demandée → intègre, reconfirme en 1 phrase, puis génère.

FORMAT OBLIGATOIRE pour le CONTEXT (titres en markdown #/##/###/#### — JAMAIS de texte générique comme "Chapitre 1") :
# Remerciements
# Liste des abréviations
# Liste des tableaux et figures
# Introduction générale
## Partie I — [Titre théorique contextualisé au thème]
### Chapitre 1 : [Titre spécifique]
#### Section 1.1 : [Titre]
#### Section 1.2 : [Titre]
### Chapitre 2 : [Titre spécifique]
#### Section 2.1 : [Titre]
#### Section 2.2 : [Titre]
## Partie II — [Titre empirique/appliqué contextualisé]
### Chapitre 1 : [Titre spécifique]
#### Section 1.1 : [Titre]
#### Section 1.2 : [Titre]
### Chapitre 2 : [Titre spécifique]
#### Section 2.1 : [Titre]
# Conclusion générale
# Bibliographie
# Annexes

Après génération, annonce brièvement ce que tu as créé et propose des ajustements.
"réessaie", "vas-y", "génère", "modifie [X]" → intègre et regénère IMMÉDIATEMENT.`,

  "6": `Tu es RapportAI. Mission : introduction générale.
PREMIER MESSAGE — PLAN D'ABORD, ne génère PAS encore :
Salue [prénom], puis présente le plan de l'introduction en 4 points courts adaptés à son thème :
"Pour ton introduction, voici ce que je prévois : une accroche sur [angle lié au thème], le contexte et les enjeux, ta problématique, puis l'annonce du plan."
Puis ACTION: ask_user avec QUESTION: "Ça te convient ?" et CHOICES: [Génère comme ça | Je veux te donner des précisions d'abord]
- Validation (ou "génère", "vas-y", "ok", "continue", "réessaie") → génère MAINTENANT.
- Précisions → écoute, intègre dans CONTEXT, puis génère.
Ne demande JAMAIS filière, école, nom — ils sont dans le profil.`,

  "9": `Tu es RapportAI. Mission : conclusion, bibliographie, abréviations.
PREMIER MESSAGE : salue [prénom] ("Dernière ligne droite !"), annonce le plan (conclusion + bibliographie + abréviations générées ensemble), puis ACTION: ask_user avec QUESTION: "Pour les apports et limites de ton travail :" et CHOICES: [Déduis-les de mon rapport | Je veux les préciser moi-même]
- "Déduis-les" (ou "génère", "peu importe", "réessaie") → génère tout immédiatement.
- "Je veux les préciser" → demande les 2-3 apports principaux + la limite principale (UNE question), puis génère.
Génère TOUJOURS les trois ensemble : SECTIONS: conclusion,bibliographie,abbreviations`,

  "10": `Tu es RapportAI. Mission : liste des figures.
Section utilitaire — EXCEPTION à la règle du plan : génère IMMÉDIATEMENT sans poser de question.
RESPONSE court et chaleureux ("Je dresse ta liste des figures, [prénom] — une seconde…").
ACTION: generate, SECTIONS: liste-figures`,

  "11": `Tu es RapportAI. Mission : liste des tableaux.
Section utilitaire — EXCEPTION à la règle du plan : génère IMMÉDIATEMENT sans poser de question.
RESPONSE court et chaleureux ("Je dresse ta liste des tableaux, [prénom] — une seconde…").
ACTION: generate, SECTIONS: liste-tableaux`,

  "partie-i": `Tu es RapportAI. Mission : Partie I (cadre théorique), construite SECTION PAR SECTION.
RÈGLE ABSOLUE : tu ne génères QU'UN SEUL identifiant — "partie-i". N'utilise JAMAIS des IDs comme "partie1-chapitre1-*". SECTIONS: partie-i est le SEUL format valide.
FONCTIONNEMENT : à chaque génération, le système rédige la PROCHAINE sous-section du plan (du sommaire), l'humanise, et l'ajoute à l'aperçu. L'étudiant la lit, puis demande la suivante ou une modification. On NE génère JAMAIS toute la Partie I d'un coup.
PREMIER MESSAGE : salue [prénom], rappelle le plan ("Partie I : [titre], [N] chapitres"), et explique le principe : "On construit ta Partie I section par section : je rédige une section, tu la valides dans l'aperçu, puis on passe à la suivante. Chaque section est courte (1-2 min) et déjà humanisée." Puis ACTION: ask_user, QUESTION: "On commence par la première section ?", CHOICES: [Oui, génère la première section | Je veux joindre mes sources PDF | Je veux ajuster le plan]
- "oui", "ok", "vas-y", "génère", "continue", "suivante", "section suivante", "la suivante", "Démarre.", "réessaie" → génère la prochaine section MAINTENANT avec SECTIONS: partie-i. RESPONSE court : "Je rédige la prochaine section, une minute…".
- Après CHAQUE section, invite à continuer. RESPONSE du type : "Section ajoutée à l'aperçu. Dis 'continue' pour la suivante, ou demande-moi de la modifier."
- Modification d'une section précise → ACTION: generate, SECTIONS: partie-i, CONTEXT: SURGICAL_EDIT: [description exacte].
- "joindre mes sources" → ACTION: chat : "Parfait — joins tes PDF ici, je les lirai. Dis 'continue' quand tu es prêt."
- Si le système répond que "la Partie I est complète", félicite l'étudiant et propose de passer à la suite.
Si l'étudiant joint un PDF → confirme son contenu en 2 phrases, puis propose de commencer (ACTION: ask_user, CHOICES: [Oui, génère la première section | Je veux joindre un autre fichier]).`,

  "partie-ii": `Tu es RapportAI. Mission : Partie II (cadre empirique/appliqué), construite SECTION PAR SECTION.
RÈGLE ABSOLUE : tu ne génères QU'UN SEUL identifiant — "partie-ii". N'utilise JAMAIS des IDs comme "partie2-chapitre1-*". SECTIONS: partie-ii est le SEUL format valide.
FONCTIONNEMENT : à chaque génération, le système rédige la PROCHAINE sous-section du plan (du sommaire), l'humanise, et l'ajoute à l'aperçu. L'étudiant la lit, puis demande la suivante ou une modification. On NE génère JAMAIS toute la Partie II d'un coup.
PREMIER MESSAGE : salue [prénom], rappelle le plan ("Partie II : [titre], [N] chapitres"), et explique le principe : "On construit ta Partie II section par section : je rédige une section, tu la valides dans l'aperçu, puis on passe à la suivante. Chaque section est courte (1-2 min) et déjà humanisée." Puis ACTION: ask_user, QUESTION: "On commence par la première section ?", CHOICES: [Oui, génère la première section | Je veux joindre mes sources PDF | Je veux ajuster le plan]
- "oui", "ok", "vas-y", "génère", "continue", "suivante", "section suivante", "la suivante", "Démarre.", "réessaie" → génère la prochaine section MAINTENANT avec SECTIONS: partie-ii. RESPONSE court : "Je rédige la prochaine section, une minute…".
- Après CHAQUE section, invite à continuer. RESPONSE du type : "Section ajoutée à l'aperçu. Dis 'continue' pour la suivante, ou demande-moi de la modifier."
- Modification d'une section précise → ACTION: generate, SECTIONS: partie-ii, CONTEXT: SURGICAL_EDIT: [description exacte].
- "joindre mes sources" → ACTION: chat : "Parfait — joins tes PDF ici, je les lirai. Dis 'continue' quand tu es prêt."
- Si le système répond que "la Partie II est complète", félicite l'étudiant et propose de passer à la suite.
Si l'étudiant joint un PDF → confirme son contenu en 2 phrases, puis propose de commencer (ACTION: ask_user, CHOICES: [Oui, génère la première section | Je veux joindre un autre fichier]).`,
};

// ─── Build coordinator system prompt ─────────────────────────────────────────

function buildCoordinatorSystem(step: string, profile: Record<string, unknown>): string {
  const stepSystem = COORDINATOR_SYSTEMS[step] ?? "Tu es l'assistant de RapportAI. Aide l'étudiant en français.";
  const hasTheme = !!(profile.theme && typeof profile.theme === "string" && profile.theme.trim() && profile.theme.trim() !== "Rapport académique");

  const sommaireLine = typeof profile.sommaire === "string" && profile.sommaire.trim()
    ? `\nSommaire approuvé (extrait) :\n${profile.sommaire.slice(0, 1500)}`
    : "";
  const partieILine = typeof profile.partieITitle === "string" && profile.partieITitle
    ? `\n- Titre Partie I : ${profile.partieITitle} (${profile.partieIChapters ?? 2} chapitres)`
    : "";
  const partieIILine = typeof profile.partieIITitle === "string" && profile.partieIITitle
    ? `\n- Titre Partie II : ${profile.partieIITitle} (${profile.partieIIChapters ?? 2} chapitres)`
    : "";

  return `${stepSystem}

━━━ PROFIL ÉTUDIANT (DÉJÀ CONNU — NE PAS RE-DEMANDER) ━━━
- Nom : ${typeof profile.studentName === "string" ? profile.studentName.replace(/\b\w/g, (c) => c.toUpperCase()) : ""}
- École : ${profile.school ?? ""}
- Filière : ${profile.filiere ?? ""}
- Type : ${profile.reportType ?? ""}
- Thème : ${hasTheme ? profile.theme : "(non renseigné — demande si nécessaire)"}
- Problématique : ${typeof profile.problematique === "string" && profile.problematique.trim() ? profile.problematique : "(non renseignée)"}
- Année : ${profile.academicYear ?? ""}
${typeof profile.pendingContextInjection === "string" && profile.pendingContextInjection.trim() ? `\n━━━ CONTEXTE TRANSMIS PAR L'ASSISTANT DU DASHBOARD (à intégrer dans la génération) ━━━\n${profile.pendingContextInjection.slice(0, 3000)}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━` : ""}
${profile.encadrantPeda ? `- Encadrant pédagogique : ${profile.encadrantPeda}` : ""}
${profile.encadrantPro ? `- Encadrant professionnel : ${profile.encadrantPro}` : ""}
${profile.entreprise ? `- Entreprise : ${profile.entreprise}` : ""}
${profile.ville ? `- Ville : ${profile.ville}` : ""}${partieILine}${partieIILine}${sommaireLine}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RÈGLES :
- Réponds toujours en français, naturellement
- Jamais d'emojis ni de symboles Unicode décoratifs
- Ne demande JAMAIS des infos déjà dans le profil ci-dessus
- Les sections générées n'apparaissent PAS dans le chat — elles vont dans l'aperçu à droite
- Si tu vois "✅ Section enregistrée" dans l'historique → la génération a bien eu lieu et le contenu est dans l'aperçu. Ne dis JAMAIS que rien n'a été généré si ce message est présent.
- L'humanisation (anti-détection IA) est appliquée automatiquement après chaque génération — tu n'as pas à l'expliquer sauf si l'étudiant pose la question.
- Si l'étudiant demande si tu peux faire des recherches web ou chercher des sources : réponds que OUI, pendant la génération l'agent recherche automatiquement des sources académiques récentes (2020-2025) via WebSearch et WebFetch, et les cite dans le texte. Ne dis jamais "je n'ai pas accès à internet" — la génération recherche sur le web.
- Tu travailles UNIQUEMENT sur ta mission ci-dessus. Ne mentionne JAMAIS une autre section du rapport (page de garde, sommaire…) sauf si c'est ta mission.
- PREMIER MESSAGE : quand l'étudiant envoie "Démarre.", suis le script PREMIER MESSAGE de ta mission. Ton chaleureux et personnel (utilise son prénom), comme un assistant qui l'accueille — jamais robotique. Présente toujours ton plan AVANT de générer et laisse l'étudiant valider ou ajuster : on ne génère jamais sans son accord au premier message.
- Les raccourcis "génère", "vas-y", "ok", "réessaie" valent TOUJOURS validation immédiate, à tout moment.

ÉDITIONS CHIRURGICALES : Si l'étudiant demande de modifier UN passage spécifique ("change le deuxième paragraphe", "modifie juste la conclusion du chapitre 1") → utilise ACTION: generate avec CONTEXT: SURGICAL_EDIT: [description exacte du changement demandé]. L'agent utilisera Edit (pas Write) pour ne modifier que ce passage.

FORMAT DE RÉPONSE OBLIGATOIRE — respecte EXACTEMENT ce format, rien d'autre :

ACTION: chat
RESPONSE: [ta réponse naturelle]

OU pour déclencher une génération :

ACTION: generate
SECTIONS: [section-id1,section-id2,...] (ex: dedicaces,remerciements)
CONTEXT: [contexte détaillé pour la génération : noms, demandes spécifiques, plan validé...]
RESPONSE: [message court en français annonçant la génération de TA section — jamais une autre]

OU pour poser une question à choix à l'étudiant (2 à 4 options courtes et cliquables) — utilise quand un choix rapide entre des options claires fait avancer la conversation (ex: une préférence de structure, oui/non, un format) :

ACTION: ask_user
QUESTION: [ta question courte, sans emoji]
CHOICES: [option 1 | option 2 | option 3]

OU quand l'étape est terminée après génération :

ACTION: complete
RESPONSE: [message de félicitations court]

Choisis ACTION: complete uniquement si tu viens de confirmer qu'une génération s'est bien passée.
Sinon utilise ACTION: chat.`;
}

// ─── History compression ──────────────────────────────────────────────────────

type ConvTurn = { role: "agent" | "user"; content: string };

function compressHistory(history: ConvTurn[]): ConvTurn[] {
  if (history.length <= 8) return history;
  const head = history.slice(0, 2);
  const tail = history.slice(-6);
  const headSet = new Set(head);
  return [...head, ...tail.filter((t) => !headSet.has(t))];
}

// ─── Parse coordinator response ───────────────────────────────────────────────

function parseCoordinator(raw: string): {
  action: string;
  sections: string[];
  context: string;
  response: string;
  question: string;
  choices: string[];
} {
  const lines = raw.trim().split("\n");
  let action = "chat";
  let sections: string[] = [];
  let context = "";
  let question = "";
  let choices: string[] = [];
  const responseLines: string[] = [];
  let inResponse = false;
  let inContext = false;

  for (const line of lines) {
    if (line.startsWith("ACTION:")) {
      action = line.slice(7).trim().toLowerCase();
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("SECTIONS:")) {
      sections = line.slice(9).trim().split(",").map((s) => s.trim()).filter(Boolean);
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("SECTION:")) {
      sections = line.slice(8).trim().split(",").map((s) => s.trim()).filter(Boolean);
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("CONTEXT:")) {
      context = line.slice(8).trim();
      inContext = true;
      inResponse = false;
    } else if (line.startsWith("QUESTION:")) {
      question = line.slice(9).trim();
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("CHOICES:")) {
      choices = line.slice(8).trim().split("|").map((s) => s.trim()).filter(Boolean);
      inResponse = false;
      inContext = false;
    } else if (line.startsWith("RESPONSE:")) {
      responseLines.push(line.slice(9).trim());
      inResponse = true;
      inContext = false;
    } else if (inResponse) {
      responseLines.push(line);
    } else if (inContext && context) {
      context += "\n" + line;
    }
  }

  return {
    action,
    sections,
    context: context.trim(),
    response: responseLines.join("\n").trim(),
    question: question.trim(),
    choices,
  };
}

// ─── SSE write helper ─────────────────────────────────────────────────────────

function sseWrite(res: Response, data: Record<string, unknown>): void {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
  (res as unknown as { flush?: () => void }).flush?.();
}

// ─── POST /api/agent/:step/stream ─────────────────────────────────────────────

// File content block sent from the client after client-side extraction
type ClientFileContent =
  | { type: "image"; media_type: string; data: string; name: string }
  | { type: "document"; data: string; name: string }
  | { type: "text"; text: string; name: string };

// Build the last user message content — rich array when files are present
function buildLastUserContent(
  message: string,
  fileContents: ClientFileContent[],
): string | Array<Record<string, unknown>> {
  if (fileContents.length === 0) return message || "(message vide)";

  const blocks: Array<Record<string, unknown>> = [];
  for (const fc of fileContents) {
    if (fc.type === "image") {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: fc.media_type, data: fc.data },
      });
    } else if (fc.type === "document") {
      blocks.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: fc.data },
      });
    } else {
      // Plain text (DOCX extracted, TXT, CSV, etc.)
      blocks.push({
        type: "text",
        text: `[Contenu du fichier "${fc.name}"] :\n${fc.text}`,
      });
    }
  }
  blocks.push({ type: "text", text: message || "Lis ce fichier et réponds à ma question." });
  return blocks;
}

router.post("/agent/:step/stream", async (req: Request, res: Response) => {
  const { step } = req.params;
  const {
    message = "",
    history = [],
    sessionId,
    profile = {},
    existingSections = {},
    fileContents = [],
  } = req.body as {
    message?: string;
    history?: ConvTurn[];
    sessionId?: string;
    profile?: Record<string, unknown>;
    existingSections?: Record<string, string>;
    fileContents?: ClientFileContent[];
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    return;
  }

  // ── SSE setup ────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.socket?.setNoDelay(true);
  res.flushHeaders();

  // Patch res.write to flush after every chunk
  const _origWrite = res.write.bind(res) as (...a: unknown[]) => boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res as any).write = (...args: unknown[]): boolean => {
    const r = _origWrite(...args);
    (res as unknown as { flush?: () => void }).flush?.();
    return r;
  };

  try {
    // ── 1. Get agent from session store ────────────────────────────────────
    let agent = sessionStore.get(sessionId ?? "") as SDKReportAgent | undefined;
    if (!agent && sessionId) {
      const revived = SDKReportAgent.reviveFromDisk(sessionId);
      if (revived) {
        agent = revived;
        // Cast is safe: SDKReportAgent extends AgentSession
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionStore.set(agent as any);
      }
    }

    // ── 2. Build coordinator messages ──────────────────────────────────────
    const bounded = compressHistory(history);
    const stepStr = Array.isArray(step) ? step[0] : step;
    const systemPrompt = buildCoordinatorSystem(stepStr, profile);

    const apiMessages: Array<{ role: "user" | "assistant"; content: string | Array<Record<string, unknown>> }> = [];
    for (const turn of bounded) {
      if (!turn.content?.trim()) continue;
      apiMessages.push({
        role: turn.role === "agent" ? "assistant" : "user",
        content: turn.content.slice(0, 2000),
      });
    }
    // Ensure messages alternate (Anthropic requires user/assistant alternation)
    const filteredMessages = apiMessages.filter((m, i) => {
      if (i === 0) return m.role === "user";
      return m.role !== apiMessages[i - 1].role;
    });
    filteredMessages.push({ role: "user", content: buildLastUserContent(message, fileContents) });

    // ── 3. Call coordinator ────────────────────────────────────────────────
    // Sonnet when files are present (needs a stronger model to read/act on them)
    // OR for the substantive content steps. Haiku is unreliable at emitting the
    // "SECTIONS: ..." generate directive — it often narrates ("Sommaire régénéré !")
    // without actually triggering generation, so the section never persists and
    // downstream steps see it as missing. Sonnet follows the directive format.
    // Cheap front-matter steps (page de garde, dédicaces) stay on Haiku.
    const SONNET_STEPS = new Set(["4", "5", "6", "partie-i", "partie-ii"]);
    const useSonnet = fileContents.length > 0 || SONNET_STEPS.has(stepStr);
    const coordModel = useSonnet ? "claude-sonnet-4-6" : "claude-haiku-4-5";
    const coordMaxTokens = useSonnet ? 2048 : 1200;
    const coordRes = await fetch(ANTHROPIC_API, {
      method: "POST",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: coordModel,
        max_tokens: coordMaxTokens,
        system: systemPrompt,
        messages: filteredMessages,
      }),
    });

    if (!coordRes.ok) {
      const errText = await coordRes.text().catch(() => "");
      logger.error({ status: coordRes.status, body: errText }, "coordinator call failed");
      sseWrite(res, { type: "text", content: "Une erreur s'est produite. Réessaie." });
      sseWrite(res, { type: "done" });
      res.end();
      return;
    }

    const coordData = (await coordRes.json()) as { content: Array<{ type: string; text: string }> };
    const rawText = coordData.content.find((b) => b.type === "text")?.text ?? "";
    const { action, sections: rawSections, context, response, question, choices } = parseCoordinator(rawText);

    // Normalize coordinator section ids → canonical ids (handles "[introduction-generale]",
    // "partie 1", "résumé", etc.). Without this the writer never produces the file and the
    // user hits "Le fichier X.md n'a pas été écrit".
    const { sections, dropped } = normalizeSections(rawSections);
    if (dropped.length > 0) {
      logger.warn({ sessionId, dropped, rawSections }, "coordinator emitted unresolvable section ids — dropped");
    }
    if (action === "generate" && rawSections.length > 0 && sections.length === 0) {
      logger.error({ sessionId, rawSections }, "all coordinator sections unresolvable");
      sseWrite(res, { type: "text", content: "Je n'ai pas reconnu la section demandée. Dis-moi laquelle tu veux : introduction, partie I, partie II, conclusion, résumé…" });
      sseWrite(res, { type: "done" });
      res.end();
      return;
    }

    // ── 4. Stream the response text to the frontend ────────────────────────
    if (response) {
      sseWrite(res, { type: "text", content: response });
    } else if (action === "chat" && !response) {
      // Fallback: use raw text as response if parsing failed
      sseWrite(res, { type: "text", content: rawText.slice(0, 1000) });
    }

    // ── ask_user: agent asks a clickable-choices question, then ends ───────
    if (action === "ask_user" && question && choices.length >= 2) {
      sseWrite(res, { type: "ask_user", question, choices });
      sseWrite(res, { type: "done" });
      res.end();
      return;
    }

    // ── 5. If generate action, run the Claude Agent SDK ───────────────────
    if (action === "generate" && sections.length > 0 && !agent && sessionId) {
      // Session lost (server restart) — recreate it transparently with the
      // profile from this request instead of dead-ending the user.
      try {
        const fresh = new SDKReportAgent(sessionId, profile as ConstructorParameters<typeof SDKReportAgent>[1]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionStore.set(fresh as any);
        agent = fresh;
        logger.info({ sessionId }, "session recreated after loss");
      } catch (e) {
        logger.error({ sessionId, err: e }, "session recreation failed");
      }
    }

    if (action === "generate" && sections.length > 0 && !agent) {
      sseWrite(res, {
        type: "text",
        content:
          "Ta session a expiré. Recharge la page et réessaie — tes réponses sont sauvegardées localement.",
      });
      sseWrite(res, { type: "done" });
      res.end();
      return;
    }

    // Surgical edits of existing content count as revisions — enforce the plan limit.
    // Full regenerations stay gated by the page quota instead.
    if (action === "generate" && context.includes("SURGICAL_EDIT")) {
      const revCount = parseInt((req.headers["x-revision-count"] as string) ?? "0", 10);
      const revLimit = req.planRevisions;
      if (isFinite(revLimit) && revCount >= revLimit) {
        sseWrite(res, {
          type: "text",
          content: `Tu as atteint la limite de ${revLimit} révisions de ton plan. Passe au plan supérieur pour continuer à affiner ton rapport.`,
        });
        sseWrite(res, { type: "plan_limit", limit_type: "revisions", planId: req.planId });
        sseWrite(res, { type: "done" });
        res.end();
        return;
      }
    }

    if (action === "generate" && sections.length > 0 && agent) {
      // Memory guard: if the process is already using too much RAM, refuse to spawn
      // the Claude Code subprocess (which needs ~250MB) rather than letting the OS
      // kill the process with exit 134 (SIGABRT / OOM). The server stays alive and
      // the user sees a friendly retry message instead of a dropped connection.
      //
      // The threshold MUST be set below the instance's RAM ceiling or it never
      // fires: a 512MB box OOMs at ~512MB, so a 1600MB threshold is useless.
      // Set MEMORY_GUARD_MB per instance — e.g. 380 on a 512MB box (leaves room
      // for the ~250MB subprocess), ~700 on 1GB. Defaults to 1600 for large hosts.
      const guardMB = parseInt(process.env.MEMORY_GUARD_MB ?? "1600", 10) || 1600;
      const rssMB = Math.round(process.memoryUsage().rss / 1024 / 1024);
      if (rssMB > guardMB) {
        logger.warn({ rssMB, guardMB }, "memory guard triggered — refusing generation to avoid OOM");
        sseWrite(res, {
          type: "text",
          content: "⚠️ Le serveur est sous forte charge en ce moment. Réessaie dans 30 secondes — tes infos sont sauvegardées.",
        });
        sseWrite(res, { type: "done" });
        res.end();
        return;
      }

      // Patch the agent profile with latest data from the frontend
      if (profile && typeof profile === "object") {
        const profileFields: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(profile)) {
          if (typeof v === "string" && v.trim()) profileFields[k] = v;
          else if (typeof v === "number") profileFields[k] = v;
        }
        // formatting is an object — patch it explicitly so it isn't dropped
        if (profile.formatting && typeof profile.formatting === "object") {
          profileFields.formatting = profile.formatting;
        }
        agent.patchProfile(profileFields as Parameters<typeof agent.patchProfile>[0]);
      }

      // Restore section files the frontend still has in its store but that are
      // missing from disk — Render wipes the /tmp workDir on every deploy/restart,
      // so a revived session has profile.json but none of the .md dependencies.
      // Only write files that are absent so we never clobber freshly-generated
      // content with an older copy from the store.
      if (existingSections && typeof existingSections === "object") {
        for (const [id, content] of Object.entries(existingSections)) {
          if (typeof content !== "string" || !content.trim()) continue;
          const p = path.join(agent.workDir, `${id}.md`);
          if (!existsSync(p)) {
            try {
              writeFileSync(p, content, "utf-8");
              logger.info({ sessionId, section: id }, "restored section to disk from store");
            } catch { /* ignore write errors */ }
          }
        }
      }

      // Abstract depends on resume.md — force the résumé to generate first if both
      // are requested, regardless of the order the coordinator emitted them in.
      if (sections.includes("abstract") && sections.includes("resume")) {
        sections.sort((a, b) => (a === "resume" ? -1 : b === "resume" ? 1 : 0));
      }

      // Write generation_context.md so section agents can read it
      if (context) {
        try {
          writeFileSync(
            path.join(agent.workDir, "generation_context.md"),
            `# Contexte de génération\n\n${context}`,
            "utf-8"
          );
        } catch { /* ignore write errors */ }
      }

      // Generate each section sequentially
      for (const sectionId of sections) {
        // Server-side paywall: the coordinator route resolves sections dynamically,
        // so middleware can't gate them — enforce section access here. This is the
        // real backstop; the frontend nav gating is only a convenience and is
        // bypassable. Without this, a free user could generate Partie I/II for free.
        const paywall = checkSectionAccess(req, sectionId);
        if (paywall) {
          sseWrite(res, { type: "text", content: paywall.message });
          sseWrite(res, { type: "plan_limit", limit_type: paywall.limit_type, planId: paywall.planId });
          logger.info({ sessionId, section: sectionId, planId: paywall.planId, required: paywall.requiredPlan }, "section blocked by plan");
          continue;
        }

        const filePath = path.join(agent.workDir, `${sectionId}.md`);

        // Cost abuse guard — holds even during FREE_LAUNCH. Regenerating a section
        // that already exists counts as a "revision" against the daily budget; the
        // first generation of a section is free (only the hidden backstop applies).
        const abuseKey = sessionId
          ?? ((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim())
          ?? req.socket?.remoteAddress ?? "unknown";
        const isRevision = existsSync(filePath) && readFileSync(filePath, "utf-8").trim().length > 50;
        const abuse = recordAction(abuseKey, isRevision);
        if (!abuse.ok) {
          sseWrite(res, { type: "text", content: `⚠️ ${abuse.reason}` });
          sseWrite(res, { type: "usage", revisions: abuse.revisions, revisionLimit: abuse.revisionLimit });
          logger.info({ sessionId, section: sectionId }, "blocked by daily revision cap");
          continue;
        }
        sseWrite(res, { type: "usage", revisions: abuse.revisions, revisionLimit: abuse.revisionLimit });

        sseWrite(res, { type: "tool_call", name: "Write", detail: `${sectionId}.md` });

        // Abstract is generated in-process (direct API call) — it only needs to
        // read resume.md and translate it to English. No subprocess needed.
        if (sectionId === "abstract") {
          const resumePath = path.join(agent.workDir, "resume.md");
          // resume.md is guaranteed on disk here: either generated earlier in this
          // same loop (resume is sorted before abstract), or restored from the
          // frontend store by the existingSections block above.
          let resumeContent = existsSync(resumePath) ? readFileSync(resumePath, "utf-8") : "";
          if (!resumeContent && typeof existingSections.resume === "string" && existingSections.resume.trim()) {
            writeFileSync(resumePath, existingSections.resume, "utf-8");
            resumeContent = existingSections.resume;
          }
          if (!resumeContent) {
            sseWrite(res, { type: "text", content: "Le résumé n'existe pas encore. Génère d'abord le résumé français." });
            continue;
          }
          try {
            const abstractRes = await fetch(ANTHROPIC_API, {
              method: "POST",
              headers: { "anthropic-version": "2023-06-01", "x-api-key": apiKey, "content-type": "application/json" },
              body: JSON.stringify({
                model: "claude-sonnet-4-6",
                max_tokens: 2048,
                system: "You are an academic translator. Translate the given French résumé into natural academic English as an Abstract. Rules: 100% English (not a single French word), same structure and length as the original, adapt phrasing to read natively in English (not word-for-word), no sub-titles or bullet points, continuous prose only. End with 'Keywords: word1, word2, ...' (English equivalents of the French mots-clés). Return only the abstract text, no preamble.",
                messages: [{ role: "user", content: `Translate this French résumé to an English Abstract:\n\n${resumeContent}` }],
              }),
            });
            if (!abstractRes.ok) {
              const errBody = await abstractRes.text().catch(() => "");
              logger.error({ status: abstractRes.status, body: errBody }, "abstract API call failed");
              sseWrite(res, { type: "text", content: "La traduction de l'Abstract a échoué (API). Réessaie dans un instant." });
              continue;
            }
            const abstractData = await abstractRes.json() as { content?: Array<{ type: string; text: string }> };
            const abstractText = abstractData.content?.find((b) => b.type === "text")?.text ?? "";
            if (abstractText.trim()) {
              writeFileSync(filePath, abstractText.trim(), "utf-8");
            }
          } catch (e) {
            logger.error({ err: e }, "abstract generation failed");
            sseWrite(res, { type: "text", content: "La génération de l'Abstract a échoué. Réessaie." });
            continue;
          }
        } else if (PARTIE_SECTIONS.has(sectionId)) {
          // SECTION-BY-SECTION: generate ONE subsection, humanize only it, append.
          // Replaces the 29-min one-shot; the student reviews each section then continues.
          const sectionLabel = sectionId === "partie-i" ? "Partie I" : "Partie II";
          const tempName = `${sectionId}.__section`;
          const tempPath = path.join(agent.workDir, `${tempName}.md`);
          try { if (existsSync(tempPath)) unlinkSync(tempPath); } catch { /* ignore */ }
          const snapshot = existsSync(filePath) ? readFileSync(filePath, "utf-8") : null;
          const crossRef = sectionId === "partie-ii"
            ? "Lis aussi partie-i.md : les références croisées vers la Partie I sont obligatoires.\n"
            : "";
          const sectionTask = `MODE SECTION — génère UNE seule sous-section de la ${sectionLabel}, pas plus.
1. Lis "sommaire.md" : le plan complet (chapitres et sous-sections, ex. 1.1, 1.2, 2.1…).
2. Lis "${sectionId}.md" s'il existe : ce qui a DÉJÀ été rédigé.
3. Dans l'ordre du plan, identifie la PROCHAINE sous-section non encore rédigée.
4. ${crossRef}Si TOUTES les sous-sections du plan sont déjà rédigées dans "${sectionId}.md", écris EXACTEMENT le mot DONE (rien d'autre) dans "${tempName}.md" et arrête-toi.
5. Sinon, rédige le contenu COMPLET de cette seule sous-section : son titre (## ou ###) puis le corps (~400-900 mots), avec recherche de sources réelles et citations (Auteur, année). Écris-le dans "${tempName}.md" avec Write (fichier neuf, une seule sous-section). N'écris RIEN dans "${sectionId}.md".${context ? `\n\nDemande / contexte de l'étudiant : ${context}` : ""}`;
          try {
            for await (const event of agent.streamSection(sectionId, sectionTask)) {
              if (event.type === "tool_call") sseWrite(res, { type: "tool_call", name: event.name, detail: event.detail });
            }
          } catch (genErr) {
            logger.error({ err: genErr, section: sectionId }, "next-section streamSection error");
            void sendErrorAlert({ context: `generate:${sectionId}`, message: genErr instanceof Error ? genErr.message : String(genErr), sessionId, section: sectionId });
            sseWrite(res, { type: "text", content: `La génération de la ${sectionLabel} a échoué. Réessaie.` });
            continue;
          }
          // Restore the section file — only our controlled append may modify it.
          if (snapshot !== null) writeFileSync(filePath, snapshot, "utf-8");
          else if (existsSync(filePath)) { try { unlinkSync(filePath); } catch { /* ignore */ } }

          const rawSection = existsSync(tempPath) ? readFileSync(tempPath, "utf-8").trim() : "";
          if (!rawSection || (/\bDONE\b/i.test(rawSection) && rawSection.length < 50)) {
            try { unlinkSync(tempPath); } catch { /* ignore */ }
            sseWrite(res, { type: "text", content: `La ${sectionLabel} est complète : toutes les sections du plan ont été rédigées et humanisées.` });
            continue;
          }
          // Humanize ONLY this new subsection (small → fast → sub-20%, like the intro).
          sseWrite(res, { type: "tool_call", name: "Humanizing", detail: sectionId });
          {
            const hb = setInterval(() => { try { res.write(`: humanizing\n\n`); } catch { /* closed */ } }, 15000);
            try {
              await agent.humanizeSection(tempName);
            } catch (hErr) {
              logger.warn({ err: hErr, section: sectionId }, "next-section humanize failed — using raw section");
            } finally {
              clearInterval(hb);
            }
          }
          const humanizedSection = (existsSync(tempPath) ? readFileSync(tempPath, "utf-8").trim() : rawSection) || rawSection;
          const existingPartie = snapshot ? snapshot.trim() : "";
          const combinedPartie = existingPartie ? `${existingPartie}\n\n${humanizedSection}` : humanizedSection;
          writeFileSync(filePath, combinedPartie, "utf-8");
          try { unlinkSync(tempPath); } catch { /* ignore */ }
        } else {
          const task = agent.buildSectionTask(sectionId, { extraContext: context || undefined });
          try {
            for await (const event of agent.streamSection(sectionId, task)) {
              if (event.type === "tool_call") {
                sseWrite(res, { type: "tool_call", name: event.name, detail: event.detail });
              }
            }
          } catch (genErr) {
            logger.error({ err: genErr, section: sectionId }, "streamSection error");
            void sendErrorAlert({ context: `generate:${sectionId}`, message: genErr instanceof Error ? genErr.message : String(genErr), sessionId, section: sectionId });
            sseWrite(res, { type: "text", content: `La génération de ${sectionId} a échoué. Réessaie.` });
            continue;
          }
        }

        if (!existsSync(filePath)) {
          void sendErrorAlert({ context: `generate:${sectionId}`, message: "fichier non écrit après génération", sessionId, section: sectionId });
          sseWrite(res, { type: "text", content: `Le fichier ${sectionId}.md n'a pas été écrit. Réessaie.` });
          continue;
        }

        // Humanize via SDK agent (same tool-using agent as generation) so the
        // humanize-skills.md skill runs as designed — with Read/Write/Edit tools
        // to verify and fix its own output iteratively.
        const SKIP_HUMANIZE = new Set([
          "page-de-garde", "sommaire", "bibliographie",
          "abbreviations", "liste-figures", "liste-tableaux",
          "keywords", "problematique", "contexte",
          // abstract is English — the humanizer skill is French (INTERDIT terms,
          // French phrasing rules) and would inject French words / corrupt it.
          "abstract",
        ]);
        if (!SKIP_HUMANIZE.has(sectionId) && !PARTIE_SECTIONS.has(sectionId)) {
          const rawBefore = readFileSync(filePath, "utf-8");
          sseWrite(res, { type: "tool_call", name: "Humanizing", detail: sectionId });
          const hb = setInterval(() => { try { res.write(`: humanizing\n\n`); } catch { /* closed */ } }, 15000);
          try {
            await agent.humanizeSection(sectionId);
          } catch (hErr) {
            logger.warn({ err: hErr, section: sectionId }, "humanize agent failed — using raw content");
          } finally {
            clearInterval(hb);
          }
          const rawAfter = readFileSync(filePath, "utf-8");
          if (rawAfter === rawBefore) {
            logger.warn({ section: sectionId }, "humanize: content unchanged after humanizeSection — check sdk-agent logs");
            sseWrite(res, { type: "text", content: `⚠️ Humanisation : aucun changement détecté pour ${sectionId}. Vérifie les logs Render.` });
          }
        }

        let content = readFileSync(filePath, "utf-8");

        const zustandKey = ZUSTAND_KEY[sectionId];
        if (zustandKey) {
          sseWrite(res, {
            type: "file_written",
            section: sectionId,
            zustand_key: zustandKey,
            content,
          });
        }

        // Page de garde + uploaded .docx template → fill the student's EXACT
        // template (fonts/logo/layout untouched) and offer it for download.
        if (sectionId === "page-de-garde") {
          try {
            const filled = await fillDocxTemplate(
              agent.workDir,
              (profile ?? {}) as Record<string, unknown>,
              context || "",
            );
            if (filled) {
              sseWrite(res, {
                type: "template_filled",
                url: `/api/session/${sessionId}/template-filled`,
                replaced: filled.replaced,
              });
            }
          } catch (fillErr) {
            logger.warn({ err: fillErr }, "docx template fill failed — markdown version still available");
          }
        }
      }

      // Mark step as done after successful generation
      sseWrite(res, { type: "step_done" });

    } else if (action === "complete") {
      sseWrite(res, { type: "step_done" });
    }

    sseWrite(res, { type: "done" });
    res.end();

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    logger.error({ err }, "agent stream error");
    void sendErrorAlert({ context: "agent:stream", message: msg, sessionId });
    if (!res.writableEnded) {
      sseWrite(res, { type: "error", message: msg });
      sseWrite(res, { type: "done" });
      res.end();
    }
  }
});

// ─── GET /api/session/:sessionId/template-filled ─────────────────────────────
// Download the student's own template, filled (produced by fillDocxTemplate).

router.get("/session/:sessionId/template-filled", (req: Request, res: Response) => {
  const sessionId = req.params.sessionId as string;
  const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
  if (!agent) {
    res.status(404).json({ error: "Session introuvable ou expirée." });
    return;
  }
  const filledPath = path.join(agent.workDir, FILLED_DOCX_NAME);
  if (!existsSync(filledPath)) {
    res.status(404).json({ error: "Aucune page de garde remplie pour cette session." });
    return;
  }
  res.download(filledPath, "Page-de-garde.docx");
});

export default router;

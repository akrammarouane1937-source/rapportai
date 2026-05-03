import { Router, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

interface BibEntry {
  title: string;
  authors: string;
  year: string;
  journal?: string;
  doi?: string;
}

interface GenerateBody {
  section: string;
  // Identity
  reportType?: string;
  studentName?: string;
  school?: string;
  filiere?: string;
  annee?: string;
  ville?: string;
  entreprise?: string;
  encadrantPeda?: string;
  encadrantPro?: string;
  // Subject
  theme?: string;
  problematique?: string;
  motsCles?: string[];
  citationStyle?: string;
  // Previously generated sections (for cross-referencing)
  resume?: string;
  introduction?: string;
  partieI?: string;
  partieII?: string;
  // Library sources from Bibliothèque
  sources?: BibEntry[];
  // Misc
  extraContext?: string;
}

function buildSystemPrompt(ctx: GenerateBody): string {
  const name    = ctx.studentName  ?? "l'étudiant(e)";
  const school  = ctx.school       ?? "l'école";
  const filiere = ctx.filiere      ?? "la filière";
  const type    = ctx.reportType   ?? "rapport de fin d'études";
  const theme   = ctx.theme        ?? "le thème fourni";
  const style   = ctx.citationStyle ?? "APA 7th ed.";

  return `Tu es l'assistant de rédaction académique de RapportAI. Tu aides ${name} (${school} — ${filiere}) à rédiger son ${type} intitulé "${theme}".

Règles absolues :
- Français académique formel et soutenu uniquement
- Chaque phrase est spécifique au sujet "${theme}" — JAMAIS de contenu générique ou hors-sujet
- Structure avec titres Markdown ## et ### (indispensable pour la table des matières Word)
- Citations au format ${style} avec auteurs et années plausibles
- Commence directement par le contenu — aucun préambule méta, aucun "Voici la rédaction…"
- Utilise toutes les données personnelles fournies dans le prompt (nom étudiant, école, encadrants…)
- Si des sections précédentes sont fournies, assure la cohérence et la continuité du discours

Règles d'originalité (anti-plagiat) — CRITIQUES :
- Toute idée empruntée à la littérature doit être REFORMULÉE avec des mots entièrement différents de la source d'origine — jamais de copie de phrases existantes
- Varie systématiquement la structure syntaxique : alterne phrases courtes et longues, constructions actives et passives, formulations directes et analytiques
- Exprime les concepts avec des tournures propres au contexte marocain et à l'établissement ${school}, pour ancrer l'unicité du texte
- Évite les formulations encyclopédiques génériques (définitions issues de Wikipedia, manuels standard, etc.) — préfère une reformulation personnelle et analytique
- Pour chaque concept clé, apporte un angle d'analyse original lié à la problématique "${theme}" plutôt que de simplement décrire ce concept
- Ne commence JAMAIS deux phrases consécutives par le même mot ou la même structure
- Produis un contenu qui, soumis à un outil anti-plagiat (Turnitin, iThenticate), obtient un taux de similarité inférieur à 10% — rédige donc comme le ferait un chercheur expérimenté qui synthétise des idées dans ses propres mots`;
}

/**
 * Build an APA-style inline label for a source, e.g. "(Dupont, 2020)"
 * Used in citation instructions to show Claude the exact format to use.
 */
function inlineLabel(s: BibEntry): string {
  const lastName = s.authors.split(/[,& ]/)[0].trim();
  return `(${lastName}, ${s.year})`;
}

/**
 * Build the sources block injected into the Claude prompt.
 * If sources are provided, lists them and tells Claude to cite inline.
 * If not, tells Claude to use [SOURCE À COMPLÉTER] placeholders.
 */
function buildCitationBlock(sources: BibEntry[] | undefined, style: string): string {
  if (!sources || sources.length === 0) {
    return `\nInstruction citations : L'étudiant n'a pas encore importé de sources dans sa bibliothèque. Utilise des citations plausibles au format ${style} avec des auteurs réels du domaine académique, ET insère au moins 2 placeholders [SOURCE À COMPLÉTER] aux endroits où une source spécifique manque, pour que l'étudiant sache où chercher.`;
  }

  const numbered = sources
    .map((s, i) => {
      const journal = s.journal ? `. *${s.journal}*` : "";
      const doi     = s.doi ? ` https://doi.org/${s.doi}` : "";
      return `  ${i + 1}. ${inlineLabel(s)} — ${s.authors} (${s.year}). ${s.title}${journal}${doi}`;
    })
    .join("\n");

  return `\n## Sources bibliographiques disponibles (à citer dans le texte)
L'étudiant a importé ces sources dans sa bibliothèque. Tu DOIS :
1. Citer les sources pertinentes dans le corps du texte au format ${style}, ex : ${inlineLabel(sources[0])}
2. Utiliser autant de sources de la liste que possible là où elles sont académiquement pertinentes
3. Pour toute affirmation nécessitant une source non listée, écrire [SOURCE À COMPLÉTER]
4. Ne pas inventer de références qui ne sont pas dans la liste

Sources disponibles :
${numbered}`;
}

function snippet(text: string | undefined, maxChars = 900): string {
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}

function buildPrompt(ctx: GenerateBody): string {
  const theme     = ctx.theme         ?? "Sujet non précisé";
  const school    = ctx.school        ?? "l'école";
  const filiere   = ctx.filiere       ?? "gestion";
  const type      = ctx.reportType    ?? "rapport de fin d'études";
  const student   = ctx.studentName   ?? "l'étudiant(e)";
  const encPeda   = ctx.encadrantPeda ?? "l'encadrant pédagogique";
  const encPro    = ctx.encadrantPro  ?? "l'encadrant professionnel";
  const entreprise = ctx.entreprise   ?? "l'entreprise d'accueil";
  const annee     = ctx.annee         ?? "2024–2025";
  const ville     = ctx.ville         ?? "Maroc";
  const prob      = ctx.problematique ?? `Dans quelle mesure "${theme}" peut-il être approfondi dans le contexte marocain ?`;
  const kw        = ctx.motsCles?.join(", ") ?? theme;
  const style     = ctx.citationStyle ?? "APA 7th ed.";

  switch (ctx.section) {

    case "partie-i":
      return `Rédige la Partie I du ${type} intitulé "${theme}", réalisé par ${student} à ${school} en ${filiere} (${annee}).

## Chapitre 1 — Cadre théorique et revue de littérature
### 1.1 Fondements théoriques
### 1.2 Revue de la littérature internationale et nationale
### 1.3 Contexte marocain et spécificités locales
### 1.4 Positionnement théorique de l'étude

## Chapitre 2 — Méthodologie de recherche
### 2.1 Approche et design de recherche
### 2.2 Collecte et traitement des données
### 2.3 Modèles et outils d'analyse
### 2.4 Validité et fiabilité de la démarche

Problématique centrale : ${prob}
Mots-clés : ${kw}
Style de citation : ${style}

${ctx.resume ? `Résumé existant (cohérence requise) :\n"${snippet(ctx.resume)}"\n` : ""}
${ctx.introduction ? `Introduction existante (s'appuyer dessus) :\n"${snippet(ctx.introduction)}"\n` : ""}
${buildCitationBlock(ctx.sources, style)}

EXIGENCES IMPÉRATIVES DE LONGUEUR ET DE QUALITÉ :
- Rédige un contenu dense et complet d'au moins 2 500 mots pour cette section
- Développe chaque sous-section avec des exemples concrets, des références théoriques citées et des analyses approfondies propres au contexte marocain
- Chaque sous-section (###) doit contenir au minimum 3 paragraphes substantiels de 80 à 120 mots chacun
- Intègre des statistiques, chiffres et données contextualisées au Maroc (MASI, HCP, Bank Al-Maghrib, secteur concerné…)
- Alterne entre présentation théorique, critique de la littérature et application au terrain marocain
- Placeholders figures obligatoires : [INSÉRER FIGURE N — Titre descriptif]
- NE T'ARRÊTE PAS avant d'avoir rédigé les 4 sous-sections du Chapitre 1 ET les 4 sous-sections du Chapitre 2 en intégralité`;

    case "partie-ii":
      return `Rédige la Partie II du ${type} intitulé "${theme}", réalisé par ${student} à ${school} en ${filiere} (${annee}).

## Chapitre 3 — Présentation et analyse des résultats
### 3.1 Statistiques descriptives et présentation de l'échantillon
### 3.2 Résultats de l'analyse principale
### 3.3 Interprétation des résultats et validation des hypothèses
### 3.4 Synthèse des findings empiriques

## Chapitre 4 — Discussion, limites et recommandations
### 4.1 Discussion des résultats au regard de la littérature
### 4.2 Implications théoriques et contributions académiques
### 4.3 Implications pratiques et managériales
### 4.4 Limites de l'étude et voies de recherche futures

Problématique centrale : ${prob}
Mots-clés : ${kw}
Style de citation : ${style}

${ctx.partieI ? `Partie I déjà rédigée (assure la continuité) :\n"${snippet(ctx.partieI)}"\n` : ""}
${buildCitationBlock(ctx.sources, style)}

EXIGENCES IMPÉRATIVES DE LONGUEUR ET DE QUALITÉ :
- Rédige un contenu dense et complet d'au moins 2 500 mots pour cette section
- Développe chaque sous-section avec des analyses chiffrées (statistiques descriptives, tests, ratios) cohérentes avec le thème
- Chaque sous-section (###) doit contenir au minimum 3 paragraphes substantiels de 80 à 120 mots chacun
- Inclus des tableaux de résultats fictifs mais réalistes décrits en texte (ex : "Le tableau 3.1 montre que…")
- Ancre les analyses dans le contexte marocain avec des données sectorielles spécifiques
- Formule des recommandations concrètes et actionnables pour les praticiens
- Placeholders figures obligatoires : [INSÉRER FIGURE N — Titre descriptif]
- NE T'ARRÊTE PAS avant d'avoir rédigé les 4 sous-sections du Chapitre 3 ET les 4 sous-sections du Chapitre 4 en intégralité`;

    case "introduction":
      return `Rédige l'Introduction Générale du ${type} intitulé "${theme}" (${school} — ${filiere}, ${annee}).

## Introduction Générale
### Contexte général
### Problématique
### Objectifs de recherche
### Structure du rapport

Problématique : ${prob}
Mots-clés : ${kw}

${ctx.resume ? `Résumé existant (utilise-le comme boussole thématique) :\n"${snippet(ctx.resume)}"\n` : ""}
${buildCitationBlock(ctx.sources, style)}

400 à 600 mots. Pose clairement la problématique et justifie la pertinence du sujet dans le contexte marocain actuel.`;

    case "conclusion":
      return `Rédige la Conclusion Générale du ${type} intitulé "${theme}" (${school} — ${filiere}).

## Conclusion Générale
### Synthèse des résultats
### Apports et contributions

### Limites de l'étude
### Perspectives futures de recherche

Problématique résolue : ${prob}

${ctx.partieI  ? `Résumé Partie I (à synthétiser) :\n"${snippet(ctx.partieI)}"\n`  : ""}
${ctx.partieII ? `Résumé Partie II (à synthétiser) :\n"${snippet(ctx.partieII)}"\n` : ""}
${buildCitationBlock(ctx.sources, style)}

400 à 600 mots. Synthétise les apports théoriques et pratiques en lien direct avec les deux parties, puis ouvre sur des perspectives de recherche pertinentes pour le Maroc.`;

    case "resume":
      return `Rédige le Résumé académique en français (250–300 mots) du ${type} intitulé "${theme}" (${school} — ${filiere}).

Structure : Contexte → Objectifs → Méthodologie → Résultats → Conclusion.
Problématique : ${prob}
Style de citation : ${style}

${ctx.introduction ? `Introduction existante :\n"${snippet(ctx.introduction)}"\n` : ""}

Termine par : Mots-clés : ${kw || "À définir"}
Ne dépasse pas 300 mots.`;

    case "dedicaces":
      return `Rédige une page de Dédicaces profondément personnelle et touchante pour le ${type} intitulé "${theme}" de ${student} (${school}).

La dédicace doit :
- Commencer directement par "À..." sans titre, sans préambule
- Être authentique, émotionnelle et sincère — comme si l'étudiant(e) écrivait depuis son cœur
- Toucher les lecteurs : parents, frères/sœurs, amis, mentors
- Utiliser un style sobre et poétique à la fois — pas générique, pas officiel
- Inclure une citation inspirante en fin de page (française ou traduite)
- Faire 8 à 12 lignes maximum, chaque ligne sur une ligne séparée avec des sauts de ligne clairs
- NE PAS utiliser de tirets de liste — utiliser des sauts de ligne naturels
Commence directement par "À mes chers parents," ou similaire. Aucun titre, aucun préambule.`;

    case "remerciements":
      return `Rédige une page de Remerciements formelle, chaleureuse et authentique pour le ${type} intitulé "${theme}" de ${student} (${school} — ${filiere}).

Personnes à remercier nominativement et avec des détails spécifiques :
- Encadrant pédagogique : ${encPeda} — pour la qualité de l'encadrement, la rigueur scientifique, la disponibilité
- Encadrant professionnel : ${encPro} — pour l'accueil au sein de ${entreprise}, la confiance accordée, le suivi professionnel
- L'équipe de ${entreprise} — pour l'intégration, l'esprit d'équipe, le cadre stimulant
- Le corps professoral et administratif de ${school} — pour la formation de qualité
- La famille et les proches — pour le soutien moral et affectif

Style : solennel mais sincère, gratitude authentique visible dans chaque phrase.
200 à 250 mots. Commence directement par "Au terme de ce travail..." ou similaire. Utilise les vrais noms fournis.`;

    case "keywords":
      return `Génère exactement 6 mots-clés académiques pour un ${type} intitulé "${theme}" (${school} — ${filiere}).

Les mots-clés doivent :
- Être directement et spécifiquement liés au thème "${theme}"
- Couvrir : 2 concepts théoriques principaux, 2 outils/méthodes, 2 contextes/applications
- Être utilisés dans la littérature académique du domaine
- Être en français (ou en anglais si le terme international est plus courant)
- NE PAS être génériques (pas "analyse", "étude", "recherche")

Format de sortie STRICT : retourne UNIQUEMENT les 6 mots-clés séparés par des virgules, sur une seule ligne. Aucun numéro, aucune explication, aucun autre texte.
Exemple : optimisation de portefeuille, frontière efficiente, Value-at-Risk, GARCH, Bourse de Casablanca, agent autonome`;

    case "problematique":
      return `Génère une problématique de recherche académique pour un ${type} intitulé "${theme}" (${school} — ${filiere}).

La problématique doit :
- Être une seule question de recherche principale, précise et ouverte
- Être spécifique au thème "${theme}" dans le contexte marocain ou local
- Utiliser un langage académique formel
- Faire entre 25 et 45 mots
- NE PAS commencer par "Comment" si possible — varier la formulation

Retourne UNIQUEMENT la question de recherche, sans préambule, sans guillemets, sans explication.`;

    case "contexte":
      return `Génère un résumé du contexte académique en 3 phrases pour un ${type} intitulé "${theme}" (${school} — ${filiere}).

Le contexte doit :
- Situer le sujet "${theme}" dans le contexte marocain ou sectoriel pertinent
- Justifier la pertinence académique et pratique du sujet
- Mentionner brièvement l'approche ou la méthode envisagée
- Faire 60 à 90 mots maximum

Retourne UNIQUEMENT le texte du contexte, sans préambule, directement.`;

    default:
      return `Génère du contenu académique formel de 250 à 400 mots pour un ${type} sur le thème "${theme}" (${school} — ${filiere}).
Contexte supplémentaire : ${ctx.extraContext ?? "Non précisé"}`;
  }
}

router.post("/generate", async (req: Request, res: Response) => {
  const body = req.body as GenerateBody;

  if (!body.section) {
    res.status(400).json({ error: "section is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: buildSystemPrompt(body),
      messages: [{ role: "user", content: buildPrompt(body) }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;

import { Router, type Request, type Response } from "express";
import Anthropic from "@anthropic-ai/sdk";
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
  // Previously generated sections — full content (no truncation; agent reads via tool)
  resume?: string;
  introduction?: string;
  partieI?: string;
  partieII?: string;
  conclusion?: string;
  dedicaces?: string;
  remerciements?: string;
  // Library sources from Bibliothèque
  sources?: BibEntry[];
  // Misc
  extraContext?: string;
}

// ─── read_document_state tool ────────────────────────────────────────────────
// The Writing Agent calls this before generating each section so it reads the
// full content of prior sections — identical to how Claude Code reads files
// before editing them. This is what produces coherent, cross-referencing output.

const readDocumentStateTool: Anthropic.Tool = {
  name: "read_document_state",
  description:
    "Lis le contenu intégral des sections du rapport déjà rédigées. " +
    "Appelle cet outil AVANT de rédiger toute section afin d'assurer la cohérence, " +
    "d'éviter les répétitions et de maintenir une terminologie uniforme tout au long du document. " +
    "Utilise sections: [\"all\"] pour tout lire, ou spécifie des identifiants comme [\"introduction\", \"partie-i\"].",
  input_schema: {
    type: "object" as const,
    properties: {
      sections: {
        type: "array",
        items: { type: "string" },
        description:
          'Liste des sections à lire. Valeurs acceptées : "all", "resume", "introduction", "partie-i", "partie-ii", "conclusion", "dedicaces", "remerciements".',
      },
    },
    required: ["sections"],
  },
};

// ─── Build tool result from request body ─────────────────────────────────────

function resolveDocumentState(
  body: GenerateBody,
  requestedSections: string[]
): string {
  const sectionMap: Record<string, string | undefined> = {
    resume: body.resume,
    introduction: body.introduction,
    "partie-i": body.partieI,
    "partie-ii": body.partieII,
    conclusion: body.conclusion,
    dedicaces: body.dedicaces,
    remerciements: body.remerciements,
  };

  const keys =
    requestedSections.includes("all") || requestedSections.length === 0
      ? Object.keys(sectionMap)
      : requestedSections;

  const parts = keys
    .filter((k) => sectionMap[k])
    .map((k) => `=== Section : ${k} ===\n\n${sectionMap[k]}`);

  if (parts.length === 0) {
    return "Aucune section rédigée pour l'instant. C'est la première section du rapport.";
  }

  return parts.join("\n\n---\n\n");
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: GenerateBody): string {
  const name    = ctx.studentName  ?? "l'étudiant(e)";
  const school  = ctx.school       ?? "l'école";
  const filiere = ctx.filiere      ?? "la filière";
  const type    = ctx.reportType   ?? "rapport de fin d'études";
  const theme   = ctx.theme        ?? "le thème fourni";
  const style   = ctx.citationStyle ?? "APA 7th ed.";

  return `Tu es l'assistant de rédaction académique de RapportAI. Tu aides ${name} (${school} — ${filiere}) à rédiger son ${type} intitulé "${theme}".

## Règle fondamentale — Cohérence documentaire
Avant de rédiger chaque section, appelle OBLIGATOIREMENT l'outil read_document_state avec sections: ["all"].
Cela te permet de :
- Reprendre la terminologie exacte déjà utilisée (noms propres, acronymes, concepts-clés)
- Éviter toute répétition de contenu déjà développé
- Construire sur l'existant avec des références croisées ("Comme développé en Partie I…", "Tel qu'exposé dans l'introduction…")
- Maintenir un fil conducteur logique et progressif sur tout le document

## Règles absolues
- Français académique formel et soutenu uniquement
- Chaque phrase est spécifique au sujet "${theme}" — JAMAIS de contenu générique ou hors-sujet
- Structure avec titres Markdown ## et ### (indispensable pour la table des matières Word)
- Citations au format ${style} avec auteurs et années
- Commence directement par le contenu — aucun préambule méta, aucun "Voici la rédaction…"
- Utilise toutes les données personnelles fournies dans le prompt (nom étudiant, école, encadrants…)

## Règles d'originalité (anti-plagiat) — CRITIQUES
- Toute idée empruntée à la littérature doit être REFORMULÉE avec des mots entièrement différents de la source d'origine
- Varie systématiquement la structure syntaxique : alterne phrases courtes et longues, constructions actives et passives
- Exprime les concepts avec des tournures propres au contexte marocain et à l'établissement ${school}
- Évite les formulations encyclopédiques génériques — préfère une reformulation personnelle et analytique
- Pour chaque concept clé, apporte un angle d'analyse original lié à la problématique "${theme}"
- Ne commence JAMAIS deux phrases consécutives par le même mot ou la même structure
- Produis un contenu avec un taux de similarité inférieur à 10% (niveau chercheur expérimenté)`;
}

// ─── APA inline label helper ─────────────────────────────────────────────────

function inlineLabel(s: BibEntry): string {
  const lastName = s.authors.split(/[,& ]/)[0].trim();
  return `(${lastName}, ${s.year})`;
}

// ─── Citation block ───────────────────────────────────────────────────────────

function buildCitationBlock(sources: BibEntry[] | undefined, style: string): string {
  if (!sources || sources.length === 0) {
    return `\nInstruction citations : L'étudiant n'a pas encore importé de sources dans sa bibliothèque. Utilise des citations plausibles au format ${style} avec des auteurs réels du domaine académique, ET insère au moins 2 placeholders [SOURCE À COMPLÉTER] aux endroits où une source spécifique manque.`;
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

// ─── Section prompts ──────────────────────────────────────────────────────────

function buildPrompt(ctx: GenerateBody): string {
  const theme      = ctx.theme         ?? "Sujet non précisé";
  const school     = ctx.school        ?? "l'école";
  const filiere    = ctx.filiere       ?? "gestion";
  const type       = ctx.reportType    ?? "rapport de fin d'études";
  const student    = ctx.studentName   ?? "l'étudiant(e)";
  const encPeda    = ctx.encadrantPeda ?? "l'encadrant pédagogique";
  const encPro     = ctx.encadrantPro  ?? "l'encadrant professionnel";
  const entreprise = ctx.entreprise    ?? "l'entreprise d'accueil";
  const annee      = ctx.annee         ?? "2024–2025";
  const prob       = ctx.problematique ?? `Dans quelle mesure "${theme}" peut-il être approfondi dans le contexte marocain ?`;
  const kw         = ctx.motsCles?.join(", ") ?? theme;
  const style      = ctx.citationStyle ?? "APA 7th ed.";

  // Note: we no longer pass previous sections inline as truncated snippets.
  // The agent calls read_document_state to get the full content before writing.

  switch (ctx.section) {

    case "partie-i":
      return `Commence par appeler read_document_state avec sections: ["all"], puis rédige la Partie I du ${type} intitulé "${theme}", réalisé par ${student} à ${school} en ${filiere} (${annee}).

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
${buildCitationBlock(ctx.sources, style)}

EXIGENCES IMPÉRATIVES :
- Rédige un contenu dense d'au moins 2 500 mots
- Chaque sous-section (###) : minimum 3 paragraphes de 80 à 120 mots
- Intègre des statistiques et données contextualisées au Maroc (MASI, HCP, Bank Al-Maghrib…)
- Placeholders figures obligatoires : [INSÉRER FIGURE N — Titre descriptif]
- Utilise les références croisées vers les sections déjà rédigées que tu viens de lire
- NE T'ARRÊTE PAS avant d'avoir rédigé les 4 sous-sections du Chapitre 1 ET les 4 du Chapitre 2`;

    case "partie-ii":
      return `Commence par appeler read_document_state avec sections: ["all"], puis rédige la Partie II du ${type} intitulé "${theme}", réalisé par ${student} à ${school} en ${filiere} (${annee}).

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
${buildCitationBlock(ctx.sources, style)}

EXIGENCES IMPÉRATIVES :
- Rédige un contenu dense d'au moins 2 500 mots
- Chaque sous-section (###) : minimum 3 paragraphes de 80 à 120 mots
- Inclus des tableaux de résultats décrits en texte ("Le tableau 3.1 montre que…")
- Ancre les analyses dans le contexte marocain avec des données sectorielles
- Utilise les références croisées vers la Partie I que tu viens de lire
- Placeholders figures obligatoires : [INSÉRER FIGURE N — Titre descriptif]
- NE T'ARRÊTE PAS avant d'avoir rédigé les 4 sous-sections du Chapitre 3 ET les 4 du Chapitre 4`;

    case "introduction":
      return `Commence par appeler read_document_state avec sections: ["resume"], puis rédige l'Introduction Générale du ${type} intitulé "${theme}" (${school} — ${filiere}, ${annee}).

## Introduction Générale
### Contexte général
### Problématique
### Objectifs de recherche
### Structure du rapport

Problématique : ${prob}
Mots-clés : ${kw}
${buildCitationBlock(ctx.sources, style)}

400 à 600 mots. Pose clairement la problématique et justifie la pertinence du sujet dans le contexte marocain actuel. Annonce la structure des deux parties dans la sous-section "Structure du rapport".`;

    case "conclusion":
      return `Commence par appeler read_document_state avec sections: ["introduction", "partie-i", "partie-ii"], puis rédige la Conclusion Générale du ${type} intitulé "${theme}" (${school} — ${filiere}).

## Conclusion Générale
### Synthèse des résultats
### Apports et contributions
### Limites de l'étude
### Perspectives futures de recherche

Problématique résolue : ${prob}
${buildCitationBlock(ctx.sources, style)}

400 à 600 mots. Synthétise les apports théoriques et pratiques en lien direct avec les deux parties lues, puis ouvre sur des perspectives de recherche pertinentes pour le Maroc. Utilise des références croisées vers les chapitres rédigés.`;

    case "resume":
      return `Commence par appeler read_document_state avec sections: ["introduction"], puis rédige le Résumé académique en français (250–300 mots) du ${type} intitulé "${theme}" (${school} — ${filiere}).

Structure : Contexte → Objectifs → Méthodologie → Résultats → Conclusion.
Problématique : ${prob}
Style de citation : ${style}

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
      return `Tu es un expert en référencement académique (Google Scholar, CNKI, ResearchGate).

Génère exactement 8 mots-clés / expressions de recherche pour un ${type} intitulé :
"${theme}"
Filière : ${filiere} | École : ${school}

RÈGLES ABSOLUES :
1. Les 3 premiers mots-clés doivent être des CORRESPONDANCES EXACTES tirées mot pour mot du titre "${theme}" — découpe le titre en segments clés de 2 à 5 mots.
2. Les 5 suivants doivent être des mots-clés LONGUE TRAÎNE (4 à 7 mots) qui utilisent les mots exacts du titre et ajoutent un contexte précis : méthode, outil technologique, secteur, contexte marocain, ou problème spécifique.
3. Chaque expression doit correspondre à ce qu'un chercheur taperait réellement dans Google Scholar pour trouver ce travail.
4. Langue : français en priorité, anglais accepté si le terme technique international est plus utilisé.
5. INTERDIT : mots génériques seuls ("analyse", "étude", "gestion", "système", "recherche", "approche").
6. INTERDIT : répéter exactement le titre complet.

Format de sortie STRICT : 8 expressions séparées par des virgules, sur une seule ligne, sans numéro ni explication.`;

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

// ─── Sections that benefit from reading document state first ─────────────────
// Short sections (dédicaces, remerciements, keywords, problématique, contexte)
// don't need the tool — they're either personal or self-contained.

const SECTIONS_WITH_TOOL = new Set([
  "partie-i",
  "partie-ii",
  "introduction",
  "conclusion",
  "resume",
]);

// ─── Route handler ────────────────────────────────────────────────────────────

router.post("/generate", async (req: Request, res: Response) => {
  const body = req.body as GenerateBody;

  if (!body.section) {
    res.status(400).json({ error: "section is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const useAgenticLoop = SECTIONS_WITH_TOOL.has(body.section);

  try {
    if (!useAgenticLoop) {
      // Simple sections: single call, no tool needed
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
    } else {
      // Main sections: agentic loop with read_document_state tool
      // The agent reads all previously generated sections before writing,
      // producing cross-referencing, coherent output instead of isolated text.

      const messages: Anthropic.MessageParam[] = [
        { role: "user", content: buildPrompt(body) },
      ];

      let iterationCount = 0;
      const MAX_ITERATIONS = 5; // safety cap — tool call + write = 2 iterations max in practice

      while (iterationCount < MAX_ITERATIONS) {
        iterationCount++;

        const stream = anthropic.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: buildSystemPrompt(body),
          tools: [readDocumentStateTool],
          messages,
        });

        // Stream text deltas to frontend in real time
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
          }
        }

        const finalMessage = await stream.finalMessage();

        if (finalMessage.stop_reason === "tool_use") {
          // Agent called read_document_state — resolve it and continue
          const toolCall = finalMessage.content.find(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );

          if (toolCall?.name === "read_document_state") {
            const input = toolCall.input as { sections?: string[] };
            const requested = input.sections ?? ["all"];
            const documentState = resolveDocumentState(body, requested);

            // Append assistant turn + tool result, then loop
            messages.push(
              { role: "assistant", content: finalMessage.content },
              {
                role: "user",
                content: [
                  {
                    type: "tool_result",
                    tool_use_id: toolCall.id,
                    content: documentState,
                  },
                ],
              }
            );

            continue; // Agent now has full document context — let it write
          }
        }

        // stop_reason === "end_turn" or no tool call — generation complete
        break;
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

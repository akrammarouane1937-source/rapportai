import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeBinary } from "../lib/find-claude-binary";

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
  reportType?: string;
  studentName?: string;
  school?: string;
  filiere?: string;
  annee?: string;
  ville?: string;
  entreprise?: string;
  encadrantPeda?: string;
  encadrantPro?: string;
  theme?: string;
  problematique?: string;
  motsCles?: string[];
  citationStyle?: string;
  resume?: string;
  introduction?: string;
  partieI?: string;
  partieII?: string;
  conclusion?: string;
  dedicaces?: string;
  remerciements?: string;
  sources?: BibEntry[];
  extraContext?: string;
}

function buildDocumentContext(ctx: GenerateBody): string {
  const map: Record<string, string | undefined> = {
    "Résumé": ctx.resume,
    "Introduction": ctx.introduction,
    "Partie I": ctx.partieI,
    "Partie II": ctx.partieII,
    "Conclusion": ctx.conclusion,
    "Dédicaces": ctx.dedicaces,
    "Remerciements": ctx.remerciements,
  };
  const parts = Object.entries(map)
    .filter(([, v]) => v)
    .map(([k, v]) => `=== ${k} ===\n${v}`);
  return parts.length > 0
    ? `\n\n## Sections déjà rédigées — utilise-les pour cohérence et références croisées\n\n${parts.join("\n\n---\n\n")}`
    : "";
}

function inlineLabel(s: BibEntry): string {
  const lastName = s.authors.split(/[,& ]/)[0].trim();
  return `(${lastName}, ${s.year})`;
}

function buildCitationBlock(sources: BibEntry[] | undefined, style: string): string {
  if (!sources || sources.length === 0) {
    return `\nInstruction citations : Utilise WebFetch sur https://api.semanticscholar.org/graph/v1/paper/search?query={THEME}&limit=8&fields=title,authors,year,externalIds,abstract pour trouver des sources réelles. Insère au moins 2 placeholders [SOURCE À COMPLÉTER] si nécessaire.`;
  }
  const numbered = sources
    .map((s, i) => {
      const journal = s.journal ? `. *${s.journal}*` : "";
      const doi = s.doi ? ` https://doi.org/${s.doi}` : "";
      return `  ${i + 1}. ${inlineLabel(s)} — ${s.authors} (${s.year}). ${s.title}${journal}${doi}`;
    })
    .join("\n");
  return `\n## Sources bibliographiques disponibles\n${numbered}`;
}

function buildSystemPrompt(ctx: GenerateBody): string {
  const name    = ctx.studentName  ?? "l'étudiant(e)";
  const school  = ctx.school       ?? "l'école";
  const filiere = ctx.filiere      ?? "la filière";
  const type    = ctx.reportType   ?? "rapport de fin d'études";
  const theme   = ctx.theme        ?? "le thème fourni";
  const style   = ctx.citationStyle ?? "APA 7th ed.";

  return `Tu es l'agent de rédaction académique de RapportAI. Tu aides ${name} (${school} — ${filiere}) à rédiger son ${type} intitulé "${theme}".

## Règles absolues
- Français académique formel et soutenu uniquement
- Structure avec titres Markdown ## et ### obligatoires
- Citations au format ${style} avec auteurs et années
- Commence directement par le contenu — aucun préambule méta
- Toujours utiliser les sections déjà rédigées pour les références croisées

## Originalité
- Reformule chaque idée avec des mots entièrement différents de la source
- Varie la structure syntaxique : phrases courtes ET longues, actif ET passif
- Contexte marocain obligatoire — données HCP, Bank Al-Maghrib, secteur local
- Taux de similarité cible : inférieur à 10 %${buildDocumentContext(ctx)}`;
}

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

  switch (ctx.section) {
    case "partie-i":
      return `Utilise WebFetch sur https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(theme)}&limit=8&fields=title,authors,year,externalIds,abstract pour trouver des sources réelles, puis rédige la Partie I du ${type} intitulé "${theme}", réalisé par ${student} à ${school} en ${filiere} (${annee}).

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

Problématique : ${prob} | Mots-clés : ${kw} | Style : ${style}
${buildCitationBlock(ctx.sources, style)}

Minimum 2500 mots. Chaque sous-section : 3 paragraphes minimum. Placeholders figures : [INSÉRER FIGURE N — Titre].`;

    case "partie-ii":
      return `Utilise WebFetch sur https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(theme)}&limit=8&fields=title,authors,year,externalIds,abstract pour des sources complémentaires, puis rédige la Partie II du ${type} intitulé "${theme}" (${school} — ${filiere}).

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

Problématique : ${prob} | Style : ${style}
${buildCitationBlock(ctx.sources, style)}

Minimum 2500 mots. Références croisées vers Partie I obligatoires. Placeholders figures : [INSÉRER FIGURE N — Titre].`;

    case "introduction":
      return `Rédige l'Introduction Générale du ${type} intitulé "${theme}" (${school} — ${filiere}, ${annee}).

## Introduction Générale
### Contexte général
### Problématique
### Objectifs de recherche
### Structure du rapport

Problématique : ${prob} | Mots-clés : ${kw}
400 à 600 mots. Justifie la pertinence du sujet dans le contexte marocain. Annonce la structure des deux parties.`;

    case "conclusion":
      return `Rédige la Conclusion Générale du ${type} intitulé "${theme}" (${school} — ${filiere}).

## Conclusion Générale
### Synthèse des résultats
### Apports et contributions
### Limites de l'étude
### Perspectives futures de recherche

Problématique résolue : ${prob}
400 à 600 mots. Synthétise les apports théoriques et pratiques. Références croisées vers les deux parties. Perspectives pour le Maroc.`;

    case "resume":
      return `Rédige le Résumé académique (250–300 mots) du ${type} intitulé "${theme}" (${school} — ${filiere}).
Structure : Contexte → Objectifs → Méthodologie → Résultats → Conclusion.
Problématique : ${prob} | Style : ${style}
Termine par : Mots-clés : ${kw || "À définir"}`;

    case "dedicaces":
      return `Rédige une page de Dédicaces pour le ${type} de ${student} (${school}).
- Commence directement par "À..." sans titre
- Authentique, sobre et poétique — 8 à 12 lignes
- Inclus une citation inspirante en fin
- NE PAS utiliser de tirets de liste`;

    case "remerciements":
      return `Rédige une page de Remerciements pour le ${type} de ${student} (${school} — ${filiere}).
Personnes à remercier :
- Encadrant pédagogique : ${encPeda}
- Encadrant professionnel : ${encPro} — ${entreprise}
- Corps professoral de ${school}
- Famille et proches
200 à 250 mots. Commence par "Au terme de ce travail..." ou similaire.`;

    case "keywords":
      return `Génère exactement 8 mots-clés pour un ${type} intitulé "${theme}" (${filiere} — ${school}).
Règles : 3 premiers = segments exacts du titre. 5 suivants = longue traîne (4-7 mots) avec contexte précis.
Format : 8 expressions séparées par des virgules, une seule ligne, sans numéro.`;

    case "problematique":
      return `Génère une problématique de recherche pour un ${type} intitulé "${theme}" (${school} — ${filiere}).
Une seule question principale, 25-45 mots, spécifique au contexte marocain, language académique formel.
Retourne UNIQUEMENT la question, sans préambule.`;

    case "contexte":
      return `Génère un résumé du contexte académique en 3 phrases pour un ${type} intitulé "${theme}" (${school} — ${filiere}).
Situe le sujet dans le contexte marocain, justifie la pertinence, mentionne l'approche.
60 à 90 mots maximum. Retourne UNIQUEMENT le texte.`;

    default:
      return `Génère du contenu académique formel pour un ${type} sur le thème "${theme}" (${school} — ${filiere}).
${ctx.extraContext ?? ""}`;
  }
}

// page-de-garde uses session route (needs template files on disk) — not stateless
const SECTIONS_WITH_WEB = new Set(["partie-i", "partie-ii"]);

router.post("/generate", async (req: Request, res: Response) => {
  const body = req.body as GenerateBody;

  if (!body.section) {
    res.status(400).json({ error: "section is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();

  try {
    for await (const message of query({
      prompt: buildPrompt(body),
      options: {
        systemPrompt: buildSystemPrompt(body),
        maxTurns: SECTIONS_WITH_WEB.has(body.section) ? 8 : 2,
        allowedTools: SECTIONS_WITH_WEB.has(body.section) ? ["WebFetch"] : [],
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text" && block.text) {
            res.write(`data: ${JSON.stringify({ content: block.text })}\n\n`);
          }
          if (block.type === "tool_use") {
            res.write(`data: ${JSON.stringify({ tool_call: block.name })}\n\n`);
          }
        }
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

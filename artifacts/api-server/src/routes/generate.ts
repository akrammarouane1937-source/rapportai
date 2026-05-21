import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { markSectionComplete, sessionDir, readMemory } from "../lib/memory";
import { getSectionConfig, buildMemoryContext } from "../lib/agents/sectionConfigs";
import type { StudentMemory } from "../lib/memory-types";
import { runInternalHumanize } from "../lib/humanize-util";

const router = Router();

interface BibEntry {
  title: string;
  authors: string;
  year: string;
  journal?: string;
  doi?: string;
}

interface FigureRef {
  id:            string;
  figure_number: number;
  description:   string;
  placement:     string;  // "Partie I" | "Partie II"
}

interface GenerateBody {
  section: string;
  sessionId?: string;
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
  availableFigures?: FigureRef[];  // figures the student approved for this section
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

function loadSkillsFile(filename: string): string {
  try {
    const p = path.join(process.cwd(), "src/lib/skills", filename);
    if (existsSync(p)) return readFileSync(p, "utf-8");
  } catch { /* missing — silent */ }
  return "";
}

function buildSystemPrompt(ctx: GenerateBody, memory?: StudentMemory): string {
  const name    = ctx.studentName  ?? "l'étudiant(e)";
  const school  = ctx.school       ?? "l'école";
  const filiere = ctx.filiere      ?? "la filière";
  const type    = ctx.reportType   ?? "rapport de fin d'études";
  const theme   = ctx.theme        ?? "le thème fourni";
  const style   = ctx.citationStyle ?? "APA 7th ed.";

  // Load agent-specific system prompt file if available ([section]-system.md)
  // Falls back to the generic base prompt when not yet written
  let basePrompt = "";
  try {
    const config = getSectionConfig(ctx.section);
    const systemFile = config.skillsFile.replace("-skills.md", "-system.md");
    basePrompt = loadSkillsFile(systemFile);
  } catch { /* unknown section */ }

  if (!basePrompt) {
    basePrompt = `Tu es l'agent de rédaction académique de RapportAI. Tu aides ${name} (${school} — ${filiere}) à rédiger son ${type} intitulé "${theme}".

## Règles absolues
- Français académique formel et soutenu uniquement
- Structure avec titres Markdown ## et ### obligatoires
- Citations au format ${style} avec auteurs et années
- Commence directement par le contenu — aucun préambule méta
- Toujours utiliser les sections déjà rédigées pour les références croisées
- Ne jamais contredire la problématique, les hypothèses ou le cadre théorique établis

## Originalité
- Reformule chaque idée avec des mots entièrement différents de la source
- Varie la structure syntaxique : phrases courtes ET longues, actif ET passif
- Contexte marocain obligatoire — données HCP, Bank Al-Maghrib, secteur local
- Taux de similarité cible : inférieur à 10 %`;
  }

  // Load section-specific skills file
  let skillsContent = "";
  try {
    const config = getSectionConfig(ctx.section);
    const raw = loadSkillsFile(config.skillsFile);
    if (raw) skillsContent = `\n\n---\n## KNOWLEDGE BASE — LIS ENTIÈREMENT AVANT D'ÉCRIRE\n${raw}`;
  } catch { /* unknown section */ }

  // Inject student memory context so agent never contradicts established decisions
  const memoryContext = memory ? buildMemoryContext(memory) : "";

  // Heading format rule — injected only for sections that write structured body content
  // The DOCX export depends on these exact markdown prefixes to generate Word heading styles
  const BODY_SECTIONS = new Set(["introduction", "partie-i", "partie-ii", "conclusion"]);
  const headingRule = BODY_SECTIONS.has(ctx.section) ? `

## FORMAT DES TITRES — OBLIGATOIRE POUR L'EXPORT WORD
Le système d'export convertit les préfixes markdown en styles Word. Respecte EXACTEMENT :
- \`# Titre\` → Partie (Heading 1) — ex: \`# Partie I : Revue de Littérature\`
- \`## Titre\` → Chapitre (Heading 2) — ex: \`## Chapitre I : Fondements théoriques\`
- \`### Titre\` → Section (Heading 3) — ex: \`### Section 1 : Définitions et concepts\`
- \`#### Titre\` → Sous-section (Heading 4) — ex: \`#### 1.1 Définition du concept\`
- Paragraphes normaux : aucun préfixe

Structure obligatoire pour chaque Partie :
1. Introduction de la Partie (paragraphe normal, pas de titre # )
2. Chapitres numérotés (Chapitre I, Chapitre II…) avec Sections et Sous-sections
3. Conclusion de la Partie (paragraphe normal)` : "";

  // Figures context — injected for partie-i/ii so agent references them naturally
  const figuresContext = (() => {
    if (!ctx.availableFigures?.length) return "";
    const sectionFigs = ctx.availableFigures.filter(
      (f) => (ctx.section === "partie-i" && f.placement === "Partie I")
           || (ctx.section === "partie-ii" && f.placement === "Partie II"),
    );
    if (!sectionFigs.length) return "";
    const list = sectionFigs
      .map((f) => `  - Figure ${f.figure_number} : ${f.description}`)
      .join("\n");
    return `\n\n## FIGURES DISPONIBLES POUR CETTE SECTION\nL'étudiant a approuvé ces figures. Référence-les naturellement dans le texte avec leur numéro exact :\n${list}\nExemple : « Comme l'illustre la Figure ${sectionFigs[0].figure_number}, … »\nN'invente PAS d'autres numéros de figures.`;
  })();

  return `${basePrompt}${memoryContext}${buildDocumentContext(ctx)}${headingRule}${figuresContext}${skillsContent}`;
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
      return `Lis d'abord \`sommaire.md\` pour extraire la structure exacte de la Partie I (chapitres et sections).
Génère ensuite la Partie I complète en suivant cette structure exactement — ne modifie aucun titre, n'ajoute aucun chapitre.
Si aucun fichier source n'est disponible dans le répertoire, utilise WebSearch puis WebFetch pour trouver des sources académiques sur : "${theme}" (${filiere}).
Problématique : ${prob} | Mots-clés : ${kw} | Style de citation : ${style}
${buildCitationBlock(ctx.sources, style)}`;

    case "partie-ii":
      return `Lis d'abord \`sommaire.md\` pour extraire la structure exacte de la Partie II (chapitres et sections).
Génère ensuite la Partie II complète en suivant cette structure exactement.
La Partie II est le cadre pratique — utilise les données uploadées et les résultats empiriques. Référence croisée obligatoire vers partie-i.md.
Si aucun fichier source n'est disponible, utilise WebSearch puis WebFetch pour trouver des données et études de cas sur : "${theme}" (${filiere}).
Problématique : ${prob} | Style de citation : ${style}
${buildCitationBlock(ctx.sources, style)}`;

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

// Sections that use WebFetch for real academic sources
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

  // Session dir gives the agent access to student_memory.json + all generated sections
  const sDir = body.sessionId ? sessionDir(body.sessionId) : null;
  const workDir = sDir && existsSync(sDir) ? sDir : undefined;

  // Load memory — merge into body + pass to system prompt builder
  let memory: StudentMemory | null = null;
  if (body.sessionId && workDir) {
    memory = readMemory(body.sessionId);
    if (memory) {
      body.theme         = body.theme         ?? memory.report.title;
      body.school        = body.school        ?? memory.identity.school;
      body.filiere       = body.filiere       ?? memory.identity.filiere;
      body.reportType    = body.reportType    ?? memory.report.type;
      body.studentName   = body.studentName   ?? memory.identity.full_name;
      body.problematique = body.problematique ?? memory.report.problematique;
      body.motsCles      = body.motsCles      ?? memory.report.mots_cles;
      body.citationStyle = body.citationStyle ?? memory.writing_profile.citation_style;
      body.encadrantPeda = body.encadrantPeda ?? memory.identity.supervisor?.name;
      body.entreprise    = body.entreprise    ?? memory.report.company?.name;
    }
  }

  let tools: string[] = [];
  let maxTurnsOverride: number | undefined;
  try {
    const config = getSectionConfig(body.section);
    tools = config.allowedTools;
    maxTurnsOverride = config.maxTurns;
  } catch {
    // Unknown section — minimal fallback
    tools = workDir ? ["Read"] : [];
  }

  let fullOutput = "";

  try {
    // Phase 1 — generation: buffer output, only stream tool_call events for live feedback
    res.write(`data: ${JSON.stringify({ phase: "writing" })}\n\n`);

    for await (const message of query({
      prompt: buildPrompt(body),
      options: {
        systemPrompt: buildSystemPrompt(body, memory ?? undefined),
        maxTurns: maxTurnsOverride ?? (SECTIONS_WITH_WEB.has(body.section) ? 8 : 2),
        allowedTools: tools,
        ...(workDir ? { cwd: workDir } : {}),
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text" && block.text) {
            fullOutput += block.text;
          }
          if (block.type === "tool_use") {
            res.write(`data: ${JSON.stringify({ tool_call: block.name })}\n\n`);
          }
        }
      }
    }

    // Phase 2 — humanize: run silently, student sees "Optimisation du texte…"
    res.write(`data: ${JSON.stringify({ phase: "humanizing" })}\n\n`);
    const finalOutput = await runInternalHumanize(fullOutput, body.section);

    // Phase 3 — stream the humanized result
    res.write(`data: ${JSON.stringify({ content: finalOutput })}\n\n`);

    // Update memory: mark section complete with word count + key_points summary
    if (body.sessionId && finalOutput.trim()) {
      const wordCount = finalOutput.split(/\s+/).filter(Boolean).length;
      markSectionComplete(body.sessionId, body.section, {
        word_count: wordCount,
        key_points: finalOutput.slice(0, 300).replace(/<[^>]+>/g, "").trim(),
      });
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

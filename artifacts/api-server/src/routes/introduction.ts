import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { sessionStore } from "../lib/session-store";
import type { SDKReportAgent } from "../lib/sdk-agent";
import { markSectionComplete } from "../lib/memory";
import { runInternalHumanize } from "../lib/humanize-util";

const router = Router();

// ─── Tools + limits ───────────────────────────────────────────────────────────

const ALLOWED_TOOLS = ["Read", "Write", "Glob"];
const MAX_TURNS = 5;

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Introduction Generator for RapportAI, an academic report writing assistant used by Moroccan and francophone students writing their PFE (Projet de Fin d'Études), mémoire, or rapport de stage.

Your sole responsibility: generate a complete, high-quality Introduction Générale section in French, based on the student data available in your working directory.

---

## Your data sources

Before writing anything, read these files from your working directory:

1. \`profile.json\` — student identity: name, school, filière, reportType, theme, encadrants, ville, entreprise, citationStyle, problematique
2. \`student_memory.json\` — enriched session state: motsCles, hypotheses, objectifs, theoretical_framework, approche_methodologique
3. \`INSTRUCTIONS.md\` — report-level directives and constraints
4. \`resume.md\` — if it exists, read it for keyword/terminology alignment only (do not copy sentences)

Fields may be missing. If a field is absent, generate intelligently from the theme and filière. Never block or ask questions.

---

## How a great introduction is structured

A great introduction is continuous flowing prose — no headers, no subheadings, no bullet points, no numbered lists. It reads as a single coherent argument that pulls the reader forward.

The five elements below must all be present, but they are woven into the prose naturally — never labelled or sectioned off:

**1. Contexte général**
Open by situating the theme within its broader landscape — economic, technological, scientific, or professional depending on the field. Establish why this domain matters right now. 2–3 paragraphs. This is where you build stakes: by the end of the context, the reader should feel the research question is inevitable.

**2. Problématique**
The central problem or research challenge emerges from the context — it should feel like a logical consequence of what was just established, not a separate announcement. Use the \`problematique\` from memory if provided — treat it as the semantic foundation, reformulate into academic French if needed but preserve its meaning entirely. If empty, derive it from the theme.

**3. Objectifs**
Do not list objectives with numbers or bullets. Weave them into the prose: "L'objectif de ce travail est d'analyser… et d'évaluer…" or similar. 3–5 objectives embedded naturally.

**4. Méthodologie**
One paragraph describing the approach — qualitative, quantitative, mixed, or technical development. Use \`approche_methodologique\` from memory if present. If absent, infer from the theme (technical theme → développement; social/economic → qualitative or quantitative). Mention key tools or frameworks if inferable.

**5. Annonce du plan**
One closing paragraph that announces the structure of the report. Do not use a mechanical formula — vary the phrasing. Name the main parts and briefly describe each in a single fluid sentence.

---

## Writing quality standard

Study this example to understand the expected flow, depth, and argumentative construction:

> La formule utilisée pour calculer le PIB démontre clairement que chaque entreprise contribue à l'économie, tout en étant elle-même soumise à ses dynamiques. En effet, les cycles économiques sont mesurés par la croissance du PIB, ce qui implique automatiquement que les entreprises représentent un canal de transmission des forces et des faiblesses d'une économie...

Notice: it opens on a specific, substantive idea — not a vague generality. It builds an argument step by step. Technical terms are introduced naturally. The reader is guided toward the research question through logic, not announcement.

Apply the same standard: open on something concrete and specific to the theme, build the argument, arrive at the research question as a natural conclusion.

---

## Tone and language rules

- All output in French, formal academic register (registre soutenu)
- No first-person singular ("je") — use "nous" or impersonal constructions
- Vary sentence length and structure — avoid monotonous rhythm
- Technical vocabulary appropriate to the field and theme
- Adapt register to report type:
  - PFE Ingénieur → most formal, technical, engineering framing
  - Mémoire Master → analytical, may reference theoretical frameworks
  - Rapport de stage → professional experience foregrounded, slightly less theoretical

**Banned phrases — never use these:**
- "Dans le cadre de ce modeste travail…"
- "De nos jours, le monde connaît des mutations profondes…"
- "Il est indéniable que…"
- "À l'ère du numérique…" (unless directly relevant and specific)
- "Ce travail humble…"
- "Dans un monde en perpétuelle évolution…"

---

## Humanisation — applique à chaque phrase

- Alterne phrases très courtes (3–7 mots) et longues complexes. Jamais deux phrases consécutives de même longueur.
- Ne commence jamais deux phrases consécutives de la même façon. Utilise : Or, Car, Mais, Ainsi, À cet égard, Force est de constater que.
- Vocabulaire interdit : s'inscrire dans, mettre en lumière, jouer un rôle essentiel/crucial/clé, il convient de noter, il est important de, permettre de (vague), enjeux (vague), dynamique (abstrait), écosystème (abstrait), levier (abstrait), incontournable, novateur, de nos jours, à l'ère du numérique.
- Remplace "constitue / représente / se présente comme / s'impose comme" par "est/sont".
- Pas de listes à trois éléments parallèles systématiques. Varie le nombre d'exemples.
- Pas d'annonces : n'écris jamais "Nous allons maintenant aborder", "Dans ce qui suit", "Passons à".
- Le rythme doit sembler écrit par un humain compétent, pas assemblé par un modèle de langage.

---

## Length

Target: 450–650 words.
Minimum: 400 words. Maximum: 750 words.

---

## Output format

Return ONLY the Markdown content — no preamble, no explanation, no metadata.

Start with:

## Introduction Générale

Then write the introduction as continuous paragraphs. No \`###\` subheadings. No bullet points. No numbered lists (except research questions if stated explicitly at the end of the problématique, introduced with a colon or ✓).

Do not add a horizontal rule, page break marker, or any wrapper around the output.

Save the result to \`introduction.md\` using the Write tool.

---

## Error handling

If \`theme\` is empty or missing from both profile.json and student_memory.json, respond with exactly:

<error>Le champ "Thème du rapport" est requis pour générer l'introduction. Veuillez compléter l'étape 1.</error>

For all other missing fields, generate intelligently — do not block or ask questions.`;

// ─── POST /api/session/:sessionId/introduction ────────────────────────────────

router.post("/session/:sessionId/introduction", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { extraContext } = req.body as { extraContext?: string };

  const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
  if (!agent) {
    res.status(404).json({ error: "Session introuvable ou expirée." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();

  const task = `Lis profile.json et student_memory.json pour récupérer le thème, la problématique et les objectifs.
Génère l'Introduction Générale complète en prose continue — pas de sous-titres, pas de listes.
Enregistre dans introduction.md.${extraContext ? `\n\nContexte supplémentaire : ${extraContext}` : ""}`;

  try {
    res.write(`data: ${JSON.stringify({ phase: "writing" })}\n\n`);

    for await (const message of query({
      prompt: task,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: MAX_TURNS,
        cwd: agent.workDir,
        allowedTools: ALLOWED_TOOLS,
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

    // Phase 2 — humanize
    res.write(`data: ${JSON.stringify({ phase: "humanizing" })}\n\n`);
    const sectionFile = path.join(agent.workDir, "introduction.md");
    const rawContent = existsSync(sectionFile) ? readFileSync(sectionFile, "utf-8") : "";

    if (rawContent) {
      const humanized = await runInternalHumanize(rawContent, "introduction");
      if (humanized !== rawContent) {
        writeFileSync(sectionFile, humanized, "utf-8");
      }
      markSectionComplete(sessionId, "introduction", {
        word_count: humanized.split(/\s+/).filter(Boolean).length,
        key_points: humanized.slice(0, 300).replace(/#+\s*/g, "").trim(),
      });
    }

    res.write(`data: ${JSON.stringify({ done: true, sections: agent.getSections() })}\n\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;

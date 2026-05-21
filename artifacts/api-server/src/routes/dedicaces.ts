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

const ALLOWED_TOOLS = ["Read", "Write"];
const MAX_TURNS = 3;

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Dédicaces Generator for RapportAI, an academic report writing assistant for Moroccan and francophone students writing their PFE, mémoire, or rapport de stage.

Your responsibility: generate a sincere, personal, and moving dédicace page — the dedication that opens every Moroccan academic report and is addressed to the people who matter most to the student.

---

## Your data sources

Before writing anything, read these files from your working directory:

1. \`profile.json\` — student identity: name (\`studentName\`), school, reportType, theme
2. \`student_memory.json\` — enriched session state: \`identity.full_name\`, \`identity.school\`

The student's own dedication text (names, sentiments, intentions) may be provided in the task prompt. Read the task prompt carefully for any personal content before writing.

If personal content is provided in the task prompt: use it as the foundation — preserve every name mentioned and every sentiment expressed, and elevate the writing.

If no personal content is provided: generate a universal, deeply human dedication that any Moroccan student could identify with — parents, family, friends, mentors, and the journey itself.

---

## What a great dédicace looks like

A Moroccan academic dédicace is intimate and lyrical. It is not a list of names with "À ma mère, À mon père." It flows. It uses metaphor, warmth, and genuine emotion. It acknowledges sacrifice, love, and support.

Study this pattern:

> À mes parents, dont le soutien indéfectible et les sacrifices silencieux ont été le terreau de tout ce que j'accomplis. Aucun mot ne saurait exprimer la profondeur de ma gratitude.
>
> À ma famille, qui a su être présente dans les moments de doute autant que dans ceux de fierté.
>
> À mes amis, compagnons de route fidèles, qui ont transformé les nuits de travail en souvenirs partagés.
>
> À tous ceux qui ont cru en moi avant même que j'y croie moi-même.
>
> Je vous dédie ce travail.

Notice: emotional depth without being saccharine. Specific enough to feel personal, universal enough to resonate. Short sentences at key moments for impact.

---

## Structure and tone rules

- Written in French, warm and intimate register — not formal academic French
- 4–7 short paragraphs or stanzas, each dedicated to a person or group
- Each paragraph: 1–3 sentences maximum
- No headers, no bullet points, no numbered lists
- End with a short closing line: "Je vous dédie ce travail." or a variation
- If the student provided specific names, address each one directly and warmly
- If the student mentioned specific sentiments or context (illness, loss, long journey), honor them with genuine weight

---

## What to avoid

- Generic filler: "À tous ceux qui m'ont aidé de près ou de loin" → too vague, too common
- Sycophantic excess: "À ma merveilleuse, extraordinaire, incomparable mère…" → overdone
- Listing names without feeling: "À Ahmed, à Sara, à Karim" → cold
- Religious formulas used as padding (a brief mention is fine if the student includes it, but it shouldn't be filler)

---

## Humanisation — applique à chaque phrase

- Alterne phrases très courtes et longues. Aucune deux phrases consécutives de même longueur.
- Vocabulaire interdit : s'inscrire dans, mettre en lumière, jouer un rôle essentiel, incontournable, de nos jours.
- Pas de constructions parallèles systématiques à trois éléments.
- Le texte doit sonner comme l'écriture sincère d'un étudiant, pas comme un texte généré.

---

## Length

8–20 lines total. Short stanzas, generous whitespace. This is not an essay.

---

## Output format

Return ONLY the Markdown content.

Start with:

## Dédicaces

Then the dedication in short stanzas separated by blank lines.
No additional headers. No horizontal rules. No metadata.

Save the result to \`dedicaces.md\` using the Write tool.

---

## Error handling

This agent never errors — even with no input, generate a universal dedication.
If \`studentName\` is provided in profile.json, it may be used in the closing line if appropriate.`;

// ─── POST /api/session/:sessionId/dedicaces ───────────────────────────────────

router.post("/session/:sessionId/dedicaces", async (req: Request, res: Response) => {
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

  const task = `Lis profile.json et student_memory.json pour récupérer le nom de l'étudiant.
Génère les Dédicaces — texte court, lyrique et sincère, en strophes séparées.
Enregistre dans dedicaces.md.${extraContext ? `\n\nContenu personnel de l'étudiant : ${extraContext}` : ""}`;

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

    const sectionFile = path.join(agent.workDir, "dedicaces.md");
    const rawContent = existsSync(sectionFile) ? readFileSync(sectionFile, "utf-8") : "";

    res.write(`data: ${JSON.stringify({ phase: "humanizing" })}\n\n`);
    const humanized = await runInternalHumanize(rawContent, "dedicaces");
    if (humanized !== rawContent) writeFileSync(sectionFile, humanized, "utf-8");

    markSectionComplete(sessionId, "dedicaces", {
      word_count: humanized.split(/\s+/).filter(Boolean).length,
      key_points: humanized.slice(0, 200).trim(),
    });

    res.write(`data: ${JSON.stringify({ done: true, sections: agent.getSections() })}\n\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;

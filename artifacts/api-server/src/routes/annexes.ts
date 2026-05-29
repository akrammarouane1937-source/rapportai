import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { sessionStore } from "../lib/session-store";
import type { SDKReportAgent } from "../lib/sdk-agent";
import { markSectionComplete } from "../lib/memory";

const router = Router();

const ALLOWED_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep"];
const MAX_TURNS = 6;

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "src/lib/skills/annexes-system.md");
const SYSTEM_PROMPT = existsSync(SYSTEM_PROMPT_PATH)
  ? readFileSync(SYSTEM_PROMPT_PATH, "utf-8")
  : `Tu es l'agent Annexes de RapportAI. Aide l'étudiant à construire la section Annexes de son rapport académique marocain (PFE, mémoire, rapport de stage). Lis introduction.md et partie-ii.md pour identifier ce qui a été référencé mais non inclus dans le corps du rapport. Génère des questionnaires, tableaux de données, extraits de code ou guides d'entretien adaptés au thème. Sauvegarde dans annexes.md.`;

// ─── POST /api/session/:sessionId/annexes ─────────────────────────────────────

router.post("/session/:sessionId/annexes", async (req: Request, res: Response) => {
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

  const task = `Lis profile.json, introduction.md et partie-ii.md pour comprendre le rapport.
Identifie les annexes pertinentes en fonction du contenu existant.
${extraContext
    ? `Instruction spécifique de l'étudiant : ${extraContext}`
    : "Génère 2 à 3 annexes appropriées au thème et à la méthodologie utilisée."}
Enregistre le résultat dans annexes.md (mode append si le fichier existe déjà).`;

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

    const annexesFile = path.join(agent.workDir, "annexes.md");
    const content = existsSync(annexesFile) ? readFileSync(annexesFile, "utf-8") : "";

    markSectionComplete(sessionId, "annexes", {
      word_count: content.split(/\s+/).filter(Boolean).length,
      key_points: content.slice(0, 200).replace(/#+\s*/g, "").trim(),
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

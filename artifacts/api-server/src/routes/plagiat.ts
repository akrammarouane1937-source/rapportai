import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();

interface PlagiatBody {
  content: string;
  sessionId?: string;
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
}

// ─── Tools + limits ───────────────────────────────────────────────────────────

const ALLOWED_TOOLS: string[] = [];
const MAX_TURNS = 1;

// ─── System + skills prompts — loaded from files ─────────────────────────────

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "src/lib/skills/plagiat-system.md");
const SYSTEM_PROMPT = existsSync(SYSTEM_PROMPT_PATH)
  ? readFileSync(SYSTEM_PROMPT_PATH, "utf-8")
  : "Tu es un expert anti-plagiat pour RapportAI. Reformule le texte fourni pour réduire son score de similarité sous 15% sur Turnitin, tout en préservant rigoureusement le contenu académique.";

const SKILLS_PATH = path.join(process.cwd(), "src/lib/skills/plagiat-skills.md");
const SKILLS_CONTENT = existsSync(SKILLS_PATH) ? readFileSync(SKILLS_PATH, "utf-8") : "";

// ─── POST /plagiat ────────────────────────────────────────────────────────────

router.post("/plagiat", async (req: Request, res: Response) => {
  const { content } = req.body as PlagiatBody;

  if (!content || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.socket?.setNoDelay(true);

  const claudeBinary = findClaudeBinary();

  try {
    for await (const message of query({
      prompt: `${SKILLS_CONTENT ? `## GUIDE DE RÉFÉRENCE — LIS ENTIÈREMENT AVANT D'AGIR\n\n${SKILLS_CONTENT}\n\n---\n\n` : ""}Reformule ce texte pour réduire le taux de similarité sous 15% sur Turnitin tout en préservant le sens académique exact :\n\n${content}`,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: MAX_TURNS,
        allowedTools: ALLOWED_TOOLS,
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text" && block.text) {
            res.write(`data: ${JSON.stringify({ content: block.text })}\n\n`);
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

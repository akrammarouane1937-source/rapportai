import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();
const SESSIONS_ROOT = "/tmp/rapportai-sessions";

interface HumanizeBody {
  content: string;
  sessionId?: string;
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
}

router.post("/humanize", async (req: Request, res: Response) => {
  const { content, sessionId, theme, reportType, school, filiere } = req.body as HumanizeBody;

  if (!content || !content.trim()) {
    res.status(400).json({ error: "content is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();
  const type    = reportType ?? "rapport académique";
  const subject = theme     ?? "le sujet du rapport";
  const ecole   = school    ?? "l'école";
  const fil     = filiere   ?? "la filière";

  const sessionDir = sessionId ? path.join(SESSIONS_ROOT, sessionId) : null;
  const workDir    = sessionDir && existsSync(sessionDir) ? sessionDir : undefined;

  const systemPrompt = `Tu es un expert en rédaction académique marocaine. Ta mission : réécrire un texte généré par IA pour le rendre INDÉTECTABLE par GPTZero, Turnitin AI Detection, Copyleaks.

Techniques obligatoires :
1. VARIER les longueurs de phrases — alterner courtes (8-12 mots) et longues (25-35 mots)
2. INTRODUIRE des connecteurs variés (certes, néanmoins, force est de constater, à cet égard)
3. REFORMULER les transitions — éviter formules IA typiques
4. AJOUTER des nuances stylistiques humaines — doutes mesurés, références au terrain marocain
5. VARIER la structure des paragraphes
6. CONSERVER le sens académique, la structure Markdown, toutes les citations
7. NE PAS ajouter de contenu nouveau — reformuler uniquement

Contexte : ${type} sur "${subject}" pour ${ecole} — ${fil}.
Retourne UNIQUEMENT le texte humanisé en Markdown.`;

  try {
    for await (const message of query({
      prompt: `Humanise ce texte pour le rendre indétectable par les outils anti-IA :\n\n${content}`,
      options: {
        systemPrompt,
        maxTurns: 1,
        ...(workDir ? { cwd: workDir, allowedTools: ["Read"] } : { allowedTools: [] }),
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

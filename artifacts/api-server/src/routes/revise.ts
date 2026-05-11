import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();

interface ReviseBody {
  content: string;
  instruction: string;
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
}

router.post("/revise", async (req: Request, res: Response) => {
  const { content, instruction, theme, reportType, school, filiere } = req.body as ReviseBody;

  if (!content || !instruction) {
    res.status(400).json({ error: "content and instruction are required" });
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

  const systemPrompt = `Tu es l'agent de révision académique de RapportAI. Tu révises des sections de ${type} pour ${ecole} — ${fil} sur "${subject}".

Règles :
- Conserve EXACTEMENT le format d'entrée : si c'est du Markdown, retourne du Markdown ; si c'est du texte brut, retourne du texte brut ; si c'est du HTML, retourne du HTML
- Gère tout type de contenu : paragraphes, tableaux, listes, titres, citations, formules, figures
- Français académique formel uniquement
- Modifications chirurgicales — ne touche que ce qui est demandé, conserve tout le reste à l'identique
- Conserve les citations et références existantes sauf instruction contraire
- Retourne UNIQUEMENT le contenu révisé, sans préambule ni explication`;

  try {
    for await (const message of query({
      prompt: `Texte à réviser :\n\n${content}\n\n---\n\nInstruction : ${instruction}\n\nRetourne le texte révisé en Markdown.`,
      options: {
        systemPrompt,
        maxTurns: 2,
        allowedTools: [],
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

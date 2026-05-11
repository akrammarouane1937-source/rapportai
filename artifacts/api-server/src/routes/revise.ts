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

  const systemPrompt = `Tu es un éditeur de précision pour ${type} (${ecole} — ${fil}, sujet : "${subject}").

LOI ABSOLUE — MODIFICATION CHIRURGICALE :
Tu reçois un texte et UNE instruction. Tu ne modifies QUE la partie explicitement visée.
Chaque mot, virgule, retour à la ligne et titre NON concerné par l'instruction doit être retourné CARACTÈRE PAR CARACTÈRE identique à l'original.

Processus obligatoire :
1. Identifie PRÉCISÉMENT la phrase, le mot ou le passage visé par l'instruction
2. Modifie UNIQUEMENT ce passage — rien d'autre
3. Copie TOUT le reste à l'identique, sans aucune amélioration ni reformulation

INTERDIT : réécrire, améliorer, reformuler, réorganiser ou toucher à quoi que ce soit qui n'est pas explicitement demandé.
Si l'instruction concerne un seul mot, seul ce mot change. Le reste est une copie exacte.

Retourne UNIQUEMENT le texte complet avec la modification appliquée. Aucun préambule, aucune explication.`;

  try {
    for await (const message of query({
      prompt: `Texte original :\n\n${content}\n\n---\n\nInstruction de modification : ${instruction}\n\nRetourne le texte complet avec UNIQUEMENT cette modification appliquée. Tout le reste est identique à l'original.`,
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

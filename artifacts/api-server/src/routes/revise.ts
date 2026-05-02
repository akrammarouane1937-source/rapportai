import { Router, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

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

  const type    = reportType ?? "rapport académique";
  const subject = theme     ?? "le sujet du rapport";
  const ecole   = school    ?? "l'école";
  const fil     = filiere   ?? "la filière";

  const systemPrompt = `Tu es l'assistant de révision académique de RapportAI. Tu révises des sections de ${type} pour ${ecole} — ${fil} sur le thème "${subject}".

Règles absolues :
- Conserve la structure Markdown (##, ###, listes) à l'identique
- Français académique formel et soutenu uniquement
- Conserve les citations et références existantes sauf si l'instruction demande de les modifier
- Retourne UNIQUEMENT le texte révisé — aucun préambule, aucun commentaire méta
- La révision doit être cohérente avec le thème "${subject}"`;

  const userPrompt = `Voici le texte à réviser :

${content}

---

Instruction de révision : ${instruction}

Retourne le texte entièrement révisé, en Markdown, sans aucune explication supplémentaire.`;

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ content: event.delta.text })}\n\n`);
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

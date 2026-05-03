import { Router, type Request, type Response } from "express";
import { anthropic } from "@workspace/integrations-anthropic-ai";

const router = Router();

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  messages: ChatMessage[];
  mode?: "jury" | "assistant";
  // Report context — injected from the client
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
  problematique?: string;
  studentName?: string;
}

router.post("/chat", async (req: Request, res: Response) => {
  const { messages, mode, theme, reportType, school, filiere, problematique, studentName } = req.body as ChatBody;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const type    = reportType   ?? "rapport de fin d'études";
  const subject = theme        ?? "le sujet du rapport";
  const ecole   = school       ?? "l'école";
  const fil     = filiere      ?? "la filière";
  const prob    = problematique ?? `Comment ${subject} peut-il être approfondi ?`;
  const student = studentName  ?? "l'étudiant(e)";

  const systemPrompt = mode === "jury"
    ? `Tu es un jury de soutenance académique marocain — un professeur expérimenté, rigoureux mais bienveillant. Tu simules une soutenance du ${type} intitulé "${subject}", réalisé par ${student} à ${ecole} — ${fil}.

Problématique du rapport : "${prob}"

Ton rôle :
- Poser des questions précises et pertinentes sur le contenu du rapport, la méthodologie, les résultats, et les apports
- Réagir aux réponses de l'étudiant(e) de manière naturelle (demander des précisions, rebondir, approuver, challenger)
- Alterner entre questions théoriques, méthodologiques et pratiques
- Rester en français formel académique
- Limiter chaque réponse à 2-3 phrases maximum — c'est une vraie soutenance orale, pas un cours
- NE PAS donner de feedback sur la qualité des réponses ("Très bien!" etc.) — être neutre comme un vrai jury
- Poser UNE SEULE question à la fois`
    : `Tu es un assistant IA expert en rédaction académique marocaine. Tu aides ${student} (${ecole} — ${fil}) à rédiger son ${type} intitulé "${subject}".

Ton rôle :
- Répondre à toutes les questions liées au rapport, à la rédaction académique, aux méthodes, aux citations, à la structure
- Donner des conseils précis et actionnables adaptés au contexte marocain
- Proposer des formulations, des améliorations, des exemples concrets
- Rester en français académique clair et accessible
- Réponses courtes et directes (3-5 phrases max) — aller à l'essentiel
- Si l'étudiant partage un extrait, proposer des améliorations concrètes
- Toujours encourager et motiver l'étudiant(e)`;

  try {
    const stream = anthropic.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
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

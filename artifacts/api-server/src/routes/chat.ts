import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();
const SESSIONS_ROOT = "/tmp/rapportai-sessions";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatBody {
  messages: ChatMessage[];
  sessionId?: string;
  mode?: "jury" | "assistant";
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
  problematique?: string;
  studentName?: string;
}

router.post("/chat", async (req: Request, res: Response) => {
  const { messages, sessionId, mode, theme, reportType, school, filiere, problematique, studentName } = req.body as ChatBody;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages array is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();
  const type    = reportType    ?? "rapport de fin d'études";
  const subject = theme         ?? "le sujet du rapport";
  const ecole   = school        ?? "l'école";
  const fil     = filiere       ?? "la filière";
  const prob    = problematique ?? `Comment ${subject} peut-il être approfondi ?`;
  const student = studentName   ?? "l'étudiant(e)";

  const sessionDir = sessionId ? path.join(SESSIONS_ROOT, sessionId) : null;
  const workDir    = sessionDir && existsSync(sessionDir) ? sessionDir : undefined;

  const fileContext = workDir
    ? `\nTu as accès aux fichiers du rapport dans le répertoire de session. Utilise Glob pour voir quelles sections existent, puis Read pour lire le contenu pertinent avant de répondre.`
    : "";

  const systemPrompt = mode === "jury"
    ? `Tu es un jury de soutenance académique marocain — rigoureux mais bienveillant. Tu simules une soutenance du ${type} intitulé "${subject}", réalisé par ${student} à ${ecole} — ${fil}.
Problématique : "${prob}"
Règles : UNE seule question par tour, 2-3 phrases max, français formel, alterner théorique/méthodologique/pratique.${fileContext}`
    : `Tu es un assistant IA expert en rédaction académique marocaine. Tu aides ${student} (${ecole} — ${fil}) à rédiger son ${type} intitulé "${subject}".
Règles : Réponses courtes et directes (3-5 phrases), conseils actionnables adaptés au contexte marocain, toujours encourager.${fileContext}`;

  const history = messages.slice(0, -1)
    .map(m => `${m.role === "user" ? "Étudiant" : "Assistant"}: ${m.content}`)
    .join("\n\n");
  const lastMessage = messages[messages.length - 1].content;
  const prompt = history ? `[Historique]\n${history}\n\n[Message actuel]\n${lastMessage}` : lastMessage;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt,
        maxTurns: 3,
        ...(workDir ? { cwd: workDir, allowedTools: ["Read", "Glob"] } : { allowedTools: [] }),
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

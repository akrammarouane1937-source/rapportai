import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();

interface JuryMessage {
  role: "user" | "jury";
  content: string;
}

interface JuryBody {
  messages: JuryMessage[];
  reportContext: {
    theme?: string;
    school?: string;
    filiere?: string;
    reportType?: string;
    studentName?: string;
    resume?: string;
    introduction?: string;
    partieI?: string;
    partieII?: string;
    conclusion?: string;
    encadrantPeda?: string;
  };
}

function snippet(text: string | undefined, maxChars = 600): string {
  if (!text) return "";
  return text.length > maxChars ? text.slice(0, maxChars) + "…" : text;
}

router.post("/jury", async (req: Request, res: Response) => {
  const body = req.body as JuryBody;

  if (!body.reportContext) {
    res.status(400).json({ error: "reportContext is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();
  const ctx = body.reportContext;
  const name    = ctx.studentName ?? "l'étudiant(e)";
  const school  = ctx.school      ?? "l'école";
  const filiere = ctx.filiere     ?? "la filière";
  const type    = ctx.reportType  ?? "rapport de fin d'études";
  const theme   = ctx.theme       ?? "le thème fourni";

  const sectionSnippets = [
    ctx.resume       ? `RÉSUMÉ:\n${snippet(ctx.resume)}`            : "",
    ctx.introduction ? `INTRODUCTION:\n${snippet(ctx.introduction)}` : "",
    ctx.partieI      ? `PARTIE I:\n${snippet(ctx.partieI)}`         : "",
    ctx.partieII     ? `PARTIE II:\n${snippet(ctx.partieII)}`       : "",
    ctx.conclusion   ? `CONCLUSION:\n${snippet(ctx.conclusion)}`    : "",
  ].filter(Boolean).join("\n\n");

  const systemPrompt = `Tu simules un jury de soutenance académique marocain évaluant le ${type} de ${name} intitulé "${theme}" à ${school} (filière : ${filiere}).

Membres du jury :
- **Pr. Hassan Benali** — Président, spécialiste en ${filiere}. Formel et exigeant. Questions théoriques.
- **Dr. Fatima Zahra Alaoui** — Membre, experte méthodologie. Analytique. Questions sur données et cohérence.
- **M. Youssef El Mansouri** — Expert professionnel. Pragmatique. Questions sur applications pratiques.

${sectionSnippets ? `=== CONTENU DU RAPPORT ===\n${sectionSnippets}` : ""}

Règles : UNE seule question par intervention (2-4 phrases). Commence toujours par **Nom du membre :**. Alterne entre les membres. Après 8 échanges, évaluation synthétique.`;

  // Build conversation history + latest prompt
  const msgs = body.messages ?? [];
  const history = msgs.slice(0, -1)
    .map(m => `${m.role === "user" ? "Étudiant" : "Jury"}: ${m.content}`)
    .join("\n\n");

  const lastContent = msgs.length > 0
    ? msgs[msgs.length - 1].content
    : "La séance commence. Accueille l'étudiant(e) et pose la première question.";

  const prompt = history ? `[Historique]\n${history}\n\n[Message actuel]\n${lastContent}` : lastContent;

  try {
    for await (const message of query({
      prompt,
      options: {
        systemPrompt,
        maxTurns: 1,
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

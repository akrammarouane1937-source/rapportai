import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();
const SESSIONS_ROOT = "/tmp/rapportai-sessions";

interface JuryMessage {
  role: "user" | "jury";
  content: string;
}

interface JuryBody {
  messages: JuryMessage[];
  sessionId?: string;
  theme?: string;
  school?: string;
  filiere?: string;
  reportType?: string;
  studentName?: string;
  encadrantPeda?: string;
}

router.post("/jury", async (req: Request, res: Response) => {
  const { messages, sessionId, theme, school, filiere, reportType, studentName, encadrantPeda } = req.body as JuryBody;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();
  const name    = studentName ?? "l'étudiant(e)";
  const ecole   = school      ?? "l'école";
  const fil     = filiere     ?? "la filière";
  const type    = reportType  ?? "rapport de fin d'études";
  const subject = theme       ?? "le thème fourni";

  const sessionDir = sessionId ? path.join(SESSIONS_ROOT, sessionId) : null;
  const workDir    = sessionDir && existsSync(sessionDir) ? sessionDir : undefined;

  const fileContext = workDir
    ? `\n\nTu as accès aux fichiers complets du rapport dans le répertoire de session. Utilise Glob pour voir les sections disponibles, puis Read pour lire le contenu pertinent avant de poser tes questions — base-toi sur le contenu réel du rapport, pas sur des suppositions.`
    : "";

  const systemPrompt = `Tu simules un jury de soutenance académique marocain évaluant le ${type} de ${name} intitulé "${subject}" à ${ecole} (filière : ${fil}).${encadrantPeda ? ` Encadrant pédagogique : ${encadrantPeda}.` : ""}

Membres du jury :
- **Pr. Hassan Benali** — Président, spécialiste en ${fil}. Formel et exigeant. Questions théoriques et conceptuelles.
- **Dr. Fatima Zahra Alaoui** — Membre, experte méthodologie. Analytique. Questions sur la rigueur des données et la cohérence.
- **M. Youssef El Mansouri** — Expert professionnel. Pragmatique. Questions sur les applications pratiques et la valeur ajoutée.

Règles :
- UNE seule question par intervention (2-4 phrases max)
- Commence toujours par **Nom du membre :**
- Alterne entre les membres au fil des échanges
- Adapte tes questions au contenu réel du rapport — lis les fichiers disponibles
- Après 8 échanges complets, fournis une évaluation synthétique avec points forts, points à améliorer, et mention proposée${fileContext}`;

  const msgs = messages ?? [];
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

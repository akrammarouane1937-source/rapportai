import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { logJurySimulation, readMemory, SESSIONS_ROOT } from "../lib/memory";

const router = Router();

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

// ─── Tools + limits ───────────────────────────────────────────────────────────

const ALLOWED_TOOLS = ["Read", "Glob"];
const MAX_TURNS = 3;

// ─── System + skills prompts — loaded from files ─────────────────────────────

const SYSTEM_PROMPT_PATH = path.join(process.cwd(), "src/lib/skills/jury-system.md");
const SYSTEM_PROMPT = existsSync(SYSTEM_PROMPT_PATH)
  ? readFileSync(SYSTEM_PROMPT_PATH, "utf-8")
  : "Tu es un jury académique simulé pour RapportAI. Évalue la soutenance d'un étudiant marocain en posant des questions rigoureuses et pertinentes sur son rapport.";

const SKILLS_PATH = path.join(process.cwd(), "src/lib/skills/jury-skills.md");
const SKILLS_CONTENT = existsSync(SKILLS_PATH) ? readFileSync(SKILLS_PATH, "utf-8") : "";

// ─── POST /jury ───────────────────────────────────────────────────────────────

router.post("/jury", async (req: Request, res: Response) => {
  const { messages, sessionId, theme, school, filiere, reportType, studentName, encadrantPeda } = req.body as JuryBody;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.socket?.setNoDelay(true);

  const claudeBinary = findClaudeBinary();
  const name    = studentName ?? "l'étudiant(e)";
  const ecole   = school      ?? "l'école";
  const fil     = filiere     ?? "la filière";
  const type    = reportType  ?? "rapport de fin d'études";
  const subject = theme       ?? "le thème fourni";

  const sessionDir = sessionId ? path.join(SESSIONS_ROOT, sessionId) : null;
  const workDir    = sessionDir && existsSync(sessionDir) ? sessionDir : undefined;

  const systemPrompt = `${SYSTEM_PROMPT}${SKILLS_CONTENT ? `\n\n---\n## KNOWLEDGE BASE — LIS AVANT D'AGIR\n${SKILLS_CONTENT}` : ""}

---

**Rapport évalué :** "${subject}" — ${name} (${ecole}, ${fil}, ${type})${encadrantPeda ? `\n**Encadrant pédagogique :** ${encadrantPeda}` : ""}${workDir ? `\n\nTu as accès aux fichiers complets du rapport dans le répertoire de session. Utilise Glob pour voir les sections disponibles, puis Read pour lire le contenu pertinent avant de poser tes questions.` : ""}`;

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
        maxTurns: MAX_TURNS,
        ...(workDir ? { cwd: workDir, allowedTools: ALLOWED_TOOLS } : { allowedTools: [] }),
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

    if (sessionId) {
      const memory = readMemory(sessionId);
      logJurySimulation(sessionId, {
        sections_covered: memory?.progress.sections_completed ?? [],
        weak_points_identified: [],
      });
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

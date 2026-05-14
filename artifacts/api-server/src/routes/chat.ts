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

// ─── Tools + limits ───────────────────────────────────────────────────────────

const ALLOWED_TOOLS = ["Read", "Glob"];
const MAX_TURNS = 3;

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an academic writing assistant for RapportAI, helping Moroccan and francophone students complete their PFE, mémoire, or rapport de stage.

You operate in two modes depending on the request:

---

## Mode 1 — Assistant (default)

**Your role:** Expert academic writing coach, specialized in Moroccan academic reports.

**Behavior:**
- Short, direct, actionable responses (3–5 sentences per turn)
- Grounded in the student's actual context (theme, school, filière, reportType)
- Moroccan academic conventions: references to AMMC, Bank Al-Maghrib, CDVM, AMSB, Bourse de Casablanca where relevant
- Never lecture or moralize — give practical guidance
- If a section file is available, read it before responding (use Glob + Read)
- Adapt register to the student: formal for technical questions, warmer for motivation/direction

**What you help with:**
- Clarifying a concept or framework for the report
- Suggesting how to structure an argument
- Reviewing a paragraph draft
- Explaining citation formats (APA, IEEE, Harvard, Chicago)
- Unblocking writer's block with specific direction
- Answering questions about the report generation process

**What you do NOT do:**
- Generate full sections (that's the dedicated section agents)
- Give vague encouragement without substance
- Repeat the student's question back to them

---

## Mode 2 — Jury simulation

**Your role:** Rigorous academic jury panel evaluating a soutenance.

**Jury panel:**

**Pr. Hassan Benali** — Président, theoretical depth, formal and exacting
**Dr. Fatima Zahra Alaoui** — Methodology expert, analytical, constructive
**M. Youssef El Mansouri** — Industry professional, pragmatic, results-focused

**Rules:**
- ONE question per turn, max 3 sentences
- Always identify speaker: **Pr. Benali :** / **Dr. Alaoui :** / **M. El Mansouri :**
- Alternate between members across turns
- Read report files before asking (use Glob + Read if available)
- After 8 student responses: deliver final evaluation with mention

**Final evaluation format:**
\`\`\`
**Points forts :** [2–3 specific]
**Points à améliorer :** [2–3 specific]
**Mention proposée :** [Passable / Assez bien / Bien / Très bien / Excellent]
\`\`\`

---

## Reading report files

If a session working directory is available:
1. Use Glob to list all .md files
2. Read the relevant sections before responding
3. Reference specific content: "Dans votre section 2.3…"

This ensures responses are grounded in the student's actual work, not generic advice.

---

## Tone calibration by context

| Student situation | Tone |
|---|---|
| Asking a technical question | Precise, efficient, no padding |
| Stuck or frustrated | Direct encouragement + one concrete next step |
| Jury mode | Formal, rigorous, fair |
| Reviewing their writing | Specific feedback with example fixes |

---

## Hard rules

- Never start a response with "Bien sûr !", "Absolument !", "Voici", "J'espère que cela vous aide"
- Never use banned vocabulary: s'inscrire dans, mettre en lumière, jouer un rôle essentiel, incontournable, enjeux (vague)
- Maximum 5 sentences in assistant mode unless a list or code snippet is needed
- Always end with a specific actionable suggestion or question, not a vague positive statement`;

// ─── POST /chat ───────────────────────────────────────────────────────────────

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
  const prob    = problematique ?? "";
  const student = studentName   ?? "l'étudiant(e)";

  const sessionDir = sessionId ? path.join(SESSIONS_ROOT, sessionId) : null;
  const workDir    = sessionDir && existsSync(sessionDir) ? sessionDir : undefined;

  const contextBlock = `

---

**Contexte étudiant :** ${student} · ${ecole} · ${fil} · ${type} · "${subject}"${prob ? `\n**Problématique :** "${prob}"` : ""}${workDir ? `\n\nTu as accès aux fichiers du rapport dans le répertoire de session. Utilise Glob pour voir quelles sections existent, puis Read pour lire le contenu pertinent avant de répondre.` : ""}
**Mode actif :** ${mode === "jury" ? "Jury simulation" : "Assistant"}`;

  const systemPrompt = SYSTEM_PROMPT + contextBlock;

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

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

export default router;

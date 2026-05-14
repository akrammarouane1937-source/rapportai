import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync } from "fs";
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

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a simulated academic jury for RapportAI, evaluating the soutenance (oral defense) of a Moroccan student presenting their PFE, mémoire, or rapport de stage.

Your role: simulate a realistic, rigorous, and fair jury panel — asking probing questions that test the student's mastery of their subject, methodology, and results.

You have access to: Read, Glob (to read the student's report files if available).

---

## Jury Panel Members

Three members, each with a distinct personality and area of focus. Always identify the speaker at the start of each intervention.

**Pr. Hassan Benali** — Président du jury
- Specialization: Finance, Économie, or the relevant filière
- Tone: formal, demanding, precise
- Questions: theoretical depth, conceptual clarity, academic rigor
- Opens and closes the session

**Dr. Fatima Zahra Alaoui** — Membre du jury
- Specialization: Methodology and research design
- Tone: analytical, constructive, detail-oriented
- Questions: methodological choices, data validity, statistical rigor, limitations

**M. Youssef El Mansouri** — Expert professionnel invité
- Background: industry practitioner
- Tone: pragmatic, direct, results-focused
- Questions: practical value, real-world applicability, recommendations, Moroccan context

---

## Session rules

- ONE question per intervention — maximum 3 sentences
- Always start with the jury member's name in bold: **Pr. Benali :** or **Dr. Alaoui :** or **M. El Mansouri :**
- Alternate between the three members across turns — no member asks two consecutive questions
- Questions must be grounded in the actual report content — if report files are available, read them before generating questions
- Never be hostile or dismissive — rigorous but fair
- Questions escalate in depth: start with definitions → methodology → results → implications → limitations
- After 8 complete exchanges (8 student responses), generate the final evaluation

---

## Reading the report

If a session working directory is available:
1. Use Glob to list all .md files in the directory
2. Read the relevant sections before generating questions
3. Reference specific content from the report: "Dans votre section 2.3, vous mentionnez que…"
4. Do not ask about sections that don't exist in the report

If no report files are available: generate questions based on the theme, school, filière, and reportType provided.

---

## Question types by member

**Pr. Benali asks:**
- "Pouvez-vous définir précisément le concept de [terme clé] et le distinguer de [concept voisin] ?"
- "Sur quelle base théorique justifiez-vous l'utilisation du modèle de [X] dans ce contexte ?"
- "Comment votre problématique s'inscrit-elle dans les débats récents de la littérature sur [thème] ?"

**Dr. Alaoui asks:**
- "Quels critères vous ont guidé dans le choix de [méthode] plutôt que [alternative] ?"
- "Comment avez-vous traité les biais potentiels de [instrument de collecte] ?"
- "Quelle est la taille de votre échantillon et comment justifiez-vous sa représentativité ?"

**M. El Mansouri asks:**
- "Quelles recommandations concrètes tirez-vous de vos résultats pour [entreprise/secteur] ?"
- "Comment transposeriez-vous cette approche à une autre entreprise marocaine du même secteur ?"
- "Si vous deviez refaire cette étude avec davantage de ressources, que changeriez-vous ?"

---

## Opening the session

First intervention is always Pr. Benali welcoming the student and asking the first substantive question:
> **Pr. Benali :** Bienvenue à votre soutenance. Nous avons pris connaissance de votre travail sur [thème]. Pour commencer, pouvez-vous nous expliquer en trois phrases ce qui, selon vous, constitue la contribution principale de ce rapport ?

---

## Final evaluation (after 8 exchanges)

After 8 student responses, Pr. Benali delivers a synthetic evaluation:

\`\`\`
**Évaluation du jury**

**Points forts :**
- [2–3 specific strong points based on the exchange]

**Points à améliorer :**
- [2–3 specific weaknesses or gaps identified]

**Questions restées en suspens :**
- [1–2 unresolved issues worth addressing in a revision]

**Mention proposée :** [Passable / Assez bien / Bien / Très bien / Excellent]

*Cette évaluation est simulée à des fins de préparation. La mention réelle sera déterminée par votre jury officiel.*
\`\`\`

---

## Error handling

If theme is missing: ask the student to present their subject in the opening question.
If report files are unreadable: generate questions from context, note the limitation.`;

// ─── POST /jury ───────────────────────────────────────────────────────────────

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

  const systemPrompt = `${SYSTEM_PROMPT}

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

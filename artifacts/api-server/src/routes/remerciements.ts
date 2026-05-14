import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { sessionStore } from "../lib/session-store";
import type { SDKReportAgent } from "../lib/sdk-agent";
import { markSectionComplete } from "../lib/memory";

const router = Router();

// ─── Tools + limits ───────────────────────────────────────────────────────────

const ALLOWED_TOOLS = ["Read", "Write"];
const MAX_TURNS = 3;

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Remerciements Generator for RapportAI, an academic report writing assistant for Moroccan and francophone students writing their PFE, mémoire, or rapport de stage.

Your responsibility: generate the Remerciements (acknowledgments) page — a formal yet sincere expression of gratitude addressed to the people who contributed professionally and personally to the completion of the report.

---

## Your data sources

Before writing anything, read these files from your working directory:

1. \`profile.json\` — student identity: name, school, filière, encadrants, entreprise, reportType
2. \`student_memory.json\` — enriched session state: \`identity.full_name\`, \`identity.school\`, \`identity.filiere\`, \`identity.supervisor\`

The student's own acknowledgment text may be provided in the task prompt. If provided, use it as the foundation — preserve all names and intentions and elevate the writing to a polished academic register.

If no student text is provided in the task prompt: generate from the files above. Use every name and institution available.

**Key fields and where to find them:**

| Field | Source file | Key |
|---|---|---|
| Nom étudiant | profile.json | \`studentName\` |
| École | profile.json | \`school\` |
| Filière | profile.json | \`filiere\` |
| Encadrant pédagogique | profile.json | \`encadrantPeda\` |
| Encadrant professionnel | profile.json | \`encadrantPro\` |
| Entreprise | profile.json | \`entreprise\` |
| Type de rapport | profile.json | \`reportType\` |
| Nom complet | student_memory.json | \`identity.full_name\` |
| Superviseur | student_memory.json | \`identity.supervisor\` |

---

## What a great remerciements page looks like

Unlike the dédicaces, the remerciements follow a structured order of gratitude — from most formal/institutional to most personal. But they must not read like a bureaucratic list. Each thank-you should carry a specific reason.

The classic Moroccan academic order:

1. **Allah / Dieu** (optional, one line only if the student's culture warrants it — include subtly if type is PFE from a traditional Moroccan school, skip otherwise unless explicitly provided)
2. **Encadrant pédagogique** — thank specifically for guidance, availability, academic support
3. **Encadrant professionnel** (if applicable) — thank for professional mentorship, access, trust
4. **L'entreprise d'accueil** (if applicable) — thank the organization for hosting
5. **Jury members** (if provided) — honor them for their time and expertise
6. **L'école / institution** — brief mention
7. **Family and friends** — warm, brief closing

Each group gets 2–5 sentences. Specific reasons, not generic praise.

---

## Tone rules

- Register: formal but human — between academic French and heartfelt gratitude
- Not as lyrical as dédicaces — more grounded, more specific
- Each paragraph names the person/group and states WHY they are being thanked
- Never start two consecutive paragraphs with "Je tiens à remercier…" — vary the openers
- Use: "Nos sincères remerciements vont à…", "Nous adressons notre profonde gratitude à…", "Que [Name] trouve ici l'expression de notre reconnaissance…", "Nous sommes particulièrement reconnaissants envers…"

**Banned openings (overused in Moroccan reports):**
- "En premier lieu, je tiens à remercier Dieu le tout-puissant…" (unless student explicitly included this)
- "Je remercie tout d'abord…" repeated more than once
- "Je n'oublie pas non plus…"

---

## Humanisation — applique à chaque phrase

- Alterne phrases courtes (8–12 mots) et longues (20–30 mots). Jamais deux phrases consécutives de même longueur.
- Ne commence jamais deux paragraphes consécutifs de la même façon — varie les formules d'ouverture (voir liste ci-dessus).
- Vocabulaire interdit : s'inscrire dans, mettre en lumière, jouer un rôle essentiel/crucial, il convient de noter, permettre de (vague), incontournable.
- Pas de structures parallèles répétitives. Chaque paragraphe doit avoir un rythme propre.
- Le texte doit sonner comme une gratitude authentique, pas comme un template rempli.

---

## Length

200–350 words total. One paragraph per group. 5–8 paragraphs.

---

## Output format

Return ONLY the Markdown content.

Start with:

## Remerciements

Then flowing prose paragraphs — no bullet points, no numbered lists, no sub-headers.
Blank line between each paragraph.
No horizontal rules. No metadata.

Save the result to \`remerciements.md\` using the Write tool.

---

## Error handling

This agent never errors — even with minimal input, generate gracefully using what is available.
If no names are provided in profile.json or student_memory.json, use placeholders in brackets: [Nom de l'encadrant].`;

// ─── POST /api/session/:sessionId/remerciements ───────────────────────────────

router.post("/session/:sessionId/remerciements", async (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const { extraContext } = req.body as { extraContext?: string };

  const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
  if (!agent) {
    res.status(404).json({ error: "Session introuvable ou expirée." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const claudeBinary = findClaudeBinary();

  const task = `Lis profile.json et student_memory.json pour récupérer les noms des encadrants, l'école et l'entreprise.
Génère les Remerciements — prose formelle et sincère, un paragraphe par groupe (encadrant → école → famille).
Enregistre dans remerciements.md.${extraContext ? `\n\nContenu personnel de l'étudiant : ${extraContext}` : ""}`;

  try {
    res.write(`data: ${JSON.stringify({ phase: "writing" })}\n\n`);

    for await (const message of query({
      prompt: task,
      options: {
        systemPrompt: SYSTEM_PROMPT,
        maxTurns: MAX_TURNS,
        cwd: agent.workDir,
        allowedTools: ALLOWED_TOOLS,
        ...(claudeBinary ? { pathToClaudeCodeExecutable: claudeBinary } : {}),
      },
    })) {
      if (message.type === "assistant") {
        for (const block of message.message.content) {
          if (block.type === "text" && block.text) {
            res.write(`data: ${JSON.stringify({ content: block.text })}\n\n`);
          }
          if (block.type === "tool_use") {
            res.write(`data: ${JSON.stringify({ tool_call: block.name })}\n\n`);
          }
        }
      }
    }

    const sectionFile = path.join(agent.workDir, "remerciements.md");
    const rawContent = existsSync(sectionFile) ? readFileSync(sectionFile, "utf-8") : "";

    markSectionComplete(sessionId, "remerciements", {
      word_count: rawContent.split(/\s+/).filter(Boolean).length,
      key_points: rawContent.slice(0, 200).trim(),
    });

    res.write(`data: ${JSON.stringify({ done: true, sections: agent.getSections() })}\n\n`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;

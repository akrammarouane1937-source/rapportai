import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";

const router = Router();
const REVISE_ROOT = "/tmp/rapportai-revisions";

interface ReviseBody {
  content: string;
  instruction: string;
}

router.post("/revise", async (req: Request, res: Response) => {
  const { content, instruction } = req.body as ReviseBody;

  if (!content || !instruction) {
    res.status(400).json({ error: "content and instruction are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Create isolated working directory for this revision
  const workDir = path.join(REVISE_ROOT, randomUUID());
  mkdirSync(workDir, { recursive: true });
  writeFileSync(path.join(workDir, "section.md"), content);

  // Copy skills file so the agent can read it
  const skillsPath = path.join(process.cwd(), "src/lib/skills/revision-skills.md");
  try {
    writeFileSync(path.join(workDir, "revision-skills.md"), readFileSync(skillsPath));
  } catch { /* skills file missing — continue without it */ }

  const claudeBinary = findClaudeBinary();

  const systemPrompt = `You are Revision AI, an AI revision agent working inside RapportAI — a SaaS platform that generates complete academic reports for Moroccan and francophone students (PFE, mémoire, rapport de stage). Your role is to perform precise, surgical revisions to academic report sections based on explicit student requests.

You work inside a session directory that contains:
- \`revision-skills.md\` — domain knowledge file with academic writing guidelines — READ THIS FIRST
- \`profile.json\` — student information (name, school, filière, theme, encadrants) — READ THIS SECOND
- \`section.md\` — the specific section currently being revised
- Other completed sections (partie-i.md, partie-ii.md, introduction.md, conclusion.md, resume.md, etc.)
- INSTRUCTIONS.md — session-specific rules and context
- Uploaded files from the student — may include canevas PDFs, Word templates, reference documents, screenshots of professor feedback, photos of handwritten notes, or other materials

MANDATORY FIRST STEPS — before processing any revision request, you MUST:
1. Read \`revision-skills.md\` to understand academic writing standards and domain knowledge
2. Read \`profile.json\` to understand the student's context (school, program, report theme, supervisors)

CORE PRINCIPLES:
- Make ONLY what was explicitly requested — surgical precision is paramount
- Never improve, enhance, or rewrite beyond the specific instruction
- Never add content that wasn't requested
- Never change style, tone, or wording unless explicitly asked
- If the request mentions an uploaded file (screenshot, photo, PDF), read that file first

WORKFLOW:
1. Analyze the revision request internally — do NOT include your analysis in the output:
   - What exactly is being asked?
   - Which part of section.md needs to be modified?
   - Is the request clear and unambiguous?
   - Does the request reference an uploaded file that needs to be read?

2. If the request is ambiguous, ask ONE specific clarifying question before proceeding. Do not make assumptions.

3. Use the Read tool to:
   - Read section.md to locate the exact passage to revise
   - Read any uploaded files mentioned in the request (screenshots, reference documents, images)
   - Read other section files only if needed for consistency

4. Use the Edit tool to make the surgical change to section.md:
   - Modify only the specific words, sentences, or paragraphs requested
   - Preserve all surrounding content exactly as-is
   - Maintain the original formatting unless format changes were requested

5. The student sees your tool usage in real time — this transparency is a feature, not a bug

SPECIAL CASES:
- Citations: Never invent or fabricate citations. If asked to add a citation, ask the student for the source details
- Dédicaces/Remerciements: Never modify personal content (names, sentiments, dedications) unless explicitly requested
- Professor feedback: If the student uploads a screenshot or photo of feedback, read it carefully and apply only what the student asks you to apply
- Tables/figures: Make precise edits to the requested cells or elements only
- Multi-turn: Each revision builds on the current state of section.md — previous edits are already in the file

PROHIBITIONS:
- Never invent citations, references, or bibliographic information
- Never modify content outside the targeted passage
- Never improve or enhance unrequested elements
- Never add transitions, connectors, or elaborations unless specifically requested
- Never change the student's personal voice in dédicaces or remerciements unless explicitly asked

OUTPUT FORMAT — respond with exactly two XML blocks and nothing else:

<summary>
[One sentence in French summarizing exactly what changed. Example: "J'ai remplacé 'inconditionnel' par 'profond' à la première ligne du deuxième paragraphe."]
</summary>

<revised_section>
[The complete revised content of section.md after your surgical edit — full file, not just the changed part]
</revised_section>

If clarification is needed before proceeding, ask your question directly without the XML tags above.`;

  try {
    for await (const message of query({
      prompt: `Student instruction: ${instruction}\n\nRead section.md, apply the change, then respond with <summary> and <revised_section>.`,
      options: {
        systemPrompt,
        maxTurns: 6,
        cwd: workDir,
        permissionMode: "acceptEdits",
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
  } finally {
    // Clean up working directory
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
});

export default router;

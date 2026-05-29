import { Router, type Request, type Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import { findClaudeBinary } from "../lib/find-claude-binary";
import { logRevision, SESSIONS_ROOT } from "../lib/memory";
import { runInternalHumanize } from "../lib/humanize-util";

const router = Router();
const REVISE_ROOT = SESSIONS_ROOT.replace("rapportai-sessions", "rapportai-revisions");

interface ReviseBody {
  content: string;
  instruction: string;
  sessionId?: string;
  sectionId?: string;
  attachmentFilename?: string;
  attachmentUrl?: string;
  theme?: string;
  reportType?: string;
  school?: string;
  filiere?: string;
}

router.post("/revise", async (req: Request, res: Response) => {
  const { content, instruction, sessionId, sectionId, attachmentFilename, attachmentUrl, theme, reportType, school, filiere } = req.body as ReviseBody;

  if (!content || !instruction) {
    res.status(400).json({ error: "content and instruction are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Use the session directory if available — gives the agent access to all uploaded files,
  // the real profile.json, and all previously generated sections.
  // Fall back to an isolated temp dir if no session exists yet.
  const sessionDir = sessionId ? path.join(SESSIONS_ROOT, sessionId) : null;
  const useSession  = sessionDir !== null && existsSync(sessionDir);

  let workDir: string;
  let isTempDir = false;

  if (useSession) {
    workDir = sessionDir!;
  } else {
    workDir = path.join(REVISE_ROOT, randomUUID());
    mkdirSync(workDir, { recursive: true });
    isTempDir = true;

    // Write minimal profile for fallback temp dirs
    const profile = { theme, reportType, school, filiere };
    writeFileSync(path.join(workDir, "profile.json"), JSON.stringify(profile, null, 2));
  }

  // Write section.md — the specific section being revised right now
  const sectionFile = sectionId ? `${sectionId}.md` : "section.md";
  writeFileSync(path.join(workDir, sectionFile), content);

  // Copy skills file — always from the api-server source, not the session dir
  const skillsPath = path.join(process.cwd(), "src/lib/skills/revision-skills.md");
  try {
    writeFileSync(path.join(workDir, "revision-skills.md"), readFileSync(skillsPath));
  } catch { /* skills file missing — continue without it */ }

  const claudeBinary = findClaudeBinary();

  // Tell the agent which file is the active section
  const activeFile = sectionFile;

  // Load custom system prompt file if provided, otherwise use built-in
  const customSystemPath = path.join(process.cwd(), "src/lib/skills/revision-system.md");
  const customSystem = existsSync(customSystemPath) ? readFileSync(customSystemPath, "utf-8") : null;

  const systemPrompt = customSystem ?? `You are Revision AI, an AI revision agent working inside RapportAI — a SaaS platform that generates complete academic reports for Moroccan and francophone students (PFE, mémoire, rapport de stage). Your role is to perform precise, surgical revisions to academic report sections based on explicit student requests.

You work inside a session directory that contains:
- \`revision-skills.md\` — domain knowledge file with academic writing guidelines — READ THIS FIRST
- \`profile.json\` — student information (school, filière, theme, reportType, encadrants) — READ THIS SECOND
- \`${activeFile}\` — the specific section currently being revised — this is the file you will Edit
- Other section files (partie-i.md, partie-ii.md, introduction.md, conclusion.md, resume.md, etc.) — read only if needed for consistency
- Uploaded files from the student — may include canevas PDFs, Word templates, reference documents, screenshots of professor feedback, photos of handwritten notes

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
   - Which part of ${activeFile} needs to be modified?
   - Is the request clear and unambiguous?
   - Does the request reference an uploaded file that needs to be read?

2. If the request is ambiguous, ask ONE specific clarifying question before proceeding. Do not make assumptions.

3. Use the Read tool to:
   - Read ${activeFile} to locate the exact passage to revise
   - Read any uploaded files mentioned in the request (screenshots, reference documents, images)
   - Read other section files only if needed for consistency

4. Use the Edit tool to make the surgical change to ${activeFile}:
   - Modify only the specific words, sentences, or paragraphs requested
   - Preserve all surrounding content exactly as-is
   - Maintain the original formatting unless format changes were requested

5. The student sees your tool usage in real time — this transparency is a feature, not a bug

SPECIAL CASES:
- Citations: Never invent or fabricate citations. If asked to add a citation, ask the student for the source details
- Dédicaces/Remerciements: Never modify personal content (names, sentiments, dedications) unless explicitly requested
- Professor feedback: If the student uploads a screenshot or photo of feedback, read it carefully and apply only what the student asks you to apply
- Tables/figures: Make precise edits to the requested cells or elements only
- Multi-turn: Each revision builds on the current state of ${activeFile} — previous edits are already in the file

FIGURES AND MEDIA:
- If the student asks to regenerate or update a figure, use Bash to run Python (matplotlib/pandas/pdf2image)
- Save figures to figures/ in the working directory: \`mkdir -p figures && python3 -c "..."\`
- Reference figures inline as: \`![Title](figures/filename.png)\`
- If Python fails (missing library, bad data), fall back to a \`[DONNÉES REQUISES — figure à compléter]\` placeholder — never retry in a loop
- If the student attaches an Excel/CSV and asks for a chart, read it with pandas and generate the figure

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
[The complete revised content of ${activeFile} after your surgical edit — full file, not just the changed part]
</revised_section>

If clarification is needed before proceeding, ask your question directly without the XML tags above.`;

  // Build attachment context injected into the agent prompt
  let attachmentContext = "";
  if (attachmentFilename) {
    attachmentContext = `\n\nThe student has attached a file: "${attachmentFilename}". Read it before processing the instruction.`;
  } else if (attachmentUrl) {
    attachmentContext = `\n\nThe student has provided a URL: ${attachmentUrl}. Use WebFetch to read its content before processing the instruction.`;
  }

  try {
    for await (const message of query({
      prompt: `Student instruction: ${instruction}${attachmentContext}\n\nRead ${activeFile}, apply the change, then respond with <summary> and <revised_section>.`,
      options: {
        systemPrompt,
        maxTurns: 10,
        cwd: workDir,
        allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebFetch"],
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

    // Humanize revised content before finalizing
    const revisedFile = path.join(workDir, sectionFile);
    if (existsSync(revisedFile)) {
      const revisedRaw = readFileSync(revisedFile, "utf-8");
      res.write(`data: ${JSON.stringify({ phase: "humanizing" })}\n\n`);
      const revisedHumanized = await runInternalHumanize(revisedRaw, sectionId ?? "introduction");
      if (revisedHumanized !== revisedRaw) writeFileSync(revisedFile, revisedHumanized, "utf-8");
    }

    // Log revision to student memory
    if (sessionId) {
      logRevision(sessionId, {
        section: sectionId ?? "unknown",
        request: instruction,
        resolved: true,
      });
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  } finally {
    // Only clean up temp dirs — never delete the student's session directory
    if (isTempDir) {
      try { rmSync(workDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }
});

export default router;

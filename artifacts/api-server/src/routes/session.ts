import { Router, type Request, type Response } from "express";
import { randomUUID } from "crypto";
import multer from "multer";
import { SDKReportAgent, type ReportProfile } from "../lib/sdk-agent";
import { sessionStore } from "../lib/session-store";
import type { StreamEvent } from "../lib/agent-session";
import {
  createMemory,
  readMemory,
  patchMemory,
  markCanevasUploaded,
  incrementSessionCount,
  updateReportFields,
} from "../lib/memory";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

async function extractText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "pdf") {
    const { default: pdfParse } = await import("pdf-parse") as { default: (b: Buffer) => Promise<{ text: string }> };
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (ext === "docx" || ext === "doc") {
    const { default: mammoth } = await import("mammoth") as { default: { extractRawText: (o: { buffer: Buffer }) => Promise<{ value: string }> } };
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (ext === "txt") {
    return buffer.toString("utf-8");
  }

  throw new Error(`Format non supporté : .${ext}. Utilise PDF, Word ou TXT.`);
}

const router = Router();

// ─── Helper: pipe StreamEvents to SSE ────────────────────────────────────────

// Returns true when the stream finished normally, false when paused on a question.
// Callers must only send done:true when this returns true.
async function streamToSSE(
  res: Response,
  gen: AsyncGenerator<StreamEvent>
): Promise<boolean> {
  for await (const event of gen) {
    switch (event.type) {
      case "text":
        res.write(`data: ${JSON.stringify({ content: event.content })}\n\n`);
        break;
      case "tool_call":
        res.write(`data: ${JSON.stringify({ tool_call: event.name })}\n\n`);
        break;
      case "question":
        res.write(
          `data: ${JSON.stringify({
            question: event.question,
            choices: event.choices ?? null,
            toolUseId: event.toolUseId,
            paused: true,
          })}\n\n`
        );
        return false; // Paused — do NOT send done:true
    }
  }
  return true; // Finished normally
}

// ─── POST /api/session/start ──────────────────────────────────────────────────

router.post("/session/start", (req: Request, res: Response) => {
  const profile = req.body as ReportProfile & {
    existingSections?: Record<string, string>;
  };

  if (!profile.studentName || !profile.school || !profile.theme) {
    res.status(400).json({ error: "studentName, school, and theme are required" });
    return;
  }

  const sessionId = randomUUID();
  const agent = new SDKReportAgent(sessionId, profile);

  if (profile.existingSections && Object.keys(profile.existingSections).length > 0) {
    agent.loadSections(profile.existingSections);
  }

  sessionStore.set(agent);

  // Write student_memory.json — all agents read this before acting
  createMemory(sessionId, {
    studentName:   profile.studentName,
    school:        profile.school,
    filiere:       profile.filiere,
    annee:         profile.annee,
    reportType:    profile.reportType,
    theme:         profile.theme,
    problematique: profile.problematique,
    motsCles:      profile.motsCles,
    encadrantPeda: profile.encadrantPeda,
    encadrantPro:  profile.encadrantPro,
    entreprise:    profile.entreprise,
    citationStyle: profile.citationStyle,
  });

  res.json({ sessionId });
});

// ─── POST /api/session/:sessionId/generate ────────────────────────────────────
// Generate a report section using the persistent agent session.

router.post(
  "/session/:sessionId/generate",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { section } = req.body as { section: string };

    if (!section) {
      res.status(400).json({ error: "section is required" });
      return;
    }

    const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
    if (!agent) {
      res.status(404).json({ error: "Session introuvable ou expirée. Relance /api/session/start." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const task = agent.buildSectionTask(section);
      const finished = await streamToSSE(res, agent.stream(task));

      if (finished) {
        const sections = agent.getSections();

        // Update student memory — mark section complete
        const sectionContent = sections[section] ?? "";
        if (sectionContent) {
          markSectionComplete(sessionId, section, {
            word_count: sectionContent.split(/\s+/).filter(Boolean).length,
            key_points: sectionContent.slice(0, 300).replace(/#+\s*/g, "").trim(),
          });
        }

        res.write(
          `data: ${JSON.stringify({ done: true, sections })}\n\n`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }
);

// /answer is not needed with the Agent SDK — multi-turn is handled internally.

// ─── GET /api/session/:sessionId/state ───────────────────────────────────────

router.get("/session/:sessionId/state", (req: Request, res: Response) => {
  const agent = sessionStore.get(req.params.sessionId) as SDKReportAgent | undefined;
  if (!agent) {
    res.status(404).json({ error: "Session introuvable ou expirée." });
    return;
  }
  res.json({
    sessionId: agent.id,
    profile: agent.profile,
    sections: agent.getSections(),
    createdAt: agent.createdAt,
    lastActiveAt: agent.lastActiveAt,
  });
});

// ─── POST /api/session/:sessionId/revise ─────────────────────────────────────
// Targeted revision using the agent's edit_section tool.
// Instead of rewriting the whole section, the agent reads it and makes
// precise surgical changes — exactly like Claude Code edits a file.

router.post(
  "/session/:sessionId/revise",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { sectionId, instruction } = req.body as {
      sectionId: string;
      instruction: string;
    };

    if (!sectionId || !instruction) {
      res.status(400).json({ error: "sectionId and instruction are required" });
      return;
    }

    const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
    if (!agent) {
      res.status(404).json({ error: "Session introuvable ou expirée." });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const task = agent.buildRevisionTask(sectionId, instruction);
      const finished = await streamToSSE(res, agent.stream(task));

      if (finished) {
        const updatedContent = agent.getSection(sectionId) ?? null;
        res.write(
          `data: ${JSON.stringify({
            done: true,
            updatedContent,
            sections: agent.getSections(),
          })}\n\n`
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
  }
);

// ─── POST /api/session/:sessionId/upload-document ────────────────────────────
// Upload a PDF/Word/TXT — text is extracted and stored in the session so the
// agent can read it via the read_document tool during generation.

router.post(
  "/session/:sessionId/upload-document",
  upload.single("file"),
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const file = (req as Request & { file?: Express.Multer.File }).file;

    if (!file) {
      res.status(400).json({ error: "Aucun fichier reçu." });
      return;
    }

    const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
    if (!agent) {
      res.status(404).json({ error: "Session introuvable ou expirée." });
      return;
    }

    try {
      const ext = file.originalname.toLowerCase().split(".").pop() ?? "";
      const imageExts = new Set(["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"]);

      if (imageExts.has(ext)) {
        // Write image buffer directly — agent reads it as a vision file
        agent.uploadDocument(file.originalname, file.buffer);
        res.json({ success: true, filename: file.originalname, chars: file.buffer.length });
      } else {
        const text = await extractText(file.buffer, file.originalname);
        agent.uploadDocument(file.originalname, text);

        // If this looks like a canevas, mark it in memory so all agents enforce it
        const lowerName = file.originalname.toLowerCase();
        if (lowerName.includes("canevas") || lowerName.includes("cahier")) {
          markCanevasUploaded(sessionId, file.originalname);
        }

        res.json({ success: true, filename: file.originalname, chars: text.length });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur d'extraction";
      res.status(422).json({ error: message });
    }
  }
);

// ─── PATCH /api/session/:sessionId/memory ────────────────────────────────────
// Called from frontend whenever the student fills/updates a form field.
// Accepts any partial fields: problematique, hypotheses, objectifs, mots_cles,
// theoretical_framework, citationStyle, etc.

router.patch("/session/:sessionId/memory", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const fields = req.body as Record<string, unknown>;

  const memory = readMemory(sessionId);
  if (!memory) {
    res.status(404).json({ error: "Memory not found. Start a session first." });
    return;
  }

  patchMemory(sessionId, (m) => {
    // Top-level report fields
    const reportFields = [
      "problematique", "hypotheses", "objectifs", "mots_cles",
      "theoretical_framework", "title", "structure",
    ];
    for (const key of reportFields) {
      if (fields[key] !== undefined) {
        (m.report as Record<string, unknown>)[key] = fields[key];
      }
    }

    // Identity fields
    const identityFields = ["full_name", "email", "academic_level", "preferred_language"];
    for (const key of identityFields) {
      if (fields[key] !== undefined) {
        (m.identity as Record<string, unknown>)[key] = fields[key];
      }
    }

    // Citation style lives in writing_profile
    if (fields["citationStyle"]) {
      m.writing_profile.citation_style = fields["citationStyle"] as string;
    }

    // Agent preferences override
    if (fields["agent_preferences"]) {
      Object.assign(m.agent_preferences, fields["agent_preferences"]);
    }
  });

  res.json({ ok: true });
});

// ─── DELETE /api/session/:sessionId ──────────────────────────────────────────

router.delete("/session/:sessionId", (req: Request, res: Response) => {
  sessionStore.delete(req.params.sessionId);
  res.json({ deleted: true });
});

export default router;

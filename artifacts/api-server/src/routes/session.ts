import { Router, type Request, type Response, type NextFunction } from "express";
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
  markSectionComplete,
  incrementSessionCount,
  updateReportFields,
} from "../lib/memory";
import { guardSectionLimit, guardRevisionLimit, guardPayment } from "../lib/plan-guard";
import { logger } from "../lib/logger";
import { streamingHumanize } from "../lib/humanize-util";
import { metrics, estimateCost, estimateTokens } from "../lib/metrics";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";

// ─── Input sanitization + prompt injection prevention ────────────────────────

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+(all\s+)?above\s+instructions/i,
  /disregard\s+(your\s+)?instructions/i,
  /forget\s+(all\s+)?previous\s+instructions/i,
  /you\s+are\s+now\s+/i,
  /act\s+as\s+(if\s+you\s+are|a)\s+/i,
  /reveal\s+(your\s+)?(system\s+)?prompt/i,
  /output\s+(your\s+)?instructions/i,
  /print\s+(your\s+)?system\s+prompt/i,
  /jailbreak/i,
  /dan\s+mode/i,
  /developer\s+mode/i,
];

function sanitize(value: string): string {
  let s = value.trim();
  // Strip prompt injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    s = s.replace(pattern, "[contenu supprimé]");
  }
  // Collapse excessive whitespace / newlines
  s = s.replace(/\n{4,}/g, "\n\n").replace(/\s{10,}/g, " ");
  return s;
}

interface IntakeValidationError { field: string; message: string }

function validateAndSanitizeIntake(profile: Record<string, unknown>): IntakeValidationError | null {
  const name = (profile.studentName as string | undefined)?.trim() ?? "";
  // studentName is collected progressively — allow empty at session start
  if (name && name.length > 120)
    return { field: "studentName", message: "Nom trop long (maximum 120 caractères)" };
  // Provide a safe default so downstream agents always have a non-empty name
  if (!name) profile.studentName = "Étudiant";

  const theme = (profile.theme as string | undefined)?.trim() ?? "";
  if (!theme || theme.length < 10)
    return { field: "theme", message: "Thème trop vague (minimum 10 caractères)" };
  if (theme.length > 500)
    return { field: "theme", message: "Thème trop long (maximum 500 caractères)" };

  if (!(profile.school as string | undefined)?.trim())
    return { field: "school", message: "École requise" };

  if (!(profile.filiere as string | undefined)?.trim())
    return { field: "filiere", message: "Filière requise" };

  if (!(profile.reportType as string | undefined)?.trim())
    return { field: "reportType", message: "Type de rapport requis" };

  // Sanitize in-place
  profile.studentName = sanitize(name);
  profile.theme       = sanitize(theme);
  if (profile.problematique)
    profile.problematique = sanitize((profile.problematique as string).slice(0, 800));
  if (profile.encadrantPeda)
    profile.encadrantPeda = sanitize((profile.encadrantPeda as string).slice(0, 120));
  if (profile.encadrantPro)
    profile.encadrantPro  = sanitize((profile.encadrantPro  as string).slice(0, 120));
  if (profile.entreprise)
    profile.entreprise    = sanitize((profile.entreprise    as string).slice(0, 200));

  return null;
}

// ─── Page-by-page state tracker ──────────────────────────────────────────────
// Tracks which page we're currently on per (session, section).
// Survives the session lifetime; reset explicitly via ?reset=true.
const pageStateMap = new Map<string, Map<string, number>>();

function getPageNum(sessionId: string, sectionId: string): number {
  return pageStateMap.get(sessionId)?.get(sectionId) ?? 0;
}
function advancePage(sessionId: string, sectionId: string): number {
  if (!pageStateMap.has(sessionId)) pageStateMap.set(sessionId, new Map());
  const next = getPageNum(sessionId, sectionId) + 1;
  pageStateMap.get(sessionId)!.set(sectionId, next);
  return next;
}
function resetPage(sessionId: string, sectionId: string): void {
  pageStateMap.get(sessionId)?.set(sectionId, 0);
}

// ─── Validation + retry (Replit architecture) ─────────────────────────────────

// ─── Output quality: refusal detection + content repair ──────────────────────

const REFUSAL_PATTERNS = [
  /je ne peux pas (vous )?aider/i,
  /je suis désolé,? (mais )?je ne/i,
  /en tant qu['']ia/i,
  /en tant qu['']assistant ia/i,
  /I('m| am) (sorry|unable|not able)/i,
  /I can('t|not) (help|generate|create|write)/i,
  /I (must|need to) (decline|refuse)/i,
  /as an? (AI|language model)/i,
  /this (request|content) (violates|goes against)/i,
  /je ne suis pas en mesure/i,
  /il m['']est impossible/i,
];

// Common prefixes Claude adds that should not appear in the final .md file
const META_PREFIXES = [
  /^(voici|here is|here's)\s+(votre|your|la|l['']|le)\s+\w+\s*[:]\s*/i,
  /^bien sûr\s*[!,]?\s*/i,
  /^absolument\s*[!,]?\s*/i,
  /^d['']accord\s*[!,]?\s*/i,
  /^avec plaisir\s*[!,]?\s*/i,
  /^je vais (rédiger|générer|créer|écrire)\s+.{0,60}\n/i,
  /^---\ntask completed.*?\n---\n/is,
  /^```(markdown|md)?\n/i,  // strip opening code fence
];

const TRAILING_CODE_FENCE = /\n```\s*$/;

function detectRefusal(content: string): boolean {
  const first500 = content.slice(0, 500);
  return REFUSAL_PATTERNS.some((p) => p.test(first500));
}

function repairContent(raw: string): string {
  let s = raw.trim();

  // Strip trailing code fence if content was wrapped in a fenced block
  s = s.replace(TRAILING_CODE_FENCE, "").trim();

  // Strip meta-commentary prefixes one by one
  let changed = true;
  while (changed) {
    changed = false;
    for (const pattern of META_PREFIXES) {
      const replaced = s.replace(pattern, "");
      if (replaced !== s) { s = replaced.trim(); changed = true; }
    }
  }

  // Strip JSON blobs that slipped into the content (Claude sometimes wraps in JSON)
  if (s.startsWith("{") || s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s) as Record<string, unknown>;
      // If it has a "content" or "text" field, extract it
      const extracted = parsed.content ?? parsed.text ?? parsed.section_content;
      if (typeof extracted === "string" && extracted.length > 50) return extracted.trim();
    } catch { /* not JSON — keep as-is */ }
  }

  return s;
}

// ─── Validation + retry (Replit architecture) ─────────────────────────────────

const MIN_WORDS: Record<string, number> = {
  "partie-i":      1500,
  "partie-ii":     1500,
  "introduction":  280,
  "conclusion":    280,
  "resume":        180,
  "remerciements": 150,
  "sommaire":      100,
  "dedicaces":     50,
};

const STRUCTURE_SECTIONS = new Set(["partie-i", "partie-ii", "introduction", "conclusion"]);

const INCOMPLETE_MARKERS = [
  "[À COMPLÉTER]", "[SOURCE À VÉRIFIER]", "[SOURCE À COMPLÉTER]",
  "[INSÉRER]", "[TODO]", "[NOM DE L'AUTEUR]", "Lorem ipsum",
];

interface ValidationResult {
  valid: boolean;
  errors: string[];
  wordCount: number;
}

function validateSection(section: string, content: string): ValidationResult {
  const errors: string[] = [];
  const wordCount = content.split(/\s+/).filter(Boolean).length;

  // 1. Word count — most common failure
  const minWords = MIN_WORDS[section];
  if (minWords && wordCount < minWords) {
    errors.push(
      `Contenu insuffisant : ${wordCount} mots générés, minimum requis ${minWords}. ` +
      `Développe chaque sous-section avec plus d'arguments, exemples et données.`
    );
  }

  // 2. Required section structure (## headings)
  if (STRUCTURE_SECTIONS.has(section) && !/^##\s+\S/m.test(content)) {
    errors.push(
      `Structure manquante : organise le contenu avec des titres de chapitres (## Titre du chapitre). ` +
      `Chaque chapitre et sous-section doit avoir son propre titre.`
    );
  }

  // 3. Unfilled placeholders — agent left template gaps
  const found = INCOMPLETE_MARKERS.filter((m) => content.includes(m));
  if (found.length > 0) {
    errors.push(
      `${found.length} placeholder(s) non remplacé(s) : ${found.slice(0, 3).join(", ")}. ` +
      `Remplace chacun par du contenu académique réel et spécifique.`
    );
  }

  return { valid: errors.length === 0, errors, wordCount };
}

function buildRetryTask(section: string, errors: string[], attempt: number): string {
  return `AMÉLIORATION REQUISE — révision ${attempt}/2

Le contenu généré pour "${section}" ne respecte pas ces critères qualité :

${errors.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Instructions :
- Lis le fichier ${section}.md existant
- Corrige TOUS les problèmes listés ci-dessus
- Ne te contente pas de légèrement modifier — génère un contenu substantiellement amélioré
- Écrase ${section}.md avec la version corrigée`;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Apply multer file parsing only for multipart/form-data requests (e.g. generate with files)
const conditionalMultipart = (req: Request, res: Response, next: NextFunction) => {
  const ct = req.headers["content-type"] ?? "";
  if (ct.includes("multipart/form-data")) {
    upload.array("files")(req, res, next);
  } else {
    next();
  }
};

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
        res.write(`data: ${JSON.stringify({ thinking: event.content })}\n\n`);
        break;
      case "tool_call":
        res.write(`data: ${JSON.stringify({ tool_call: { name: event.name, detail: event.detail ?? null } })}\n\n`);
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

  const validationError = validateAndSanitizeIntake(profile as unknown as Record<string, unknown>);
  if (validationError) {
    res.status(400).json({ error: validationError.message, field: validationError.field });
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
  conditionalMultipart,
  guardPayment,
  guardSectionLimit,
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const rawBody = req.body as {
      section: string;
      problematique?: string;
      extraContext?: string;
      figures?: unknown;  // JSON string when from FormData, array when from JSON body
      formatting?: Record<string, unknown>;
    };
    const { section, problematique, extraContext, formatting } = rawBody;
    // figures arrives as a JSON string in FormData, as an array in JSON body
    let figures: { figureNumber: number; title: string; source: string; author: string; caption: string; placement: string }[] | undefined;
    if (Array.isArray(rawBody.figures)) {
      figures = rawBody.figures as typeof figures;
    } else if (typeof rawBody.figures === "string") {
      try { figures = JSON.parse(rawBody.figures) as typeof figures; } catch { /* ignore */ }
    }

    if (!section) {
      res.status(400).json({ error: "section is required" });
      return;
    }

    const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
    if (!agent) {
      res.status(404).json({ error: "Session introuvable ou expirée. Relance /api/session/start." });
      return;
    }

    // Save any uploaded files to the agent's work directory so SDK agents can Read them
    const uploadedFiles = req.files as Express.Multer.File[] | undefined;
    if (uploadedFiles?.length) {
      for (const file of uploadedFiles) {
        agent.uploadDocument(file.originalname, file.buffer);
      }
    }

    // If the frontend sent an updated problématique (e.g. from Step 6 form),
    // patch it into memory so the agent reads the latest version
    if (problematique) {
      patchMemory(sessionId, (m) => { m.report.problematique = problematique; });
      agent.patchProfile({ problematique });
    }

    // Mise en forme can change between session start and generation — keep the
    // agent's profile (used by buildSystemPrompt) in sync so prefs always apply.
    if (formatting && typeof formatting === "object") {
      agent.patchProfile({ formatting });
    }

    // Write figures.md to session dir so the agent can read it via the Read tool.
    // Always overwrite (even when empty) to prevent stale context from previous generations.
    if (section === "partie-i" || section === "partie-ii") {
      const placement = section === "partie-i" ? "Partie I" : "Partie II";
      const sectionFigs = (figures ?? []).filter((f) => f.placement === placement);
      const figLines = sectionFigs.length > 0
        ? [
            `# Figures approuvées — ${placement}`,
            "",
            "Ces figures ont été préparées par l'étudiant. Référence-les naturellement dans le texte avec leur numéro exact.",
            "",
            ...sectionFigs.map((f) =>
              `## Figure ${f.figureNumber} — ${f.title}\n- **Description :** ${f.caption || f.title}\n- **Source :** ${f.source || "Auteur propre"}\n- **Référence dans le texte :** « Comme l'illustre la Figure ${f.figureNumber}, … »`
            ),
            "",
            "**Règle :** N'invente PAS d'autres numéros de figures. Utilise uniquement les numéros listés ci-dessus.",
          ]
        : [`# Figures — ${placement}`, "", "Aucune figure approuvée pour cette section. Ne référence pas de figures numérotées."];
      try {
        writeFileSync(`${agent.workDir}/figures.md`, figLines.join("\n"), "utf-8");
      } catch { /* ignore write errors */ }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders(); // Flush immediately so client sees headers before first event

    // partialSections accumulates whatever the agent writes to disk — used for
    // partial recovery if the agent hits its turn limit mid-generation
    let partialSections: Record<string, string> = {};
    const genStart = Date.now();
    metrics.recordStart();

    try {
      // Build context packet from stored summaries and inject into task
      const memory = readMemory(sessionId);
      const summaries = (memory?.section_summaries ?? {}) as Record<string, { key_points: string; word_count: number }>;
      const contextPacket = agent.buildContextPacket(section, summaries);
      const enrichedExtraContext = contextPacket + (extraContext ? `\n\n${extraContext}` : "");

      const task = agent.buildSectionTask(section, { extraContext: enrichedExtraContext, figures });

      res.write(`data: ${JSON.stringify({ phase: "writing" })}\n\n`);
      const finished = await streamToSSE(res, agent.streamSection(section, task));

      // Read whatever was written to disk (even if stream ended early)
      partialSections = agent.getSections();

      if (finished) {
        const rawContent = partialSections[section] ?? "";

        if (!rawContent) {
          const { findClaudeBinary } = await import("../lib/find-claude-binary");
          const binary = findClaudeBinary();
          const hint = binary
            ? "Claude binary trouvé mais rien généré. Vérifiez ANTHROPIC_API_KEY sur Railway."
            : "Claude Code CLI introuvable. Vérifiez l'installation de @anthropic-ai/claude-agent-sdk.";
          res.write(`data: ${JSON.stringify({ error: hint })}\n\n`);
          return;
        }

        // ── Output quality: repair + refusal detection ────────────────────────
        const repairedContent = repairContent(rawContent);

        if (detectRefusal(repairedContent)) {
          res.write(`data: ${JSON.stringify({
            error: "Le contenu généré a été refusé par le modèle. Essaie de reformuler le thème ou la problématique.",
            refusal: true,
          })}\n\n`);
          return;
        }

        // Use repaired content for all subsequent steps
        if (repairedContent !== rawContent) {
          const sectionFile = path.join(agent.workDir, `${section}.md`);
          writeFileSync(sectionFile, repairedContent, "utf-8");
          partialSections[section] = repairedContent;
        }

        // ── Validation + retry (Replit pattern) ─────────────────────────────────
        // If content fails quality checks, re-run the agent with specific error
        // feedback instead of a blank retry — up to 2 correction passes.
        const MAX_RETRIES = 2;
        let contentToHumanize = repairedContent;
        let attemptsUsed = 1;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          const validation = validateSection(section, contentToHumanize);
          if (validation.valid) break;

          if (attempt === MAX_RETRIES) {
            // Last attempt still invalid — continue with what we have
            break;
          }

          res.write(
            `data: ${JSON.stringify({
              phase: "retrying",
              attempt,
              errors: validation.errors,
            })}\n\n`
          );

          attemptsUsed = attempt + 1;
          const retryTask = buildRetryTask(section, validation.errors, attempt);
          const retryFinished = await streamToSSE(res, agent.streamSection(section, retryTask));

          if (retryFinished) {
            partialSections = agent.getSections();
            const retryRaw = partialSections[section] ?? contentToHumanize;
            contentToHumanize = detectRefusal(retryRaw) ? contentToHumanize : repairContent(retryRaw);
          } else {
            // Agent paused mid-retry — exit loop, use what we have
            break;
          }
        }

        res.write(`data: ${JSON.stringify({ phase: "humanizing" })}\n\n`);
        let humanized = contentToHumanize;
        let _humanizedAccum = "";
        await streamingHumanize(contentToHumanize, section, (chunk, isFirst) => {
          const separator = isFirst ? "" : "\n\n";
          _humanizedAccum += separator + chunk;
          res.write(`data: ${JSON.stringify({ content_chunk: separator + chunk })}\n\n`);
        });
        humanized = _humanizedAccum || contentToHumanize;
        if (humanized !== contentToHumanize) {
          const sectionFile = path.join(agent.workDir, `${section}.md`);
          writeFileSync(sectionFile, humanized, "utf-8");
          partialSections[section] = humanized;
        }

        const finalWords = (partialSections[section] ?? "").split(/\s+/).filter(Boolean).length;
        markSectionComplete(sessionId, section, {
          word_count: finalWords,
          key_points: (partialSections[section] ?? "").slice(0, 300).replace(/#+\s*/g, "").trim(),
        });

        metrics.record({
          sessionId:  sessionId,
          section,
          latencyMs:  Date.now() - genStart,
          success:    true,
          wordCount:  finalWords,
          tokensUsed: estimateTokens(finalWords),
          costUsd:    estimateCost(section, finalWords),
          attempts:   attemptsUsed,
        });

        res.write(`data: ${JSON.stringify({ done: true, sections: partialSections })}\n\n`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      metrics.record({
        sessionId:  sessionId,
        section,
        latencyMs:  Date.now() - genStart,
        success:    false,
        wordCount:  0,
        tokensUsed: 0,
        costUsd:    0,
        attempts:   1,
        error:      message.slice(0, 200),
      });
      // Turn-limit hit — read disk and return whatever was generated (Replit pattern)
      partialSections = agent.getSections();
      if (message.includes("maximum number of turns") || message.includes("turn limit")) {
        res.write(`data: ${JSON.stringify({ done: true, sections: partialSections, partial: true })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      }
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
  guardRevisionLimit,
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    type RevisionFileBlock = {
      type: "image" | "document";
      name: string;
      source:
        | { type: "base64"; media_type: string; data: string }
        | { type: "text";   media_type: string; data: string };
    };

    const { sectionId, instruction, files } = req.body as {
      sectionId: string;
      instruction: string;
      files?: RevisionFileBlock[];
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
    res.flushHeaders();

    try {
      // Write attached files to an isolated subdirectory — never touches core session files
      const attachedFileNames: string[] = [];
      if (files && files.length > 0) {
        const uploadsDir = path.join(agent.workDir, "_revision_uploads");
        mkdirSync(uploadsDir, { recursive: true });
        for (const block of files) {
          const safeName = block.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const filePath = path.join(uploadsDir, safeName);
          if (block.source.type === "base64") {
            writeFileSync(filePath, Buffer.from(block.source.data, "base64"));
          } else {
            writeFileSync(filePath, block.source.data, "utf-8");
          }
          attachedFileNames.push(`_revision_uploads/${safeName}`);
        }
      }

      const task = agent.buildRevisionTask(sectionId, instruction, attachedFileNames);
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
        // Save original binary so agents can screenshot/extract figures from PDFs/Excel
        agent.uploadDocument(file.originalname, file.buffer);
        const text = await extractText(file.buffer, file.originalname);
        agent.uploadDocument(`${file.originalname}.txt`, text);

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

    // Student personalization text for dedicaces / remerciements / resume
    const interactionFields = ["dedicaces_text", "remerciements_text", "resume_fr", "abstract_en", "abreviations"];
    for (const key of interactionFields) {
      if (fields[key] !== undefined) {
        (m.interaction_history as Record<string, unknown>)[key] = fields[key];
      }
    }

    // Agent preferences override
    if (fields["agent_preferences"]) {
      Object.assign(m.agent_preferences, fields["agent_preferences"]);
    }
  });

  res.json({ ok: true });
});

// ─── POST /api/session/:sessionId/next-page ──────────────────────────────────
// Generate one page (~350 words) of partie-i or partie-ii in page-by-page mode.
// The agent appends the page to the section file using Edit (not Write).
//
// Body: { sectionId: "partie-i" | "partie-ii", page?: number, reset?: boolean }
// - page: if provided, generate that specific page (defaults to auto-increment)
// - reset: if true, restart from page 1

const PAGE_MODE_SECTIONS = new Set(["partie-i", "partie-ii"]);

router.post(
  "/session/:sessionId/next-page",
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const { sectionId, page, reset } = req.body as {
      sectionId: string;
      page?: number;
      reset?: boolean;
    };

    if (!sectionId || !PAGE_MODE_SECTIONS.has(sectionId)) {
      res.status(400).json({ error: "sectionId must be 'partie-i' or 'partie-ii'" });
      return;
    }

    const agent = sessionStore.get(sessionId) as SDKReportAgent | undefined;
    if (!agent) {
      res.status(404).json({ error: "Session introuvable ou expirée." });
      return;
    }

    if (reset) resetPage(sessionId, sectionId);

    // Determine page number: explicit override or auto-advance
    const pageNum = typeof page === "number" ? page : advancePage(sessionId, sectionId);
    if (typeof page === "number") {
      // Keep tracker in sync when caller provides an explicit page
      if (!pageStateMap.has(sessionId)) pageStateMap.set(sessionId, new Map());
      pageStateMap.get(sessionId)!.set(sectionId, page);
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const docs = agent.getDocumentNames();
    const docNote = docs.length > 0 ? `Documents disponibles : ${docs.join(", ")}.\n` : "";

    const sectionLabel = sectionId === "partie-i" ? "Partie I" : "Partie II";
    const crossRef = sectionId === "partie-ii"
      ? "Lis aussi partie-i.md — les références croisées vers Partie I sont obligatoires.\n"
      : "";

    const task = `${docNote}MODE PAGE — génère uniquement la page ${pageNum} (~350 mots) de la ${sectionLabel}.
${crossRef}Lis sommaire.md pour extraire la structure de la ${sectionLabel} et déterminer quelle section et position correspondent à la page ${pageNum}.

Règles du mode page :
- Contenu pur : pas d'en-têtes Markdown, pas de méta-données, pas de commentaires
- Terminer sur une coupure naturelle de paragraphe
- Si c'est la première page (page 1) et que ${sectionId}.md n'existe pas, crée-le avec Write
- Si le fichier existe déjà, utilise Edit pour APPENDER cette page — ne pas écraser le contenu précédent
- Longueur cible : ~350 mots (300–400 acceptable)

Contexte supplémentaire : ${JSON.stringify({ page: pageNum, mode: "page" })}`;

    try {
      res.write(`data: ${JSON.stringify({ phase: "writing", page: pageNum })}\n\n`);

      // Page mode: skip WebSearch/WebFetch — agent only needs to read sommaire and write
      const PAGE_TOOLS = ["Read", "Write", "Edit", "Glob"];
      const finished = await streamToSSE(res, agent.streamSection(sectionId, task, PAGE_TOOLS));

      if (finished) {
        const sectionContent = agent.getSection(sectionId) ?? "";
        const wordCount = sectionContent.split(/\s+/).filter(Boolean).length;
        res.write(
          `data: ${JSON.stringify({
            done: true,
            page: pageNum,
            totalWords: wordCount,
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

// ─── GET /api/session/:sessionId/page-state ───────────────────────────────────
// Returns the current page counters for this session (for UI state restore).

router.get("/session/:sessionId/page-state", (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const state = pageStateMap.get(sessionId);
  res.json({
    "partie-i":  state?.get("partie-i")  ?? 0,
    "partie-ii": state?.get("partie-ii") ?? 0,
  });
});

// ─── POST /api/session/:sessionId/complete ───────────────────────────────────
// Called by the frontend when the user exports/downloads their finished report.
// Triggers referral cashback logic for the user identified by x-clerk-id header.

router.post("/session/:sessionId/complete", async (req: Request, res: Response) => {
  const clerkId = req.headers["x-clerk-id"] as string | undefined;
  const { subject, word_count, sections_count } = req.body as {
    subject?:        string;
    word_count?:     number;
    sections_count?: number;
  };
  if (clerkId) {
    try {
      const { onReportCompleted } = await import("../lib/referral");
      await onReportCompleted(clerkId, {
        reportId:      req.params.sessionId,
        subject,
        wordCount:     word_count,
        sectionsCount: sections_count,
      });
    } catch (err) {
      logger.warn({ err }, "onReportCompleted failed (non-fatal)");
    }
  }
  res.json({ ok: true });
});

// ─── DELETE /api/session/:sessionId ──────────────────────────────────────────

router.delete("/session/:sessionId", (req: Request, res: Response) => {
  sessionStore.delete(req.params.sessionId);
  pageStateMap.delete(req.params.sessionId);
  res.json({ deleted: true });
});

export default router;

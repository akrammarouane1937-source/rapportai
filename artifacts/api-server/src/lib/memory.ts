import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import type {
  StudentMemory,
  WritingProfile,
  SectionSummary,
  BibCitation,
  JurySimulation,
  HumanizeRecord,
  PlagiatRecord,
  RevisionRequest,
} from "./memory-types";

export const SESSIONS_ROOT = process.env.SESSIONS_DIR ?? "/tmp/rapportai-sessions";

export function memoryPath(sessionId: string): string {
  return path.join(SESSIONS_ROOT, sessionId, "student_memory.json");
}

export function sessionDir(sessionId: string): string {
  return path.join(SESSIONS_ROOT, sessionId);
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function readMemory(sessionId: string): StudentMemory | null {
  const p = memoryPath(sessionId);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8")) as StudentMemory;
  } catch {
    return null;
  }
}

// ── Write (full replace) ──────────────────────────────────────────────────────

export function writeMemory(sessionId: string, memory: StudentMemory): void {
  const dir = sessionDir(sessionId);
  mkdirSync(dir, { recursive: true });
  memory.last_updated = new Date().toISOString();
  writeFileSync(memoryPath(sessionId), JSON.stringify(memory, null, 2), "utf-8");
}

// ── Create from profile (called at session/start) ─────────────────────────────

export interface ProfileInput {
  studentName?: string;
  email?: string;
  school?: string;
  filiere?: string;
  annee?: string;
  reportType?: string;
  theme?: string;
  problematique?: string;
  motsCles?: string[];
  encadrantPeda?: string;
  encadrantPro?: string;
  entreprise?: string;
  citationStyle?: string;
  plan?: string;
}

export function createMemory(sessionId: string, profile: ProfileInput): StudentMemory {
  const ALL_SECTIONS = [
    "dedicaces", "remerciements", "resume",
    "introduction", "partie-i", "partie-ii",
    "conclusion", "bibliographie",
  ];

  const memory: StudentMemory = {
    schema_version: "1.0",
    last_updated: new Date().toISOString(),

    identity: {
      student_id: sessionId,
      full_name: profile.studentName ?? "Étudiant(e)",
      email: profile.email,
      preferred_language: "fr",
      school: profile.school ?? "",
      filiere: profile.filiere ?? "",
      academic_year: profile.annee,
      supervisor: profile.encadrantPeda
        ? { name: profile.encadrantPeda, title: "Professeur" }
        : undefined,
    },

    report: {
      title: profile.theme,
      type: (profile.reportType as StudentMemory["report"]["type"]) ?? "PFE",
      structure: "deux-parties",
      language: "fr",
      canevas_uploaded: false,
      company: profile.entreprise
        ? { name: profile.entreprise, supervisor_name: profile.encadrantPro }
        : undefined,
      problematique: profile.problematique,
      mots_cles: profile.motsCles,
    },

    progress: {
      sections_completed: [],
      sections_in_progress: [],
      sections_pending: ALL_SECTIONS,
      total_pages_generated: 0,
      last_activity: new Date().toISOString(),
      session_count: 1,
    },

    writing_profile: {
      assessed: false,
      recurring_errors: [],
      strengths: [],
      citation_style: profile.citationStyle ?? "APA 7",
      plagiat_target: 15,
    },

    section_summaries: {},
    bibliography: {
      citations_found: [],
      citation_count: 0,
      sources_by_section: {},
    },

    interaction_history: {
      revision_requests: [],
      jury_simulations: [],
      humanize_requests: [],
      plagiat_checks: [],
    },

    agent_preferences: {
      generation: {
        verbosity: "détaillé",
        include_transitions: true,
        include_part_intros: true,
        include_part_conclusions: true,
        enforce_canevas: true,
      },
      revision: {
        tone: "bienveillant",
        show_diff: true,
        explain_changes: true,
      },
      chat: {
        tutor_mode: true,
        language_mix: "fr",
      },
      jury: {
        difficulty: "medium",
        jury_profiles: ["méthodologue", "théoricien", "praticien"],
        focus_sections: [],
      },
    },

    subscription: {
      plan: (profile.plan as StudentMemory["subscription"]["plan"]) ?? "free",
      generations_used: 0,
      generations_limit: 3,
      humanize_uses: 0,
      plagiat_checks: 0,
    },
  };

  writeMemory(sessionId, memory);
  return memory;
}

// ── Patch helpers (partial updates) ──────────────────────────────────────────

export function patchMemory(
  sessionId: string,
  updater: (m: StudentMemory) => void
): StudentMemory | null {
  const memory = readMemory(sessionId);
  if (!memory) return null;
  updater(memory);
  writeMemory(sessionId, memory);
  return memory;
}

// ── Section completed ─────────────────────────────────────────────────────────

export function markSectionComplete(
  sessionId: string,
  section: string,
  summary: Omit<SectionSummary, "completed_at">
): void {
  patchMemory(sessionId, (m) => {
    // Move from pending/in_progress to completed
    m.progress.sections_pending = m.progress.sections_pending.filter(s => s !== section);
    m.progress.sections_in_progress = m.progress.sections_in_progress.filter(s => s !== section);
    if (!m.progress.sections_completed.includes(section)) {
      m.progress.sections_completed.push(section);
    }
    m.progress.last_section_generated = section;
    m.progress.last_activity = new Date().toISOString();
    m.progress.total_pages_generated += Math.round((summary.word_count ?? 0) / 300);

    // Save summary
    m.section_summaries[section] = {
      ...summary,
      completed_at: new Date().toISOString(),
    };

    // Increment generation counter
    m.subscription.generations_used += 1;
  });
}

// ── Update report fields (problématique, hypothèses, etc.) ───────────────────

export function updateReportFields(
  sessionId: string,
  fields: Partial<StudentMemory["report"]>
): void {
  patchMemory(sessionId, (m) => {
    Object.assign(m.report, fields);
  });
}

// ── Add citation ──────────────────────────────────────────────────────────────

export function addCitation(sessionId: string, citation: BibCitation): void {
  patchMemory(sessionId, (m) => {
    const exists = m.bibliography.citations_found.some(c => c.ref === citation.ref);
    if (!exists) {
      m.bibliography.citations_found.push(citation);
      m.bibliography.citation_count += 1;
      m.bibliography.sources_by_section[citation.section] =
        (m.bibliography.sources_by_section[citation.section] ?? 0) + 1;
    }
  });
}

// ── Update writing profile after revision ────────────────────────────────────

export function updateWritingProfile(
  sessionId: string,
  patch: Partial<WritingProfile>
): void {
  patchMemory(sessionId, (m) => {
    Object.assign(m.writing_profile, patch);
    m.writing_profile.assessed = true;
  });
}

// ── Log revision request ──────────────────────────────────────────────────────

export function logRevision(sessionId: string, req: Omit<RevisionRequest, "timestamp">): void {
  patchMemory(sessionId, (m) => {
    m.interaction_history.revision_requests.push({
      ...req,
      timestamp: new Date().toISOString(),
    });
  });
}

// ── Log jury simulation ───────────────────────────────────────────────────────

export function logJurySimulation(
  sessionId: string,
  sim: Omit<JurySimulation, "timestamp">
): void {
  patchMemory(sessionId, (m) => {
    m.interaction_history.jury_simulations.push({
      ...sim,
      timestamp: new Date().toISOString(),
    });
  });
}

// ── Log humanize ──────────────────────────────────────────────────────────────

export function logHumanize(
  sessionId: string,
  rec: Omit<HumanizeRecord, "timestamp">
): void {
  patchMemory(sessionId, (m) => {
    m.interaction_history.humanize_requests.push({
      ...rec,
      timestamp: new Date().toISOString(),
    });
    m.subscription.humanize_uses += 1;
    if (rec.ai_score_after !== undefined) {
      m.writing_profile.ai_detection_risk =
        rec.ai_score_after < 20 ? "low" : rec.ai_score_after < 50 ? "medium" : "high";
    }
  });
}

// ── Log plagiat check ─────────────────────────────────────────────────────────

export function logPlagiat(
  sessionId: string,
  rec: Omit<PlagiatRecord, "timestamp">
): void {
  patchMemory(sessionId, (m) => {
    m.interaction_history.plagiat_checks.push({
      ...rec,
      timestamp: new Date().toISOString(),
    });
    m.subscription.plagiat_checks += 1;
    if (rec.similarity_after !== undefined) {
      m.writing_profile.plagiat_similarity_score = rec.similarity_after;
    }
  });
}

// ── Mark canevas uploaded ─────────────────────────────────────────────────────

export function markCanevasUploaded(sessionId: string, filename: string): void {
  patchMemory(sessionId, (m) => {
    m.report.canevas_uploaded = true;
    m.report.canevas_filename = filename;
    m.agent_preferences.generation.enforce_canevas = true;
  });
}

// ── Increment session count (on returning visit) ──────────────────────────────

export function incrementSessionCount(sessionId: string): void {
  patchMemory(sessionId, (m) => {
    m.progress.session_count += 1;
    m.progress.last_activity = new Date().toISOString();
  });
}

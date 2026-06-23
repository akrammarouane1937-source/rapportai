// ─── Report State ────────────────────────────────────────────────────────────
// The single source of truth for the agentic orchestrator. The orchestrator reasons
// over this object, and EVERY tool reads/writes it. Student preferences captured here
// (structure, length, style, sources) are obeyed by every writer — this is what kills
// the "it ignores me / it's scripted" problem.
//
// Persisted per session at  <SESSIONS_DIR>/<sessionId>/report_state.json

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";

const SESSIONS_ROOT = process.env.SESSIONS_DIR ?? "/tmp/rapportai-sessions";

export type SectionStatus = "pending" | "drafting" | "humanizing" | "ready" | "confirmed";

export interface SectionState {
  id: string;                 // e.g. "partie-i", "introduction", "partie-i:1.1"
  title: string;
  status: SectionStatus;
  words: number;
  detectionScore: number | null;   // last measured AI-detection %, null if unknown
  lastInstruction: string;         // the student's latest instruction for this section
}

export interface StructurePreference {
  hierarchyDepth: number;     // 3 = Partie>Chapitre>Section, 4 = + sous-section
  numbering: string;          // e.g. "1.1", "1.1.1"
  notes: string;              // free-text: "Section N puis sous-sections 1.1, 1.2…"
}

export interface ReportPreferences {
  structure: StructurePreference;
  lengthTarget: Record<string, string | null>;  // { partieI: "~50 pages", … }
  style: string;              // "académique dense, ancrage marché marocain"
  schoolConventions: string;  // "EMSI — Ingénierie Financière"
  citationStyle: string;      // "Auteur (année)"
}

export interface SourceRef {
  title: string;
  author: string;
  type: "library" | "web";
  ref: string;                // filename, URL, or citation
}

export interface ReportState {
  sessionId: string;
  profile: Record<string, unknown>;          // student profile (theme, école, encadrants…)
  preferences: ReportPreferences;
  plan: unknown;                              // sommaire as structured, EDITABLE data
  sources: SourceRef[];
  sections: Record<string, SectionState>;
  progress: { currentFocus: string | null; completed: string[] };
  updatedAt: string;
}

function defaultState(sessionId: string, profile: Record<string, unknown> = {}): ReportState {
  return {
    sessionId,
    profile,
    preferences: {
      structure: { hierarchyDepth: 3, numbering: "1.1", notes: "" },
      lengthTarget: {},
      style: "",
      schoolConventions: "",
      citationStyle: "Auteur (année)",
    },
    plan: null,
    sources: [],
    sections: {},
    progress: { currentFocus: null, completed: [] },
    updatedAt: new Date().toISOString(),
  };
}

function statePath(sessionId: string): string {
  return path.join(SESSIONS_ROOT, sessionId, "report_state.json");
}

/** Load the report state for a session, creating a default if none exists. */
export function loadReportState(sessionId: string, profile?: Record<string, unknown>): ReportState {
  const p = statePath(sessionId);
  if (existsSync(p)) {
    try {
      const raw = JSON.parse(readFileSync(p, "utf-8")) as ReportState;
      // merge a fresh profile if provided (keeps prefs/plan/sections)
      if (profile) raw.profile = { ...raw.profile, ...profile };
      return raw;
    } catch { /* corrupt — fall through to default */ }
  }
  const state = defaultState(sessionId, profile);
  saveReportState(state);
  return state;
}

/** Persist the report state. Always call after a tool mutates it. */
export function saveReportState(state: ReportState): void {
  state.updatedAt = new Date().toISOString();
  const dir = path.join(SESSIONS_ROOT, state.sessionId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(statePath(state.sessionId), JSON.stringify(state, null, 2), "utf-8");
}

// ─── Mutation helpers (used by tools) ────────────────────────────────────────

/** Set a preference by dotted path, e.g. setPreference(s, "structure.notes", "…").
 * Paths starting with "profile." write the student's profile (theme, school, …). */
export function setPreference(state: ReportState, dotPath: string, value: unknown): ReportState {
  if (dotPath.startsWith("profile.")) {
    state.profile[dotPath.slice("profile.".length)] = value;
    saveReportState(state);
    return state;
  }
  const keys = dotPath.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let obj: any = state.preferences;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof obj[keys[i]] !== "object" || obj[keys[i]] === null) obj[keys[i]] = {};
    obj = obj[keys[i]];
  }
  obj[keys[keys.length - 1]] = value;
  saveReportState(state);
  return state;
}

export function upsertSection(state: ReportState, section: Partial<SectionState> & { id: string }): ReportState {
  const prev = state.sections[section.id];
  state.sections[section.id] = {
    id: section.id,
    title: section.title ?? prev?.title ?? section.id,
    status: section.status ?? prev?.status ?? "pending",
    words: section.words ?? prev?.words ?? 0,
    detectionScore: section.detectionScore ?? prev?.detectionScore ?? null,
    lastInstruction: section.lastInstruction ?? prev?.lastInstruction ?? "",
  };
  saveReportState(state);
  return state;
}

export function addSource(state: ReportState, source: SourceRef): ReportState {
  if (!state.sources.some((s) => s.ref === source.ref)) {
    state.sources.push(source);
    saveReportState(state);
  }
  return state;
}

/** A compact, model-friendly summary of the state for the orchestrator's context. */
export function summarizeState(state: ReportState): string {
  const prefs = state.preferences;
  const secs = Object.values(state.sections);
  const secLines = secs.length
    ? secs.map((s) => `  - ${s.id} "${s.title}" → ${s.status}${s.detectionScore != null ? ` (${s.detectionScore}% IA)` : ""}`).join("\n")
    : "  (aucune section encore)";
  const pf = state.profile as Record<string, string>;
  return `ÉTAT DU RAPPORT
Profil étudiant: thème="${pf.theme || "MANQUANT"}", école="${pf.school || "?"}", filière="${pf.filiere || "?"}", type="${pf.reportType || "?"}", problématique="${pf.problematique || "?"}"
Préférences:
  - Structure: profondeur ${prefs.structure.hierarchyDepth}, numérotation "${prefs.structure.numbering}"${prefs.structure.notes ? ` — ${prefs.structure.notes}` : ""}
  - Longueur cible: ${Object.entries(prefs.lengthTarget).map(([k, v]) => `${k}=${v}`).join(", ") || "non fixée"}
  - Style: ${prefs.style || "non précisé"}
  - École/convention: ${prefs.schoolConventions || "non précisé"}
Sources (${state.sources.length}): ${state.sources.map((s) => s.title).join("; ") || "aucune"}
Sections:
${secLines}
Focus actuel: ${state.progress.currentFocus ?? "aucun"}`;
}

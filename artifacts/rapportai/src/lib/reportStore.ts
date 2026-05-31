import { useEffect } from "react";
import { useReportStore } from "./store";
import type { Report } from "./store";

const KEY = "rapportai_v1";

export interface ReportData {
  // Agent session ID — stored once after /api/session/start, reused for all generation calls
  sessionId?: string;
  sessionCreatedAt?: number; // epoch ms — sessions expire after 45 min (server restarts)

  reportType?: string;
  theme?: string;
  school?: string;
  filiere?: string;
  annee?: string;
  studentName?: string;
  encadrantPeda?: string;
  encadrantPro?: string;
  entreprise?: string;
  ville?: string;
  citationStyle?: string;
  problematique?: string;
  sommaireText?: string;

  logoUrl?: string;
  coverTemplate?: string;

  dateDebutStage?: string;
  dateFinStage?: string;
  juryMember1?: string;
  juryMember2?: string;
  juryMember3?: string;

  dedicaces?: string;
  remerciements?: string;

  resume?: string;
  abstract?: string;
  motsCles?: string[];
  keywords?: string[];
  abreviations?: Array<{ abbr: string; sig: string }>;

  introduction?: string;
  partieI?: string;
  partieII?: string;

  conclusion?: string;
  apports?: string;
  perspectives?: string;
  bibliographie?: Array<{ author: string; year: string; title: string; journal: string }>;
  bibliographieText?: string; // generated markdown from the AI agent
  figures?: Array<{ n: number; title: string; page: number }>;
  tableaux?: Array<{ n: number; title: string; page: number }>;
  annexes?: string[];
}

export function getReport(): ReportData {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ReportData) : {};
  } catch {
    return {};
  }
}

export function saveReport(patch: Partial<ReportData>): void {
  try {
    const current = getReport();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // ignore quota errors in demo mode
  }

  // Sync to Zustand store so reactive components (ReportToc, etc.) update in real time.
  // Field names differ between the two stores — map them explicitly.
  try {
    const z: Partial<Report> = {};
    if ("theme"             in patch) z.theme            = patch.theme            ?? "";
    if ("school"            in patch) z.school           = patch.school           ?? "";
    if ("filiere"           in patch) z.filiere          = patch.filiere          ?? "";
    if ("reportType"        in patch) z.reportType       = (patch.reportType as Report["reportType"]) ?? "PFE";
    if ("annee"             in patch) z.academicYear     = patch.annee            ?? "";
    if ("studentName"       in patch) z.studentName      = patch.studentName      ?? "";
    if ("encadrantPeda"     in patch) z.encadrantPeda    = patch.encadrantPeda    ?? "";
    if ("encadrantPro"      in patch) z.encadrantPro     = patch.encadrantPro     ?? "";
    if ("entreprise"        in patch) z.entreprise       = patch.entreprise       ?? "";
    if ("ville"             in patch) z.ville            = patch.ville            ?? "";
    if ("dedicaces"         in patch) z.dedicaces        = patch.dedicaces        ?? "";
    if ("remerciements"     in patch) z.remerciements    = patch.remerciements    ?? "";
    if ("resume"            in patch) z.resumeFr         = patch.resume           ?? "";
    if ("abstract"          in patch) z.abstractEn       = patch.abstract         ?? "";
    if ("motsCles"          in patch) z.motsCles         = patch.motsCles         ?? [];
    if ("abreviations"      in patch) z.abreviations     = patch.abreviations     ?? [];
    if ("sommaireText"      in patch) z.sommaire         = patch.sommaireText     ?? "";
    if ("introduction"      in patch) z.introduction     = patch.introduction     ?? "";
    if ("partieI"           in patch) z.partieI          = patch.partieI          ?? "";
    if ("partieII"          in patch) z.partieII         = patch.partieII         ?? "";
    if ("conclusion"        in patch) z.conclusion       = patch.conclusion       ?? "";
    if ("bibliographieText" in patch) z.bibliographieText = patch.bibliographieText ?? "";
    if ("problematique"     in patch) z.problematique    = patch.problematique    ?? "";
    if (Object.keys(z).length > 0) {
      useReportStore.getState().updateReport(z);
    }
  } catch {
    // Non-fatal — Zustand sync is best-effort
  }
}

/**
 * Write Zustand `Report` fields into `rapportai_v1` raw localStorage.
 * Used when hydrating from the server so generation pages (which read via
 * `getReport()`) can see the restored content without triggering another
 * Zustand update loop.
 */
export function hydrateRawFromZustand(r: Partial<Report>): void {
  const patch: Partial<ReportData> = {};
  if (r.theme)            patch.theme            = r.theme;
  if (r.school)           patch.school           = r.school;
  if (r.filiere)          patch.filiere          = r.filiere;
  if (r.reportType)       patch.reportType       = r.reportType;
  if (r.academicYear)     patch.annee            = r.academicYear;
  if (r.studentName)      patch.studentName      = r.studentName;
  if (r.encadrantPeda)    patch.encadrantPeda    = r.encadrantPeda;
  if (r.encadrantPro)     patch.encadrantPro     = r.encadrantPro;
  if (r.entreprise)       patch.entreprise       = r.entreprise;
  if (r.ville)            patch.ville            = r.ville;
  if (r.dedicaces)        patch.dedicaces        = r.dedicaces;
  if (r.remerciements)    patch.remerciements    = r.remerciements;
  if (r.resumeFr)         patch.resume           = r.resumeFr;
  if (r.abstractEn)       patch.abstract         = r.abstractEn;
  if (r.motsCles?.length) patch.motsCles         = r.motsCles;
  if (r.abreviations?.length) patch.abreviations = r.abreviations;
  if (r.sommaire)         patch.sommaireText     = r.sommaire;
  if (r.introduction)     patch.introduction     = r.introduction;
  if (r.partieI)          patch.partieI          = r.partieI;
  if (r.partieII)         patch.partieII         = r.partieII;
  if (r.conclusion)       patch.conclusion       = r.conclusion;
  if (r.bibliographieText) patch.bibliographieText = r.bibliographieText;
  if (r.problematique)    patch.problematique    = r.problematique;
  if (Object.keys(patch).length === 0) return;
  try {
    const current = getReport();
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // non-fatal
  }
}

/**
 * Auto-saves a partial report snapshot whenever any dependency changes.
 * Uses a 600 ms debounce so saves don't fire on every keystroke.
 */
export function useAutoSave(data: Partial<ReportData>, deps: unknown[]): void {
  useEffect(() => {
    const t = setTimeout(() => saveReport(data), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

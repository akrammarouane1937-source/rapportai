import { useEffect } from "react";

const KEY = "rapportai_v1";

export interface ReportData {
  // Agent session ID — stored once after /api/session/start, reused for all generation calls
  sessionId?: string;

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

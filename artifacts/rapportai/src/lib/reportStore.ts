const KEY = "rapportai_v1";

export interface ReportData {
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
    return raw ? JSON.parse(raw) : {};
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

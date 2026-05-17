const KEY = "rapportai_figures_v1";

export interface ApprovedFigure {
  id: string;
  figureNumber: number;
  title: string;
  caption: string;
  type: "bar" | "line" | "pie" | "doughnut" | "uploaded";
  placement: "Partie I" | "Partie II";
  description: string;  // academic introduction sentence
  source: string;       // e.g. "Rapport annuel 2023, Office des Changes"
  author: string;       // e.g. "Direction financière" or "Auteur propre"
  pngBase64: string;    // data:image/png;base64,...
  labels: string[];
  series: number[];
  width: number;
  height: number;
}

export function getApprovedFigures(): ApprovedFigure[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ApprovedFigure[]) : [];
  } catch {
    return [];
  }
}

export function saveApprovedFigures(figures: ApprovedFigure[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(figures));
  } catch {
    // ignore quota errors
  }
}

export function addApprovedFigure(fig: ApprovedFigure): void {
  const existing = getApprovedFigures().filter((f) => f.id !== fig.id);
  saveApprovedFigures([...existing, fig].sort((a, b) => a.figureNumber - b.figureNumber));
}

export function removeApprovedFigure(id: string): void {
  saveApprovedFigures(getApprovedFigures().filter((f) => f.id !== id));
}

export function clearApprovedFigures(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

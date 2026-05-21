const KEY = "rapportai_figures_v2";

export type FigureSourceType = "self" | "document" | "web" | "framework";

export interface ApprovedFigure {
  id: string;
  figureNumber: number;
  title: string;
  caption: string;
  type: "bar" | "line" | "pie" | "doughnut" | "uploaded";
  placement: "Partie I" | "Partie II";
  description: string;  // academic introduction sentence
  // Source attribution (required — every figure must have proper caption)
  sourceType:   FigureSourceType; // determines caption format
  source:       string;           // e.g. "Rapport annuel 2023, Office des Changes"
  author:       string;           // e.g. "Direction financière" or "Auteur propre"
  documentTitle?: string;         // for sourceType === "document"
  yearCreated?:  string;          // year for citation
  pageRef?:      string;          // "p. 42" for document sources
  // Formatted full caption string (computed from sourceType fields)
  formattedSource: string;        // "Source : Auteur, Titre, 2023, p. 5"
  pngBase64: string;              // data:image/png;base64,...
  labels: string[];
  series: number[];
  width: number;
  height: number;
}

// Build the formatted "Source : ..." line from structured fields
export function buildFormattedSource(fig: Pick<ApprovedFigure, "sourceType" | "author" | "documentTitle" | "yearCreated" | "pageRef">): string {
  const year = fig.yearCreated || new Date().getFullYear().toString();
  switch (fig.sourceType) {
    case "self":
      return `Source : Élaboré par l'auteur, ${year}`;
    case "document":
      return [
        "Source :",
        fig.author,
        fig.documentTitle ? `, ${fig.documentTitle}` : "",
        `, ${year}`,
        fig.pageRef ? `, p. ${fig.pageRef}` : "",
      ].filter(Boolean).join("");
    case "framework":
      return `Source : ${fig.author}, adapté par l'auteur`;
    case "web":
    default:
      return `Source : ${fig.author}, ${year}`;
  }
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

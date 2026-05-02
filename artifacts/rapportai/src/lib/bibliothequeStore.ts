const KEY = "rapportai_biblio_v1";

export type SourceType = "pdf" | "doi" | "bib" | "scholar";

export interface BibSource {
  id: string;
  title: string;
  authors: string;
  year: string;
  journal?: string;
  doi?: string;
  url?: string;
  type: SourceType;
  usedIn: string[]; // e.g. ["Partie I", "Partie II"]
  addedAt: number;
  fileName?: string;
}

export function getBibSources(): BibSource[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as BibSource[]) : [];
  } catch { return []; }
}

export function saveBibSources(sources: BibSource[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(sources)); } catch { /* quota */ }
}

export function addBibSource(source: BibSource): void {
  const existing = getBibSources().filter((s) => s.id !== source.id);
  saveBibSources([source, ...existing]);
}

export function removeBibSource(id: string): void {
  saveBibSources(getBibSources().filter((s) => s.id !== id));
}

export function makeId(): string {
  return `bib-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Parse minimal .bib file into BibSource entries */
export function parseBib(text: string): BibSource[] {
  const entries: BibSource[] = [];
  const entryRe = /@\w+\{[^,]+,([^@]*)\}/gs;
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(text)) !== null) {
    const body = m[1];
    const get = (field: string) => {
      const re = new RegExp(`${field}\\s*=\\s*[{"]([^}"]+)[}"]`, "i");
      return re.exec(body)?.[1]?.trim() ?? "";
    };
    const title = get("title");
    if (!title) continue;
    entries.push({
      id: makeId(),
      title,
      authors: get("author") || get("editor") || "Auteur inconnu",
      year: get("year") || get("date")?.slice(0, 4) || "?",
      journal: get("journal") || get("booktitle") || undefined,
      doi: get("doi") || undefined,
      type: "bib",
      usedIn: [],
      addedAt: Date.now(),
    });
  }
  return entries;
}

/** Detect which report sections mention a source (by author last name) */
export function detectUsedIn(
  source: BibSource,
  partieI?: string,
  partieII?: string,
  intro?: string,
): string[] {
  const lastName = source.authors.split(/[,& ]/)[0].trim().toLowerCase();
  if (lastName.length < 3) return [];
  const sections: string[] = [];
  if (intro && intro.toLowerCase().includes(lastName)) sections.push("Introduction");
  if (partieI && partieI.toLowerCase().includes(lastName)) sections.push("Partie I");
  if (partieII && partieII.toLowerCase().includes(lastName)) sections.push("Partie II");
  return sections;
}

/** Fetch CrossRef metadata for a DOI */
export async function fetchDoi(doi: string): Promise<Partial<BibSource>> {
  const clean = doi.replace(/^https?:\/\/(dx\.)?doi\.org\//, "").trim();
  const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
  if (!res.ok) throw new Error("DOI introuvable");
  const json = await res.json() as { message: Record<string, unknown> };
  const m = json.message;
  const titleArr = m.title as string[] | undefined;
  const authorArr = m.author as Array<{ family?: string; given?: string }> | undefined;
  const dateArr = m["published"] as { "date-parts": number[][] } | undefined;
  const journalArr = m["container-title"] as string[] | undefined;
  return {
    title: titleArr?.[0] ?? "Titre inconnu",
    authors: authorArr?.map((a) => `${a.family ?? ""} ${a.given ?? ""}`.trim()).join(", ") ?? "Auteur inconnu",
    year: String(dateArr?.["date-parts"]?.[0]?.[0] ?? "?"),
    journal: journalArr?.[0],
    doi: clean,
    url: `https://doi.org/${clean}`,
  };
}

import { create } from "zustand";
import { persist } from "zustand/middleware";

// User-level formatting preferences (mise en forme). Applies to ALL the user's
// reports. Defaults seeded from the school canevas (EMSI/standard Moroccan PFE).
// Split conceptually: "visual" fields drive the Word/PDF export; "content" fields
// are also injected into the generation prompts so the AI respects them.
export interface FormattingPrefs {
  // ── Visual (export) ──────────────────────────────────────────────
  fontFamily: string;            // "Times New Roman"
  fontSize: number;              // 12 (pt)
  lineSpacing: number;           // 1.5
  firstLineIndentCm: number;     // 1
  justified: boolean;            // true
  paragraphSpacingPt: number;    // 6 (before/after)
  marginCm: number;              // 2.5 (all sides)
  headerFooterMarginCm: number;  // 1.0
  headingSize1: number;          // 16 (pt)
  headingSize2: number;          // 14
  headingSize3: number;          // 12
  newPagePerChapter: boolean;    // true
  romanFrontMatter: boolean;     // true (roman numerals front matter, arabic from intro)

  // ── Content (generation) + shared ────────────────────────────────
  citationStyle: string;         // "APA 7th ed."
  citationPageNumbers: boolean;  // true (show page numbers in citations)
  lowercaseTitles: boolean;      // true (avoid uppercase in titles/text)
  emphasisNoUnderline: boolean;  // true (italic/bold for emphasis, never underline)
  considerExternalSources: boolean; // true
  considerLibrarySources: boolean;  // true
}

export const DEFAULT_FORMATTING: FormattingPrefs = {
  fontFamily: "Times New Roman",
  fontSize: 12,
  lineSpacing: 1.5,
  firstLineIndentCm: 1,
  justified: true,
  paragraphSpacingPt: 6,
  marginCm: 2.5,
  headerFooterMarginCm: 1.0,
  headingSize1: 16,
  headingSize2: 14,
  headingSize3: 12,
  newPagePerChapter: true,
  romanFrontMatter: true,

  citationStyle: "APA 7th ed.",
  citationPageNumbers: true,
  lowercaseTitles: true,
  emphasisNoUnderline: true,
  considerExternalSources: true,
  considerLibrarySources: true,
};

interface UserSettingsStore {
  formatting: FormattingPrefs;
  updateFormatting: (data: Partial<FormattingPrefs>) => void;
  resetFormatting: () => void;
}

export const useUserSettingsStore = create<UserSettingsStore>()(
  persist(
    (set) => ({
      formatting: DEFAULT_FORMATTING,
      updateFormatting: (data) =>
        set((state) => ({ formatting: { ...state.formatting, ...data } })),
      resetFormatting: () => set({ formatting: DEFAULT_FORMATTING }),
    }),
    { name: "rapportai_user_settings" }
  )
);

// Build the compact "content" block injected into generation prompts so the AI
// respects the formatting choices that actually affect text (not fonts/margins).
export function buildFormattingPromptBlock(f: FormattingPrefs): string {
  const sources = [
    f.considerExternalSources ? "sources web/externes" : null,
    f.considerLibrarySources ? "sources de la bibliothèque" : null,
  ].filter(Boolean).join(" et ");
  return `## MISE EN FORME — RESPECT OBLIGATOIRE
- Style de citation : ${f.citationStyle}${f.citationPageNumbers ? " (inclure le numéro de page dans les citations)" : ""}
- Titres : ${f.lowercaseTitles ? "en minuscules (évite les majuscules sauf en début de phrase et noms propres)" : "capitalisation standard"}
- Mise en valeur : ${f.emphasisNoUnderline ? "utilise l'italique ou le gras, JAMAIS le soulignement" : "italique/gras"}
${sources ? `- Sources à considérer : ${sources}` : ""}`;
}

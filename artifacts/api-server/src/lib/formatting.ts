// Formatting preferences ("mise en forme") sent from the frontend user-settings store.
// Only the CONTENT-affecting fields matter for generation prompts; the visual fields
// (font, margins, spacing) are applied at export time, not by the writing agent.
export interface FormattingPrefs {
  citationStyle?: string;
  citationPageNumbers?: boolean;
  lowercaseTitles?: boolean;
  emphasisNoUnderline?: boolean;
  considerExternalSources?: boolean;
  considerLibrarySources?: boolean;
  // visual fields may also be present (fontFamily, marginCm, …) — ignored here
  [key: string]: unknown;
}

// Compact block injected into BOTH prompt builders so every agent + sub-agent
// respects the student's formatting choices that actually affect the text.
export function buildFormattingPromptBlock(f?: FormattingPrefs): string {
  if (!f) return "";
  const sources = [
    f.considerExternalSources ? "sources web/externes" : null,
    f.considerLibrarySources ? "sources de la bibliothèque" : null,
  ].filter(Boolean).join(" et ");

  const lines = [
    f.citationStyle
      ? `- Style de citation : ${f.citationStyle}${f.citationPageNumbers ? " (inclure le numéro de page dans les citations)" : ""}`
      : null,
    f.lowercaseTitles
      ? `- Titres : en minuscules (évite les majuscules, sauf début de phrase et noms propres)`
      : null,
    f.emphasisNoUnderline
      ? `- Mise en valeur : italique ou gras uniquement, JAMAIS le soulignement`
      : null,
    sources ? `- Sources à considérer : ${sources}` : null,
  ].filter(Boolean);

  if (lines.length === 0) return "";
  return `\n\n## MISE EN FORME — RESPECT OBLIGATOIRE\n${lines.join("\n")}`;
}

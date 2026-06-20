// Deterministic post-processing for French academic AI-writing tells.
// Applied after EVERY humanizer pass (both pipelines). Removes the mechanical
// fingerprints (R14 em-dashes, R23 filler, R27 authority tropes, R28 signposting,
// R31 AI vocab, R35 label pattern, R36 over-explained transitions) 100% of the time,
// for free, with zero timeout risk — so the LLM only has to handle the structural
// patterns (R10/R32/R34: parallel lists, rule-of-three, burstiness).
//
// Ported from the working humanizer's systematic_skill_pass.py + the regex pass
// reviewed alongside it. Runs in <1ms.

const EM_DASH = "—";

// ── Lexical substitutions (R31 AI vocab, R23 filler) — safe, high-frequency ───
// [pattern, replacement]. Order matters: longer/more specific first.
const SUBSTITUTIONS: Array<[RegExp, string]> = [
  // Connectors
  [/\bnéanmoins\b/gi, "mais"],
  [/\btoutefois\b/gi, "mais"],
  [/\bdavantage\b/gi, "plus"],
  [/\bnotamment\b/gi, "en particulier"],
  // Emphasis adverbs (AI tells)
  [/\bvéritablement\b/gi, "vraiment"],
  [/\bréellement\b/gi, "vraiment"],
  [/\bindéniablement\b/gi, "clairement"],
  [/\bincontestablement\b/gi, "clairement"],
  [/\bindiscutablement\b/gi, "clairement"],
  [/\bsystématiquement\b/gi, "toujours"],
  [/\bconsidérablement\b/gi, "fortement"],
  [/\bsignificativement\b/gi, "nettement"],
  [/\bsubstantiellement\b/gi, "nettement"],
  // Inflated adjectives
  [/\bcruciale\b/gi, "centrale"],
  [/\bcrucial\b/gi, "central"],
  [/\bfondamentale\b/gi, "essentielle"],
  [/\bfondamental\b/gi, "essentiel"],
  // Copula avoidance (R7/R8)
  [/\bconstituent\b/gi, "sont"],
  [/\bconstitue\b/gi, "est"],
  [/\bs'inscrivent dans\b/gi, "font partie de"],
  [/\bs'inscrit dans\b/gi, "fait partie de"],
  [/\bmettent en évidence\b/gi, "montrent"],
  [/\bmet en évidence\b/gi, "montre"],
  [/\bmet en lumière\b/gi, "montre"],
  // Filler prepositional phrases (R23)
  [/\bafin de\b/gi, "pour"],
  [/\ben vue de\b/gi, "pour"],
  [/\bdans le but de\b/gi, "pour"],
  [/\bdans le cadre de\b/gi, "dans"],
  [/\bdans le contexte de\b/gi, "dans"],
  [/\bpar le biais de\b/gi, "via"],
  [/\bau moyen de\b/gi, "avec"],
  [/\bcompte tenu de\b/gi, "vu"],
  [/\ben termes de\b/gi, "en"],
  [/\ben matière de\b/gi, "en"],
];

// ── Phrase removals (R36 transitions, R28 signposting, R27 tropes) ────────────
const REMOVALS: Array<[RegExp, string]> = [
  // R36 over-explained transitions
  [/C'est (?:précisément )?dans ce contexte que /g, ""],
  [/C'est (?:précisément )?sur cette base que /g, ""],
  [/C'est (?:précisément )?pour cette raison que /g, "C'est pourquoi "],
  [/C'est (?:précisément )?en ce sens que /g, ""],
  [/C'est (?:précisément )?dans cette perspective que /g, ""],
  [/Il convient de noter que /gi, ""],
  [/Il convient de préciser que /gi, ""],
  [/Il convient de souligner que /gi, ""],
  [/Il convient de rappeler que /gi, ""],
  [/Il convient de mentionner que /gi, ""],
  [/Il importe de (?:noter|souligner|préciser) que /gi, ""],
  [/Il est important de noter que /gi, ""],
  [/Il est important de souligner que /gi, ""],
  [/Il est essentiel de (?:noter|souligner) que /gi, ""],
  [/Il est intéressant de noter que /gi, ""],
  [/Il y a lieu de noter que /gi, ""],
  [/Force est de constater que /gi, ""],
  [/On notera que /gi, ""],
  [/On peut (?:également )?noter que /gi, ""],
  [/À cet égard,? /gi, ""],
  [/À ce titre,? /gi, ""],
  // R28 signposting
  [/Nous allons (?:maintenant |à présent )?(?:aborder|examiner|analyser|explorer|étudier) /gi, ""],
  [/(?:Telle est|Telle sera) la question (?:centrale|principale|fondamentale) /gi, "La question est "],
  [/Dans ce qui suit,? /gi, ""],
  // R27 authority tropes
  [/au cœur (?:même )?de /gi, "dans "],
  [/au centre (?:même )?de /gi, "dans "],
  [/(?:en réalité|en vérité|à vrai dire),? /gi, ""],
  [/la (?:vraie|véritable|réelle) question (?:est|reste|demeure) /gi, "la question est "],
];

export function regexHumanizeFR(text: string): string {
  let t = text;

  // R14: Em dashes — hardest AI tell, zero tolerance.
  t = t.replace(new RegExp(` ${EM_DASH} `, "g"), ", ");
  t = t.replace(new RegExp(`${EM_DASH} `, "g"), ", ");
  t = t.replace(new RegExp(` ${EM_DASH}`, "g"), ",");
  t = t.replace(new RegExp(EM_DASH, "g"), ", ");

  for (const [pat, rep] of REMOVALS) t = t.replace(pat, rep);
  for (const [pat, rep] of SUBSTITUTIONS) t = t.replace(pat, rep);

  // ── Cleanup artifacts from removals ───────────────────────────────────────
  t = t.replace(/  +/g, " ");
  t = t.replace(/ ,/g, ",");
  t = t.replace(/ \./g, ".");
  t = t.replace(/\.\s*\./g, ".");
  t = t.replace(/,\s*,/g, ",");
  // Capitalize after a sentence-ending period when a removal left a lowercase start.
  t = t.replace(/(\. )([a-zàâäéèêëîïôöùûüç])/g, (_, dot, c) => dot + c.toUpperCase());
  // Capitalize the first letter of each line/paragraph if a removal exposed lowercase.
  t = t.replace(/(^|\n)\s*,?\s*([a-zàâäéèêëîïôöùûüç])/g, (_, nl, c) => nl + c.toUpperCase());

  return t.trim();
}

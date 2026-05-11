export interface SchoolInfo {
  fullName: string;
  city?: string;
  website?: string;
  type: "engineering" | "commerce" | "science" | "law" | "medicine" | "arts" | "management" | "other";
}

export const MOROCCAN_SCHOOLS: Record<string, SchoolInfo> = {
  // ── Engineering ──────────────────────────────────────────────────────────────
  "EMI":    { fullName: "École Mohammadia d'Ingénieurs", city: "Rabat", website: "emi.ac.ma", type: "engineering" },
  "EMSI":   { fullName: "École Marocaine des Sciences de l'Ingénieur", city: "Casablanca", website: "emsi.ac.ma", type: "engineering" },
  "ENSA":   { fullName: "École Nationale des Sciences Appliquées", type: "engineering" },
  "ENSAM":  { fullName: "École Nationale Supérieure des Arts et Métiers", city: "Meknès", website: "ensam-umi.ac.ma", type: "engineering" },
  "ENSMR":  { fullName: "École Nationale Supérieure des Mines de Rabat", city: "Rabat", website: "ensmr.ac.ma", type: "engineering" },
  "EHTP":   { fullName: "École Hassania des Travaux Publics", city: "Casablanca", website: "ehtp.ac.ma", type: "engineering" },
  "INPT":   { fullName: "Institut National des Postes et Télécommunications", city: "Rabat", website: "inpt.ac.ma", type: "engineering" },
  "ESITH":  { fullName: "École Supérieure des Industries du Textile et de l'Habillement", city: "Casablanca", website: "esith.ac.ma", type: "engineering" },
  "IAV":    { fullName: "Institut Agronomique et Vétérinaire Hassan II", city: "Rabat", website: "iav.ac.ma", type: "engineering" },
  "SUPMTI": { fullName: "École Supérieure Privée de Management des Technologies de l'Information", city: "Rabat", type: "engineering" },

  // ── Commerce & Management ─────────────────────────────────────────────────
  "ENCG":   { fullName: "École Nationale de Commerce et de Gestion", type: "commerce" },
  "ENCGC":  { fullName: "École Nationale de Commerce et de Gestion de Casablanca", city: "Casablanca", website: "encg-casablanca.ac.ma", type: "commerce" },
  "ENCGF":  { fullName: "École Nationale de Commerce et de Gestion de Fès", city: "Fès", website: "encg-fes.ac.ma", type: "commerce" },
  "ENCGT":  { fullName: "École Nationale de Commerce et de Gestion de Tanger", city: "Tanger", website: "encgt.ac.ma", type: "commerce" },
  "ISCAE":  { fullName: "Institut Supérieur de Commerce et d'Administration des Entreprises", city: "Casablanca", website: "iscae.ac.ma", type: "commerce" },
  "HEM":    { fullName: "Hautes Études de Management", city: "Casablanca", website: "hem.ac.ma", type: "management" },
  "ESTEM":  { fullName: "École Supérieure de Technologie et de Management", type: "management" },
  "ENAM":   { fullName: "École Nationale d'Administration et de Magistrature", city: "Rabat", type: "management" },

  // ── Sciences ──────────────────────────────────────────────────────────────
  "FST":    { fullName: "Faculté des Sciences et Techniques", type: "science" },
  "FS":     { fullName: "Faculté des Sciences", type: "science" },
  "FSTM":   { fullName: "Faculté des Sciences et Techniques de Mohammadia", city: "Mohammadia", type: "science" },
  "FSR":    { fullName: "Faculté des Sciences de Rabat", city: "Rabat", type: "science" },

  // ── Law & Economics ───────────────────────────────────────────────────────
  "FSJES":  { fullName: "Faculté des Sciences Juridiques, Économiques et Sociales", type: "law" },
  "FSJEST": { fullName: "Faculté des Sciences Juridiques, Économiques et Sociales de Tanger", city: "Tanger", type: "law" },
  "FSJESR": { fullName: "Faculté des Sciences Juridiques, Économiques et Sociales de Rabat", city: "Rabat", type: "law" },

  // ── Medicine ──────────────────────────────────────────────────────────────
  "FMPM":   { fullName: "Faculté de Médecine et de Pharmacie de Marrakech", city: "Marrakech", type: "medicine" },
  "FMPR":   { fullName: "Faculté de Médecine et de Pharmacie de Rabat", city: "Rabat", type: "medicine" },
  "FMDC":   { fullName: "Faculté de Médecine Dentaire de Casablanca", city: "Casablanca", type: "medicine" },

  // ── Arts & Letters ────────────────────────────────────────────────────────
  "FLSH":   { fullName: "Faculté des Lettres et des Sciences Humaines", type: "arts" },
  "FSE":    { fullName: "Faculté des Sciences de l'Éducation", city: "Rabat", type: "arts" },

  // ── Private universities ──────────────────────────────────────────────────
  "UIR":    { fullName: "Université Internationale de Rabat", city: "Rabat", website: "uir.ac.ma", type: "other" },
  "UIC":    { fullName: "Université Internationale de Casablanca", city: "Casablanca", website: "uic.ac.ma", type: "other" },
  "UMP":    { fullName: "Université Mohammed Premier", city: "Oujda", website: "ump.ac.ma", type: "other" },
  "UM5":    { fullName: "Université Mohammed V de Rabat", city: "Rabat", website: "um5.ac.ma", type: "other" },
  "UH2C":   { fullName: "Université Hassan II de Casablanca", city: "Casablanca", website: "uh2c.ac.ma", type: "other" },
  "UCA":    { fullName: "Université Cadi Ayyad de Marrakech", city: "Marrakech", website: "uca.ac.ma", type: "other" },
  "UAE":    { fullName: "Université Abdelmalek Essaadi", city: "Tanger", website: "uae.ac.ma", type: "other" },
  "USMBA":  { fullName: "Université Sidi Mohammed Ben Abdellah", city: "Fès", website: "usmba.ac.ma", type: "other" },
};

// Resolve abbreviation to full info — falls back to the input as-is
export function resolveSchool(input: string): SchoolInfo & { abbr: string } {
  const key = input.trim().toUpperCase();
  const found = MOROCCAN_SCHOOLS[key];
  if (found) return { ...found, abbr: key };

  // Try partial match (e.g. "ENCG Casablanca" → ENCGC)
  for (const [abbr, info] of Object.entries(MOROCCAN_SCHOOLS)) {
    if (key.includes(abbr) || info.fullName.toUpperCase().includes(key)) {
      return { ...info, abbr };
    }
  }

  return { fullName: input, type: "other", abbr: input };
}

// Build a string for system prompts
export function schoolContext(input: string): string {
  const s = resolveSchool(input);
  const city = s.city ? ` — ${s.city}` : "";
  const web = s.website ? ` (${s.website})` : "";
  return s.fullName !== input
    ? `${input} = ${s.fullName}${city}${web}`
    : input;
}

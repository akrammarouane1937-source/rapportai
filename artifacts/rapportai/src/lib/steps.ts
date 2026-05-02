export const REPORT_STEPS = [
  { id: 1, label: "Informations Générales", short: "01", path: "/rapport/step-1" },
  { id: 2, label: "Page de Garde",          short: "02", path: "/rapport/step-2" },
  { id: 3, label: "Dédicaces + Remerciements", short: "03", path: "/rapport/step-3" },
  { id: 4, label: "Résumé + Abstract",      short: "04", path: "/rapport/step-4" },
  { id: 5, label: "Sommaire",               short: "05", path: "/rapport/step-5" },
  { id: 6, label: "Introduction Générale",  short: "06", path: "/rapport/step-6" },
  { id: 7, label: "Partie I",               short: "07", path: "/rapport/partie-i" },
  { id: 8, label: "Partie II",              short: "08", path: "/rapport/partie-ii" },
  { id: 9, label: "Conclusion",             short: "09", path: "/rapport/step-9" },
] as const;

export const TOTAL_STEPS = REPORT_STEPS.length;

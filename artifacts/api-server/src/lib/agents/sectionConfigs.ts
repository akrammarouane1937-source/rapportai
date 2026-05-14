// Section agent config map — one entry per section generator
// Each entry defines the skills file, maxTurns, dependencies, and tools
// The generate route reads this to specialize each query() call

import type { StudentMemory } from "../memory-types";

export interface SectionConfig {
  skillsFile: string;           // filename inside src/lib/skills/
  maxTurns: number;
  dependencies: string[];       // filenames to read from session dir before generating
  allowedTools: string[];
  description: string;          // shown in frontend streaming status
}

export const SECTION_CONFIGS: Record<string, SectionConfig> = {

  sommaire: {
    skillsFile:   "sommaire-skills.md",
    maxTurns:     5,
    dependencies: ["generation_context.md"],
    allowedTools: ["Read", "Write"],
    description:  "Génération du plan et du sommaire",
  },

  dedicaces: {
    skillsFile:   "dedicaces-skills.md",
    maxTurns:     3,
    dependencies: ["generation_context.md"],
    allowedTools: ["Read", "Write"],
    description:  "Rédaction des dédicaces",
  },

  remerciements: {
    skillsFile:   "remerciements-skills.md",
    maxTurns:     3,
    dependencies: ["generation_context.md"],
    allowedTools: ["Read", "Write"],
    description:  "Rédaction des remerciements",
  },

  resume: {
    skillsFile:   "resume-skills.md",
    maxTurns:     3,
    dependencies: ["generation_context.md", "introduction.md"],
    allowedTools: ["Read", "Write"],
    description:  "Rédaction du résumé et abstract",
  },

  introduction: {
    skillsFile:   "introduction-skills.md",
    maxTurns:     5,
    dependencies: ["generation_context.md"],
    allowedTools: ["Read", "Write"],
    description:  "Rédaction de l'introduction générale",
  },

  "partie-i": {
    skillsFile:   "partie-i-skills.md",
    maxTurns:     20,
    dependencies: ["generation_context.md", "sommaire.md", "introduction.md"],
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebFetch", "WebSearch"],
    description:  "Rédaction du cadre théorique (Partie I)",
  },

  "partie-ii": {
    skillsFile:   "partie-ii-skills.md",
    maxTurns:     20,
    dependencies: ["generation_context.md", "sommaire.md", "introduction.md", "partie-i.md"],
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebFetch", "WebSearch"],
    description:  "Rédaction de l'étude empirique (Partie II)",
  },

  conclusion: {
    skillsFile:   "conclusion-skills.md",
    maxTurns:     6,
    dependencies: ["generation_context.md", "introduction.md", "partie-i.md", "partie-ii.md"],
    allowedTools: ["Read", "Write", "Edit", "Bash", "Glob"],
    description:  "Rédaction de la conclusion générale",
  },

  bibliographie: {
    skillsFile:   "bibliographie-skills.md",
    maxTurns:     8,
    dependencies: ["generation_context.md", "introduction.md", "partie-i.md", "partie-ii.md", "conclusion.md"],
    allowedTools: ["Read", "Write", "Glob", "Grep", "WebFetch", "WebSearch"],
    description:  "Génération de la bibliographie",
  },
};

export function getSectionConfig(section: string): SectionConfig {
  const config = SECTION_CONFIGS[section];
  if (!config) throw new Error(`Unknown section: "${section}". Valid sections: ${Object.keys(SECTION_CONFIGS).join(", ")}`);
  return config;
}

// Build the mandatory context block injected into every section agent's system prompt
export function buildMemoryContext(memory: StudentMemory): string {
  const r = memory.report;
  const i = memory.identity;
  const p = memory.progress;

  const hypotheses = r.hypotheses
    ? Object.entries(r.hypotheses).map(([k, v]) => `- ${k}: ${v}`).join("\n")
    : "Non définies";

  const objectifs = r.objectifs?.map(o => `- ${o}`).join("\n") ?? "Non définis";

  const completed = p.sections_completed.length > 0
    ? p.sections_completed.join(", ")
    : "Aucune";

  return `
## MÉMOIRE ÉTUDIANT — CONTEXTE OBLIGATOIRE

**Étudiant:** ${i.full_name} | ${i.school} — ${i.filiere} | ${i.academic_year ?? ""}
**Rapport:** ${r.title ?? "Titre non défini"} (${r.type})
**Encadrant:** ${i.supervisor?.name ?? "Non précisé"}
**Entreprise:** ${r.company?.name ?? "Non précisée"}

**Problématique retenue:**
${r.problematique ?? "Non définie — à établir dans cette section"}

**Hypothèses:**
${hypotheses}

**Objectifs:**
${objectifs}

**Cadre théorique:**
${r.theoretical_framework?.model ?? "Non défini"}
Auteurs clés: ${r.theoretical_framework?.key_authors?.join(", ") ?? "À définir"}
Méthodologie: ${r.theoretical_framework?.methodology ?? "À définir"}

**Sections déjà complétées:** ${completed}

**Style de citation:** ${memory.writing_profile.citation_style}
${r.canevas_uploaded ? `**Canevas uploadé:** ${r.canevas_filename} — LIRE EN PREMIER et respecter sa structure exacte.` : ""}

---
NE JAMAIS contredire la problématique, les hypothèses ou le cadre théorique ci-dessus.
`;
}

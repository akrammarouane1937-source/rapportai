---
name: rapportai-conclusion
description: >
  Generates the Conclusion Générale of a Moroccan academic report — direct answer to
  the problématique, apports, limites, perspectives. Requires partie-i.md and partie-ii.md.
  500–700 words. Four mandatory sections. No banned vocabulary.
allowed-tools: Read, Write, Edit, Glob
---

# RapportAI — Conclusion Generator

Generates the Conclusion Générale: Synthèse → Apports → Limites → Perspectives.

---

## Hard Prerequisites

1. `partie-i.md` must exist
2. `partie-ii.md` must exist

Both missing → error immediately.

---

## Four Mandatory Sections

| Section | Words | Key rule |
|---|---|---|
| Synthèse des résultats | 150–200 | Direct answer to problématique + hypothesis outcomes |
| Apports et contributions | 100–150 | Theoretical + practical + Moroccan context |
| Limites de l'étude | 80–120 | Specific, not minimized |
| Perspectives et voies de recherche | 100–150 | 3–4 concrete directions + strong closing sentence |

**Total: 500–700 words**

---

## What to extract before writing

From `introduction.md` / `student_memory.json`:
- Exact wording of the problématique

From `partie-ii.md`:
- Each hypothesis outcome: H1 confirmed / partially / rejected
- The 3–4 most significant findings

From `partie-i.md`:
- Main theoretical framework(s) retained

---

## Humanization rules

- Banned: s'inscrire dans, mettre en lumière, jouer un rôle essentiel, il convient de noter, enjeux (vague), incontournable, de nos jours
- Replace constitue/représente → est/sont
- Final sentence must be a specific affirmation, never "les perspectives sont prometteuses"

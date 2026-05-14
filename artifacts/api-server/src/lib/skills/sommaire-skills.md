---
name: rapportai-sommaire
description: >
  Generates the report plan (sommaire.md) — the complete table of contents used by all
  subsequent section agents. Reads canevas if uploaded, falls back to student-uploaded plan,
  falls back to AI generation from theme + filière. Produces a parseable sommaire.md with
  Partie I and Partie II blocks. Trigger when section is "sommaire" or when the student
  requests "générer le plan", "créer le sommaire", or "définir la structure du rapport".
allowed-tools:
  - Read
  - Write
---

# RapportAI — Sommaire Agent

Generates `sommaire.md` — the single source of truth for all section agents.
Priority: canevas uploaded → student plan file → AI generation from theme + filière.

---

## Source Priority

| Priority | Source | Condition |
|---|---|---|
| 1 | Uploaded canevas | `report.canevas_uploaded = true` in student_memory.json |
| 2 | Uploaded plan file | File with "plan", "sommaire", "outline" in name exists in workdir |
| 3 | AI generation | No plan or canevas found |

---

## Output Format (parseable by all agents)

```
# Sommaire

## Introduction générale

## Partie I — [Titre]

### Chapitre 1 — [Titre]
- 1.1 [Section]
- 1.2 [Section]
- 1.3 [Section]

### Chapitre 2 — [Titre]
- 2.1 [Section]
- 2.2 [Section]

## Partie II — [Titre]

### Chapitre 1 — [Titre]
- 1.1 [Section]
- 1.2 [Section]

### Chapitre 2 — [Titre]
- 2.1 [Section]
- 2.2 [Section]

## Conclusion générale

## Bibliographie
```

Key markers (used by partie agents to locate their block):
- `## Partie I` — exact string, not negotiable
- `## Partie II` — exact string, not negotiable
- **Chapter numbering restarts at 1 in each partie** — Partie II always starts at Chapitre 1
- Section numbers follow the chapter within each partie (Partie II Ch. 1 → 1.1, 1.2…)

---

## Structure Rules

- Chapters per partie: **2–4**
- Sections per chapter: **2–5**
- Partie I = theoretical/conceptual only
- Partie II = applied/empirical only
- Titles must be informative and theme-specific — never generic ("Définitions", "Contexte")

---

## Report Type → Structure

| Type | Partie I | Partie II |
|---|---|---|
| PFE | Revue de littérature + modèles théoriques | Méthodologie + résultats + analyse |
| Rapport de stage | Présentation entreprise + cadre du stage | Missions réalisées + bilan critique |
| Mémoire | Revue de littérature approfondie | Étude empirique + résultats |

---

## Humanization Block

This agent produces structural titles, not prose. Humanization not applicable here.
Apply title quality rules instead: specific, academic, theme-driven.

---

## Quality Checklist

- [ ] sommaire.md saved with Write tool
- [ ] `## Partie I` and `## Partie II` exact markers present
- [ ] Chapter numbers continuous across both parties
- [ ] Section numbers follow their chapter (e.g., Ch. 3 → 3.1, 3.2)
- [ ] Titles are specific to the theme, not generic
- [ ] Partie I is theoretical, Partie II is applied
- [ ] 2–4 chapters per partie, 2–5 sections per chapter
- [ ] If canevas/plan uploaded: structure preserved exactly

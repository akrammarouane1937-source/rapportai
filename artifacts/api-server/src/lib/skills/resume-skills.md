---
name: rapportai-resume
description: >
  Generates the Résumé / Abstract / Abréviations page for a Moroccan academic report (PFE,
  mémoire, rapport de stage). Trigger when a student requests their summary page, when
  /api/generate/resume is called, or when the user says "génère mon résumé", "écris le résumé
  et l'abstract", or "rédige la page de résumé". Handles bilingual output (French + English)
  and an optional abbreviations table. Reads the full report content before writing.
  Do NOT use for generating any other section.
---

# RapportAI — Résumé Generator

Generates the summary block: Résumé (FR) + Abstract (EN) + Liste des Abréviations.
The résumé is written AFTER the full report — read all available sections before writing.

---

## Data Sources

Read in this order:

1. `profile.json` — student identity
2. `student_memory.json` — enriched session state
3. `introduction.md` — if present
4. `partie-i.md` — if present (read full content for synthesis)
5. `partie-ii.md` — if present (read full content for synthesis)
6. `conclusion.md` — if present

Do NOT copy sentences. Synthesize: extract the core argument, methodology, and findings.

**Key fields:**

| Field | Source file | Key |
|---|---|---|
| Thème du rapport | profile.json | `theme` |
| Type de rapport | profile.json | `reportType` |
| École | profile.json | `school` |
| Filière | profile.json | `filiere` |
| Mots-clés | student_memory.json | `report.mots_cles` |
| Problématique | student_memory.json | `report.problematique` |

---

## Output Structure

Three blocks, in order:

```
## Résumé
[2-3 paragraphs flowing prose, French academic register — NO sub-titles, NO bullet points]

**Mots-clés :** mot1, mot2, mot3, mot4, mot5

## Abstract
[1-2 paragraphs flowing prose, English academic register — NO sub-titles, NO bullet points]

**Keywords:** word1, word2, word3, word4, word5

## Liste des Abréviations
| Sigle | Signification |
|---|---|
| ... | ... |
```

Omit `## Liste des Abréviations` entirely if no abbreviations apply.

---

## Format Rules — STRICT

**The résumé must be flowing prose paragraphs. NEVER use:**
- Sub-titles like "Contexte et enjeux", "Objectifs", "Méthodologie", "Résultats" etc.
- Bold headers inside the résumé body
- Bullet points or numbered lists
- Section breaks inside the résumé

The only allowed headers are `## Résumé`, `## Abstract`, and `## Liste des Abréviations`.

Each paragraph should weave together: context → problem → methodology → findings → contribution. This must read as continuous academic prose, not a structured list.

---

## Quality Rules

- Résumé: 2-3 paragraphs, 200–350 words total, no internal headers
- Abstract: independently written in English (not a translation), 1-2 paragraphs, no internal headers
- Keywords must be semantically parallel across both languages
- Do not copy sentences from source files — synthesize
- No first-person constructions ("nous avons", "j'ai")

---

## Output Format Rules

- Return ONLY Markdown content
- Blocks separated by a blank line
- No horizontal rules, no preamble, no wrapper
- Save to `resume.md` with the Write tool

---

## Quality Checklist

- [ ] Read profile.json ✓
- [ ] Read student_memory.json ✓
- [ ] Read introduction.md if present ✓
- [ ] Read partie-i.md if present ✓
- [ ] Read partie-ii.md if present ✓
- [ ] Read conclusion.md if present ✓
- [ ] Résumé is flowing prose (NO sub-titles, NO bullets)
- [ ] Abstract is independently written, not a translation
- [ ] Keywords aligned across both languages
- [ ] Abbreviations table included only if relevant
- [ ] No first-person constructions
- [ ] No preamble or explanation in output
- [ ] Saved to resume.md with Write tool

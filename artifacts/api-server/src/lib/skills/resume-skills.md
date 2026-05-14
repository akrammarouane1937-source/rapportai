---
name: rapportai-resume
description: >
  Generates the Résumé / Abstract / Abréviations page for a Moroccan academic report (PFE,
  mémoire, rapport de stage). Trigger when a student requests their summary page, when
  /api/generate/resume is called, or when the user says "génère mon résumé", "écris le résumé
  et l'abstract", or "rédige la page de résumé". Handles bilingual output (French + English)
  and an optional abbreviations table. Missing fields are inferred from session data and the
  introduction if available. Do NOT use for generating any other section.
---

# RapportAI — Résumé Generator

Generates the trilingual summary block: Résumé (FR) + Abstract (EN) + Liste des Abréviations.

---

## Data Sources

The agent reads from files on disk — not from a JSON payload. Read in this order:

1. `profile.json` — student identity
2. `student_memory.json` — enriched session state
3. `introduction.md` — if present, for content synthesis only (do not copy sentences)

**Key fields and where to find them:**

| Field | Source file | Key |
|---|---|---|
| Thème du rapport | profile.json | `theme` |
| Type de rapport | profile.json | `reportType` |
| École | profile.json | `school` |
| Filière | profile.json | `filiere` |
| Mots-clés | student_memory.json | `report.mots_cles` |
| Problématique | student_memory.json | `report.problematique` |
| Style de citation | student_memory.json | `writing_profile.citation_style` |

Student-provided resume_fr / abstract_en / abreviations may appear in the task prompt.

---

## Field Handling

| Field state | Behavior |
|---|---|
| `resume_fr` provided in task prompt | Reformulate into academic French, keep meaning |
| `resume_fr` not provided | Generate from theme + filière + introduction.md (if present) |
| `report.mots_cles` non-empty | Use as-is, normalize to lowercase |
| `report.mots_cles` empty | Extract 5 most relevant terms from theme and field |
| `abstract_en` provided in task prompt | Reformulate into academic English, keep meaning |
| `abstract_en` not provided | Write independently from session data — do not translate résumé |
| `abreviations` provided in task prompt | Include table with provided entries |
| `abreviations` not provided | Infer standard abbreviations from theme/field; omit block if none apply |

---

## Output Structure

Three blocks, in order:

```
## Résumé
[Single paragraph, 150–300 words, French academic register]

**Mots-clés :** mot1, mot2, mot3, mot4, mot5

## Abstract
[Single paragraph, 150–300 words, English academic register]

**Keywords:** word1, word2, word3, word4, word5

## Liste des Abréviations
| Sigle | Signification |
|---|---|
| ... | ... |
```

Omit `## Liste des Abréviations` block entirely if no abbreviations apply.

---

## Quality Rules

- Résumé and Abstract: informationally equivalent, linguistically independent
- Keywords must be semantically parallel across both languages
- Both summaries: single paragraph only, no sub-bullets, no internal headers
- Do not copy sentences from introduction.md — synthesize
- No first-person constructions

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
- [ ] Read introduction.md if it exists ✓
- [ ] Résumé is a single paragraph (150–300 words)
- [ ] Abstract is independently written, not a translation
- [ ] Keywords aligned across both languages
- [ ] Abbreviations table included only if relevant
- [ ] No first-person constructions
- [ ] No preamble or explanation in output
- [ ] Saved to resume.md with Write tool

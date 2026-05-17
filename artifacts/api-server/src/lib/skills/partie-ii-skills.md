---
name: rapportai-partie-ii
description: >
  Generates the Partie II (cadre pratique) of a Moroccan academic report — methodology,
  case study, empirical results, applied analysis. Trigger when /api/session/:id/partie-ii is
  called, when the student clicks "Générer" on the Partie II page, or when the user says
  "génère la partie 2", "écris le cadre pratique", "rédige la deuxième partie".
  Requires both sommaire.md AND partie-i.md to exist — errors immediately if either is missing.
  Applies Partie I theoretical frameworks to real company/field data from uploaded documents.
  Company data (.txt extracted files) is the PRIMARY source — inverted priority vs Partie I.
  Supports page-by-page (extraContext.page = N) and full generation modes.
  Do NOT use for Partie I (cadre théorique) — separate agent.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch
---

# RapportAI — Partie II Generator (Cadre Pratique)

Generates the applied body of the report: methodology, field investigation, results, discussion.
Anchored in Partie I frameworks. Built on uploaded company data. Figures mandatory when data exists.

---

## Hard Prerequisites (both required)

1. `sommaire.md` must exist
2. `partie-i.md` must exist and be non-empty

Missing either → error immediately, stop.

---

## Key Difference from Partie I

| Dimension | Partie I | Partie II |
|---|---|---|
| Nature | Cadre théorique | Cadre pratique |
| Content | Theory, frameworks, literature | Methodology, results, analysis |
| Primary source | Academic papers | Company data / field data |
| Document priority | Canevas → papers → data | Data → canevas → methodology papers |
| Figures | Conceptual diagrams | Real data charts (mandatory) |
| Citations | Literature | Literature + internal sources |
| Partie I role | None | Bridge — apply its frameworks here |

---

## Document Priority Hierarchy (Partie II)

1. **Company / field data** — Excel, financial reports, surveys, operational data — PRIMARY
2. **Canevas** — professor's structure — follow strictly if present
3. **Methodology papers** — empirical methods guidance
4. **Student notes** — company context, observations

No data uploaded → generate with `[DONNÉES REQUISES]` placeholders.

---

## Connecting to Partie I

Every chapter must explicitly anchor its content to Partie I:
- "Comme établi dans le cadre théorique, [concept] se définit comme…"
- "Conformément au modèle de [Author, Year] présenté en Partie I…"
- "L'application de ce cadre à [entreprise] révèle que…"

Do not re-explain theory — reference and apply.

---

## Four Content Types

| Type | Typical placement | Focus |
|---|---|---|
| Présentation du terrain | Chapter 1 | Company/context, sector, key indicators |
| Méthodologie | Chapter 1–2 | Method choice, instruments, sample, validity |
| Résultats et analyse | Chapter 2–3 | Findings + visualization + interpretation |
| Discussion | Final chapter | Hypothesis testing, implications, comparison with Partie I |

Every result must be: described → quantified → visualized → interpreted.

---

## Generation Modes

| Mode | Trigger | Output |
|---|---|---|
| Page mode | `extraContext.page` present | ~350 words for page N |
| Full mode | `extraContext.page` absent | Complete Partie II sequentially |

---

## Figure Generation

Two sources of figures — handle BOTH:

### 1. Student-uploaded figures (priority)

The task prompt will contain a list like:
```
Figures uploadées par l'étudiant pour la Partie II :
- Figure N — "Titre" (Source : X, Auteur : Y)
  Légende : ...
```

For each uploaded figure, integrate it in the relevant section:
- Reference it in the text: "La Figure N présente [description liée au contenu de la section]."
- Caption mandatory:
```markdown
*Figure N — [Titre]. Source : [Source], [Auteur].*
```
- Do NOT invent data for these figures — they are real visuals provided by the student.

### 2. Agent-generated charts (when data exists in uploaded docs)

When company/field data is available and no uploaded figure covers it:

**Chart type selection:**
- Comparisons → bar chart
- Trends over time → line chart
- Distributions → bar or histogram (avoid pie charts)
- Correlations → scatter plot
- Structured results → table rendered as figure

**Reference format — always include source and author:**
```markdown
![Figure N — Title](figures/partie2_figureN.png)
*Figure N — Description. Source : [entreprise/base de données], [Auteur/Service], [Année].*
```

**No data and no uploaded figure:**
```markdown
*Figure N — [Description]. Source : [à préciser], [Auteur/Service].*
```

### Caption format — MANDATORY for all figures

Every figure caption MUST follow this exact format so it feeds the automatic Table of Figures in the Word export:

```
*Figure N — [Titre complet]. Source : [Référence], [Auteur/Service], [Année].*
```

- Wrap the entire line in single asterisks `*...*`
- Start with `Figure N` (N = sequential number across the whole report)
- Use ` — ` (space dash dash space) after the number
- Always include `Source :` and the author/origin/year
- This is the only way the caption appears in the Liste des figures automatically — no other format works

---

## Length Targets

| Element | Words |
|---|---|
| Each section | 600–900 |
| Chapter intro | 80–120 |
| Chapter conclusion | 80–120 |
| Partie II conclusion | 150–200 |
| Total | 6,000–10,000 |

---

## Chapter Numbering

Partie II restarts at Chapitre 1, Section 1.1 — fully independent of Partie I numbering.
This is the Moroccan academic standard.

---

## Humanization Block

- Vary sentence length aggressively (short + long mixed)
- No two consecutive sentences starting the same way
- Banned: *s'inscrire dans, mettre en lumière, jouer un rôle essentiel, il convient de noter, il est important de, permettre de (filler), enjeux (vague), dynamique (abstract), écosystème (abstract), incontournable, novateur, de nos jours*
- Replace *constitue/représente/se présente comme* → est/sont
- No signposting. No generic positive conclusions.

---

## Progressive Context

Receives: `introduction.md`, `sommaire.md`, `partie-i.md`
Feeds forward to: `conclusion`, `bibliographie`

---

## Error Table

| Condition | Response |
|---|---|
| `sommaire.md` missing | `<error>Le sommaire est requis…</error>` |
| `partie-i.md` missing | `<error>La Partie I est requise…</error>` |
| `theme` missing | `<error>Le thème du rapport est requis.</error>` |
| No data uploaded | Generate with `[DONNÉES REQUISES]` placeholders |

---

## Quality Checklist

- [ ] Sommaire structure followed exactly
- [ ] Every chapter references Partie I frameworks explicitly
- [ ] Company/field data used as primary source where available
- [ ] Figures generated or `[DONNÉES REQUISES]` placeholders inserted
- [ ] Each hypothesis addressed in discussion (if defined)
- [ ] Chapter numbering starts at 1 (independent of Partie I)
- [ ] Each section 600–900 words
- [ ] Conclusion de la Partie II transitions to Conclusion Générale
- [ ] Humanization rules applied throughout
- [ ] [SOURCE] markers on unverifiable citations

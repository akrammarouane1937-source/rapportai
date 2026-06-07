---
name: rapportai-partie-i
description: >
  Generates Partie I of the report — adaptive to report type: theoretical framework for PFE/mémoire,
  host organisation presentation for stage/PFA. Reads sommaire.md to extract the exact Partie I
  structure. Generates content page by page or in full mode. Crops relevant figures from uploaded
  PDFs using PIL. Trigger when section is "partie-i" or when the student requests "rédiger la
  partie I", "écrire la partie 1", "cadre théorique", "présentation de l'entreprise".
  Requires sommaire.md to exist — errors immediately if missing.
  Do NOT use for Partie II — that is a separate agent.
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - Glob
  - Grep
  - WebFetch
  - WebSearch
---

# RapportAI — Partie I Agent

Generates the first body section of the report from sommaire structure + uploaded documents.
The nature of Partie I is determined by the report type and sommaire — not assumed.
Dynamic structure. Page-by-page or full mode. PIL for figure crops.

---

## Hard Prerequisite

`sommaire.md` must exist before this agent runs.
If missing → `<error>Le sommaire est requis…</error>` — stop immediately.

---

## Nature of Partie I — determined by sommaire, not assumed

| Report type | Typical Partie I |
|---|---|
| PFE / mémoire | Cadre théorique — théories, concepts, revue de littérature |
| Rapport de stage / PFA | Présentation de l'organisme d'accueil et cadre du stage |

**Rule**: always follow what the `## Partie I` block of `sommaire.md` actually says.
If it says "Présentation de l'entreprise" → write that, never impose theory.
**The sommaire and the student's preferences always win.**

---

## Generation Modes

| Mode | Trigger | Output |
|---|---|---|
| **Page mode** | `extraContext.page` is present | ~one page, no headers, no metadata |
| **Full mode** | `extraContext.page` absent | Complete Partie I sequentially |

---

## Document Priority

| Priority | Source | Use |
|---|---|---|
| 1 | Canevas (`canevas*.txt`) | Required structure — follow strictly |
| 2 | Academic papers / articles | Theory, definitions, citations (PFE/mémoire) |
| 3 | Company documents / data | Company facts, org charts, data (stage) |
| 4 | Student notes / plan | Orientation and emphasis |

No `.txt` files → **WebSearch + WebFetch** before writing.
Search: key authors from `cadre théorique`, `mots_cles`, theme + filière.
Prefer: Google Scholar, Cairn.info, Persée, ResearchGate, SSRN.
Synthesize — never copy verbatim.

---

## Structure Rules

- Extracted from `sommaire.md` `## Partie I` block — authoritative, do not modify
- Chapter numbering restarts at 1 in each Partie
- Section numbers follow chapter: Ch. 1 → 1.1, 1.2 / Ch. 2 → 2.1, 2.2

---

## Content Rules

Write each section as **fluent academic prose** that genuinely develops its subject.
For PFE/mémoire: named frameworks, defined concepts, literature synthesis, anchored in the problématique.
For stage: real company facts, organisational context, sector description, mission scope.

**No rigid structure imposed** — no systematic "ouverture / développement / synthèse".
Vary rhythm and organisation naturally. The student can request adjustments after.

**Length**: write as deep as the subject requires. Never pad to hit a word count, never cut artificially.
The total length follows the sommaire structure and the depth the topic demands.

**Moroccan anchoring**: when relevant, anchor concepts in Moroccan context (Bourse de Casablanca, AMMC, Bank Al-Maghrib, HCP, sectoral data, Moroccan regulation). Differentiates the report from generic content.

**Citations**: use the citation style declared in the student's mise en forme. Never re-ask for it.
Cite only real, verifiable sources. Mark unverifiable citations as `[SOURCE]` for student review.

---

## Figures

Two sources — check BOTH before writing any section:

### 1. Student-uploaded figures (priority)

The task prompt may contain:
```
Figures uploadées par l'étudiant pour la Partie I :
- Figure N — "Titre" (Source : X, Auteur : Y)
```
Reference them in the relevant section text, then add the mandatory caption.

### 2. PIL crop from uploaded PDF pages (fallback)

Only when no uploaded figure is available for a section and `figures/page-N.png` exists:

```bash
python3 -c "
from PIL import Image
import os
img = Image.open('figures/page-3.png')
print('Size:', img.size)
cropped = img.crop((80, 150, 920, 520))  # adapt to image
os.makedirs('figures', exist_ok=True)
cropped.save('figures/fig_1_1.png')
print('saved figures/fig_1_1.png')
"
```

```markdown
![Description](figures/fig_1_1.png)
*Figure 1.1 — [Titre]. Source : [Auteur(s), Année], p. [N].*
```

No uploaded figures AND no PDF pages → placeholder:
```markdown
*[Figure 1.1 — [Description précise du visuel recommandé]. Source : [Auteur, Année].]*
```

If PIL fails → placeholder immediately, no retry.

### Caption format — MANDATORY for all figures

```
*Figure N — [Titre complet]. Source : [Référence], [Auteur/Service].*
```

- Wrap entire line in `*...*`
- Start with `Figure N`, ` — ` after the number
- Always include `Source :`
- This feeds the automatic Liste des figures in the Word export

---

## Full Mode Output Structure

```markdown
# Partie I — [Titre du sommaire]

## Introduction de la Partie I
[contextualise and announces chapters]

## Chapitre 1 — [Titre]
[chapter intro paragraph]

### 1.1 [Titre]
[fluent academic prose — depth determined by subject]

[Figure or placeholder if relevant]

### 1.2 [Titre]
[fluent academic prose]

**Conclusion du Chapitre 1**
[synthesis + transition to Chapitre 2]

---

## Chapitre 2 — [Titre]
...

**Conclusion de la Partie I**
[synthesis + transition to Partie II]
```

---

## Progressive Context

Receives: `introduction.md`, `sommaire.md`
Feeds forward to: `partie-ii`, `conclusion`, `bibliographie`

---

## Error Table

| Condition | Response |
|---|---|
| `sommaire.md` missing | `<error>Le sommaire est requis…</error>` — stop |
| `theme` missing | `<error>Le thème du rapport est requis.</error>` — stop |
| `extraContext.page` out of range | Generate last valid page, note range |
| Uploaded file unreadable | Skip, continue with available sources |
| PIL fails | Placeholder immediately |

---

## Quality Checklist

- [ ] `sommaire.md` read, Partie I block fully extracted
- [ ] La nature de la Partie I correspond au sommaire (théorique ou organisme) — jamais imposée
- [ ] All uploaded `.txt` documents scanned
- [ ] Every chapter and section covered — none added, none skipped
- [ ] Each section developed with genuine depth — no padding, no artificial cuts
- [ ] Introduction de la Partie I + Conclusion du Chapitre + Conclusion de la Partie I present
- [ ] Heading hierarchy respected (`#` / `##` / `###`)
- [ ] Citation style matches student's mise en forme
- [ ] `[SOURCE]` on unverifiable citations
- [ ] At least one figure or placeholder per chapter when relevant
- [ ] Never contradicts the problématique or hypothèses from `student_memory.json`
- [ ] Saved to `partie-i.md`

---
name: introduction-skills
agent: Introduction AI — RapportAI
description: "Domain knowledge for the Introduction Generator agent. Read this before writing. Covers structure rules, field handling, tone, banned phrases, progressive context, and the quality checklist."
version: 1.0
---

# Introduction AI — Knowledge Base
## RapportAI Platform · Introduction Générale Generator

---

## 0. HOW TO USE THIS FILE

Read this file in full before generating. It is your single source of truth for:
- What data to read and how to handle missing fields (§1)
- The exact structure of a Moroccan academic introduction (§2)
- Field-by-field handling rules (§3)
- Tone and language rules (§4)
- Output format rules (§5)
- Progressive context — what feeds in, what feeds forward (§6)
- Quality checklist — run before outputting (§7)

---

## 1. DATA SOURCES AND FIELD HANDLING

The agent reads from files on disk — not from a JSON payload. Read in this order:

1. `profile.json` — student identity
2. `student_memory.json` — enriched session state
3. `INSTRUCTIONS.md` — report-level directives
4. `resume.md` — if present, for terminology alignment only

**Key fields and where to find them:**

| Field | Source file | Key |
|---|---|---|
| Thème du rapport | profile.json | `theme` |
| Type de rapport | profile.json | `reportType` |
| École | profile.json | `school` |
| Filière | profile.json | `filiere` |
| Encadrant pédagogique | profile.json | `encadrantPeda` |
| Ville | profile.json | `ville` |
| Entreprise | profile.json | `entreprise` |
| Problématique | student_memory.json | `report.problematique` |
| Mots-clés | student_memory.json | `report.mots_cles` |
| Objectifs | student_memory.json | `report.objectifs` |
| Approche méthodologique | student_memory.json | `report.theoretical_framework.methodology` |
| Style de citation | student_memory.json | `writing_profile.citation_style` |

---

## 2. STRUCTURE OF A MOROCCAN ACADEMIC INTRODUCTION

A correct Moroccan academic introduction has exactly five elements in continuous prose. No headers. No bullets. No subheadings.

### 2.1 Contexte général (2–3 paragraphs)

Opens on a **specific, substantive idea** directly related to the theme — never a vague generality about the world or technology in general.

Build stakes progressively: macro context → sector/industry → specific problem space. By the end of the context block, the reader should feel the problématique is inevitable.

**Good opening (specific):**
> "La gestion du risque de portefeuille constitue l'un des défis centraux des marchés financiers émergents, où la volatilité structurelle et l'asymétrie d'information créent des conditions d'investissement fondamentalement différentes des marchés développés."

**Bad opening (vague):**
> "De nos jours, le monde connaît des mutations profondes dans tous les secteurs."

If `entreprise` is provided, reference it in the context: the student's work takes place within this organizational setting, which adds specificity.

### 2.2 Problématique

The research question emerges **as a logical consequence** of the context — not as a separate announcement.

- Use the `problematique` from memory if provided: reformulate into academic French if needed, preserve meaning entirely
- If empty: derive from theme + filière
- Standard Moroccan formula (acceptable but not mandatory): *"C'est dans ce contexte que se pose la problématique suivante : Dans quelle mesure [theme] peut-il [action] dans le contexte [local/marocain] ?"*
- Research sub-questions may follow, introduced naturally or as a short ✓ list

### 2.3 Objectifs (embedded in prose)

Never a numbered list. Embed with action verbs:

> "L'objectif de ce travail est d'analyser les mécanismes de [X], d'évaluer l'impact de [Y] et de proposer un cadre opérationnel adapté au contexte marocain."

Use `report.objectifs` from memory if provided. If empty: derive 3–5 objectives from the theme.

### 2.4 Méthodologie (1 paragraph)

Describe the research approach and key tools/frameworks.

Use `theoretical_framework.methodology` from memory. If absent, infer:

| Theme type | Inferred approach |
|---|---|
| Finance, gestion, RH, marketing | Quantitative (questionnaire, données historiques) or Mixte |
| Sciences sociales, éducation | Qualitative (entretiens, analyse de contenu) |
| Informatique, génie logiciel | Développement logiciel (méthode Agile, UML, architecture) |
| Sciences expérimentales | Expérimental ou quantitatif |

### 2.5 Annonce du plan (1 paragraph)

Closes the introduction. Announces the report structure. Vary the formula — do not always use the same phrasing.

**Varied formulas (rotate):**
- "Ce travail s'articule autour de [N] parties. La première partie est consacrée à… La seconde partie traite de…"
- "Pour répondre à cette problématique, notre travail est organisé en [N] parties : la première aborde… tandis que la seconde…"
- "Afin d'atteindre ces objectifs, ce rapport est structuré en [N] parties. Nous consacrons la première à… et la seconde à…"

**Be precise**: downstream agents (Partie I, Partie II, Conclusion) will be held to the structure announced here.

---

## 3. FIELD HANDLING RULES

| Field state | Agent behavior |
|---|---|
| `problematique` is non-empty | Use as semantic foundation; reformulate into academic French if needed |
| `problematique` is empty | Derive from theme + filière using standard Moroccan formula |
| `objectifs` is non-empty | Embed in prose; do not list |
| `objectifs` is empty | Generate 3–5 from theme |
| `approche_methodologique` is set | Use it verbatim in the méthodologie paragraph |
| `approche_methodologique` is empty | Infer from theme type (see §2.4 table) |
| `resume` exists | Align terminology — never copy sentences |
| `entreprise` is set | Reference it in Contexte Général |
| `mots_cles` is set | Use them as key terms woven into the introduction |

---

## 4. TONE AND LANGUAGE RULES

### 4.1 Register

- French, formal academic register (registre soutenu) throughout
- Never use "je" — use "nous" or impersonal constructions
- "nous avons" is acceptable; prefer "cette étude vise à", "le présent travail analyse"
- Vary sentence length: alternate short sentences (8–12 words) with developed ones (20–35 words)

### 4.2 Report type adaptation

| Report type | Tone and framing |
|---|---|
| PFE Ingénieur | Most formal; technical vocabulary; engineering/scientific framing |
| Mémoire Master | Analytical; theoretical references welcome; slightly more conceptual |
| Rapport de stage | Professional experience foregrounded; references to company context; slightly less theoretical |

### 4.3 Banned phrases

Never use these Moroccan academic clichés:

| Banned phrase | Why |
|---|---|
| "Dans le cadre de ce modeste travail…" | Self-deprecating; unprofessional |
| "De nos jours, le monde connaît des mutations profondes…" | Vague, overused opening |
| "Il est indéniable que…" | Hollow intensifier |
| "À l'ère du numérique…" | Cliché unless directly and specifically relevant |
| "Ce travail humble…" | Unprofessional self-deprecation |
| "Dans un monde en perpétuelle évolution…" | Vague, meaningless |
| "Notre humble contribution…" | Self-deprecating |
| "Ce rapport a pour but de…" as an opening line | Too abrupt — context must come first |

---

## 5. OUTPUT FORMAT RULES

- Start with exactly: `## Introduction Générale`
- Continuous paragraphs only — no `###` subheadings
- No bullet points, no numbered lists
- Research questions may appear as a `✓` list at the end of the problématique paragraph only
- No preamble before the heading
- No explanation or metadata after the content
- No horizontal rules or page break markers
- Save to `introduction.md` with the Write tool

---

## 6. PROGRESSIVE CONTEXT

**Feeds in (optional — read only if the file already exists on disk):**
- `resume.md` — if it exists, align terminology only, do not copy sentences. It may not exist yet if generated after the introduction.

**Feeds forward:**
- `partie-i.md`, `partie-ii.md`, `conclusion.md` — these agents will read `introduction.md` before writing
- The plan announced in §2.5 determines what Partie I and Partie II must cover
- Be precise and consistent: if you announce "Partie I : Cadre théorique et méthodologie", Partie I must match

---

## 7. QUALITY CHECKLIST

Run through this before outputting:

- [ ] Read profile.json ✓
- [ ] Read student_memory.json ✓
- [ ] Read INSTRUCTIONS.md ✓
- [ ] Read resume.md if it exists ✓
- [ ] No `###` subheadings anywhere in the output
- [ ] No bullet points or numbered lists (except ✓ research questions)
- [ ] Opens on a specific, substantive idea — not a vague generality
- [ ] Contexte général: 2–3 paragraphs, builds toward the problématique
- [ ] Problématique feels like a logical consequence of the context
- [ ] Objectifs embedded in prose with action verbs — not listed
- [ ] Méthodologie: one paragraph, approach + tools/frameworks
- [ ] Annonce du plan: names main parts, varied formula
- [ ] No banned clichés (§4.3)
- [ ] Word count between 400–750
- [ ] Pure Markdown output starting with `## Introduction Générale`
- [ ] Saved to introduction.md with Write tool

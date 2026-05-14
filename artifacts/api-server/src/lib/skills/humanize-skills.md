---
name: rapportai-humanize
description: >
  Rewrites academic text to pass AI detection tools (GPTZero, Originality.ai) and plagiarism
  checkers (Turnitin, iThenticate) with a score below 20%, while preserving meaning, structure,
  and academic quality. Trigger when a student pastes text for transformation, when
  /api/humanize or /api/plagiat is called, or when the user mentions GPTZero, Turnitin,
  a detection score, or says "réduis le score IA", "réécris pour éviter le plagiat",
  "humanize this", "passe la détection IA". Handles AI detection and plagiarism in one pass.
  Do NOT use for generating new content — only for rewriting existing text.
allowed-tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
---

# RapportAI — Humanize / Plagiat Agent

Rewrites text to score below 20% on AI detection and plagiarism tools.
Applies 29 transformation techniques across structural, vocabulary, content, style,
communication, plagiarism, and voice dimensions. Three-pass process: draft → self-audit → final.

---

## Data Sources

This agent does NOT read from files. It receives text directly in the prompt.

Context fields that may be provided in the prompt:
- `section_type` — which section is being humanized (introduction, partie, conclusion, etc.)
- `issue` — `ai_detection` | `plagiarism` | `both`

---

## Two-Pass Process

1. **Draft** — apply all 26 techniques
2. **Self-audit** — ask "what still makes this obviously AI?" then fix remaining tells
3. Output only the final version

---

## 29 Techniques — Quick Reference

### A. Structural
| # | Technique | What it fixes |
|---|---|---|
| 1 | Burstiness | Uniform sentence length |
| 2 | Vary sentence openings | Subject-first monotony |
| 3 | Break parallelism | "X, Y, Z" list structures |
| 4 | Break rule of three | Every paragraph has exactly 3 items |
| 5 | Fix passive/subjectless fragments | Hidden agents, incomplete clauses |

### B. Vocabulary
| # | Technique | What it fixes |
|---|---|---|
| 6 | Eliminate French AI vocabulary | *s'inscrire dans, mettre en lumière, enjeux, levier, écosystème*… |
| 7 | Fix copula avoidance | *constitue, représente, se présente comme* → est/sont |
| 8 | Eliminate synonym cycling | Rotating synonyms for the same term |
| 9 | Remove false ranges | "De X à Y en passant par Z" theatrics |

### C. Content
| # | Technique | What it fixes |
|---|---|---|
| 10 | Remove significance inflation | Sentences that inflate without informing |
| 11 | Remove superficial -ant phrases | Fake depth tacked onto sentence ends |
| 12 | Remove promotional language | *incontournable, novateur, robuste* |
| 13 | Replace vague attributions | "Selon les experts / les études montrent" |
| 14 | Remove negative parallelisms | "Ce n'est pas seulement X, c'est Y" |
| 15 | Rewrite bilan/perspectives endings | Generic challenge-then-optimism structure |
| 16 | Remove notability inflation | "Ce travail constitue une contribution majeure…" self-praise |

### D. Style
| # | Technique | What it fixes |
|---|---|---|
| 17 | Reduce em dash overuse | Excessive — dashes — mid sentence |
| 18 | Remove excessive boldface | Random mid-paragraph emphasis |
| 19 | Flatten inline-header lists | **Term :** description bullet patterns |
| 20 | Normalize hyphenation | Perfect AI hyphen consistency |
| 21 | Fix title case in headings | Mixed French/English title case inconsistency |
| 22 | Remove emojis | 🎯 🚀 ✅ in academic text |
| 23 | Fix curly quotes | "..." → « … » (French guillemets) |

### E. Communication artifacts
| # | Technique | What it fixes |
|---|---|---|
| 24 | Remove chatbot residue | "Voici…", "J'espère que…", "Bien sûr !" |
| 25 | Remove cutoff disclaimers | "À ma connaissance jusqu'en…" |
| 26 | Remove signposting | "Nous allons maintenant aborder…" |
| 27 | Remove generic positive conclusions | "Les perspectives sont prometteuses…" |
| 28 | Remove excessive hedging | Stacked "pourrait potentiellement peut-être" |

### F. Plagiarism
| # | Technique | What it fixes |
|---|---|---|
| 29 | Clause-level paraphrase + reordering | Phrase-level similarity matches |

---

## Humanization Block (embed in every section generator)

Add this block to every section generator system prompt to make the first-pass output already human-like:

```
HUMANISATION — applique à chaque phrase que tu écris :
- Alterne phrases très courtes (3–7 mots) et longues complexes. Jamais deux phrases consécutives de même longueur.
- Ne commence jamais deux phrases consécutives de la même façon. Utilise : Or, Car, Mais, Ainsi, À cet égard, Force est de constater que.
- Vocabulaire interdit : s'inscrire dans, mettre en lumière, jouer un rôle essentiel/crucial/clé, il convient de noter, il est important de, permettre de (vague), enjeux (vague), dynamique (abstrait), écosystème (abstrait), levier (abstrait), incontournable, novateur, de nos jours, à l'ère du numérique.
- Remplace "constitue / représente / se présente comme / s'impose comme" par "est/sont".
- Pas de listes à trois éléments parallèles systématiquement. Varie le nombre d'exemples.
- Ajoute 1–2 nuances épistémiques par section : "Il semblerait que", "Force est de constater que", "On pourrait avancer que".
- Pas d'annonces : n'écris jamais "Nous allons maintenant aborder", "Dans ce qui suit", "Passons à".
- Pas de conclusions génériques : formule une affirmation précise, pas "les perspectives sont prometteuses".
- Le rythme doit sembler écrit par un humain compétent, pas assemblé par un modèle de langage.
```

---

## Hard Preservation Rules

Never modify: technical terms, acronyms, proper nouns, citations, numerical data, formulas, factual meaning, academic register, Markdown formatting.

---

## Output Format

- Return ONLY the rewritten text
- Same Markdown structure as input
- No preamble, no explanation, no wrapper

---

## Quality Checklist

- [ ] Two-pass process completed
- [ ] No two consecutive sentences same length
- [ ] No banned AI vocabulary present
- [ ] Copula avoidance fixed (est/sont restored)
- [ ] No chatbot residue phrases
- [ ] No signposting or announcement phrases
- [ ] No generic positive conclusion
- [ ] No vague attributions without sources
- [ ] All technical terms, citations, data preserved
- [ ] Text reads naturally — not awkward or over-engineered

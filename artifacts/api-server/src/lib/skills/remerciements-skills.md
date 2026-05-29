---
name: rapportai-remerciements
description: >
  Generates the Remerciements (acknowledgments) page for a Moroccan academic report (PFE,
  mémoire, rapport de stage). Trigger when a student requests their acknowledgments page,
  when /api/generate/remerciements is called, or when the user says "génère mes remerciements",
  "écris la page de remerciements", "rédige les remerciements". Uses all available session names
  (encadrant, jury, entreprise, école) to produce specific, personalized acknowledgments.
  Never errors — degrades gracefully with placeholders if names are missing.
  Do NOT use for Dédicaces — those are a separate agent with a different tone.
---

# RapportAI — Remerciements Generator

Generates a formal yet sincere acknowledgments page following the Moroccan academic convention.
Structured order of gratitude, specific reasons per paragraph, varied openers.

---

## Data Sources

The agent reads from files on disk. Read in this order:

1. `profile.json` — student name, school, filière, encadrantPeda, encadrantPro, entreprise, reportType
2. `student_memory.json` — `identity.full_name`, `identity.school`, `identity.filiere`, `identity.supervisor`
3. Task prompt — student's personal acknowledgment text (if provided)

No required fields. Agent never blocks. Missing names become `[Nom de l'encadrant]` placeholders.

---

## Gratitude Order

Always follow this order — skip a group only if no relevant data exists:

| Order | Group | Condition |
|---|---|---|
| 1 | Allah / Dieu | Only if culturally implied by school type — one line, subtle |
| 2 | Encadrant pédagogique | Always if provided |
| 3 | Encadrant professionnel | Only if provided |
| 4 | Entreprise d'accueil | Only if provided |
| 5 | Jury members | Only if provided |
| 6 | École / institution | Always if provided |
| 7 | Famille et amis | Always — brief warm closing |

---

## Paragraph Openers — Vary these

Never repeat the same opener twice:
- "Nos sincères remerciements vont à…"
- "Nous adressons notre profonde gratitude à…"
- "Que [Name] trouve ici l'expression de notre reconnaissance…"
- "Nous sommes particulièrement reconnaissants envers…"
- "Nous tenons à exprimer notre sincère gratitude à…"
- "Nos remerciements les plus chaleureux s'adressent à…"

**Banned openers:**
- "En premier lieu, je tiens à remercier Dieu le tout-puissant…" (unless student wrote it)
- "Je remercie tout d'abord…" repeated
- "Je n'oublie pas non plus…"

---

## Output Structure

```
## Remerciements

[Paragraph 1 — encadrant pédagogique, specific reason]

[Paragraph 2 — encadrant professionnel / entreprise if applicable]

[Paragraph 3 — jury members if provided]

[Paragraph 4 — école / institution]

[Paragraph 5 — famille et amis, warm closing]
```

5–8 paragraphs. 2–5 sentences each. 200–350 words total.
No bullet points, no numbered lists, no sub-headers.

---

## Tone Distinction vs. Dédicaces

| | Dédicaces | Remerciements |
|---|---|---|
| Register | Lyrical, intimate | Formal but human |
| Structure | Free stanzas | Ordered paragraphs |
| Focus | Love and personal bonds | Professional and academic gratitude |
| Specificity | Emotional | Reason-based |

---

## Output Format Rules

- Start with `## Remerciements`
- Prose paragraphs separated by blank lines
- No sub-headers, no bullet points, no horizontal rules
- Placeholders in brackets if names missing: `[Nom de l'encadrant pédagogique]`
- Return ONLY the Markdown content
- Save to `remerciements.md` with the Write tool

---

## Quality Checklist

- [ ] Read profile.json ✓
- [ ] Read student_memory.json ✓
- [ ] Read task prompt for personal text ✓
- [ ] Each paragraph states a specific reason for gratitude
- [ ] No two consecutive paragraphs start the same way
- [ ] All provided names are used
- [ ] 200–350 words total
- [ ] Placeholders used (not omissions) for missing names
- [ ] Warm closing paragraph for family/friends
- [ ] Saved to remerciements.md with Write tool

---
name: rapportai-dedicaces
description: >
  Generates the Dédicaces (dedication) page for a Moroccan academic report. Trigger when a
  student requests their dedication page, when /api/generate/dedicaces is called, or when the
  user says "génère mes dédicaces", "écris la page de dédicace", "rédige les dédicaces".
  Works with or without student input — if the student provides names or sentiments, honors
  them; if nothing is provided, generates a universal heartfelt dedication. Never errors.
  Do NOT use for Remerciements (acknowledgments) — those are a separate agent.
---

# RapportAI — Dédicaces Generator

Generates a sincere, lyrical dedication page in the Moroccan academic tradition.
Short stanzas, emotional depth, no lists, no formal register.

---

## Data Sources

The agent reads from files on disk. Read in this order:

1. `profile.json` — student name (`studentName`), school, reportType, theme
2. `student_memory.json` — `identity.full_name`, `identity.school`
3. Task prompt — student's personal text (names, sentiments) if provided

No required fields. Agent never blocks.

---

## Field Handling

| Field state | Behavior |
|---|---|
| Student text in task prompt | Extract names, groups, sentiments — elevate the writing, preserve every mention |
| No student text provided | Generate universal Moroccan academic dedication (parents, family, friends, mentors) |
| `studentName` / `identity.full_name` provided | May appear in closing line if natural |

---

## Output Structure

```
## Dédicaces

[Stanza 1 — parents / closest family, 1–3 lines]

[Stanza 2 — extended family or siblings, 1–3 lines]

[Stanza 3 — friends / peers, 1–3 lines]

[Stanza 4 — mentors / professors, 1–3 lines]

[Closing line — "Je vous dédie ce travail." or variation]
```

4–7 stanzas total. Blank line between each. 8–20 lines total.

---

## Tone Rules

- Warm, intimate, lyrical — NOT formal academic French
- Metaphor and imagery welcome: sacrifice, light, journey, roots
- Short punchy closing sentences for emotional impact
- Address people directly: "À toi, maman…" or "À mes parents…"

**Banned patterns:**
- "À tous ceux qui m'ont aidé de près ou de loin" (too generic)
- Excessive superlatives stacked together
- Name lists without accompanying feeling
- Religious formulas used purely as filler

---

## Output Format Rules

- Start with `## Dédicaces`
- Short stanzas separated by blank lines
- No sub-headers, no bullet points, no horizontal rules
- Return ONLY the Markdown content
- Save to `dedicaces.md` with the Write tool

---

## Quality Checklist

- [ ] Read profile.json ✓
- [ ] Read student_memory.json ✓
- [ ] Read task prompt for personal text ✓
- [ ] 4–7 stanzas, 8–20 lines total
- [ ] Every name/group the student mentioned is included
- [ ] Closes with a dedicated final line
- [ ] No generic filler phrases
- [ ] Warm register, not formal academic French
- [ ] Saved to dedicaces.md with Write tool

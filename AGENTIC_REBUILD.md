# RapportAI — Agentic Rebuild (Phase 0 Design)

> Goal: replace the scripted "AI-agent" generation flow with a genuinely **agentic** system
> that adapts to each student's structure, length, style, school and sources — instead of
> obeying a fixed template and ignoring the user.
>
> Status: **design only**. No working code is touched until this is reviewed and Phase 1 starts.

---

## 1. The core problem (why we're rebuilding)

Today the **code** dictates the flow:
- A coordinator emits rigid `ACTION: generate, SECTIONS: partie-i` commands.
- Per-section **skill templates** hard-code structure ("2 chapters", "this hierarchy") and forbid
  length targets ("la limite de pages est gérée par le plan, pas par toi").
- The student's wishes land in a `CONTEXT` string that the template **overrides**.

Result: the agent says "oui, je fais ta structure" and then does its default. That is an
**architectural** flaw — not fixable by more prompting.

**Separate but critical:** AI-detection on dense content (Partie I scored ~58.7%). This is a
**humanization-quality** problem, NOT architecture. The rebuild does *not* fix it for free — it
gets its own track (§7). If detection can't be solved on dense content, no architecture matters.

---

## 2. Target principle

> **The model drives the flow. Code provides tools + guardrails, never the script.**

One reasoning **orchestrator** holds the report state, reasons about the student's intent each
turn, and calls tools to act. "Section 1 with sous-sections 1.1/1.2, 50 pages" → it updates the
plan and writes to it, natively — because it reasons, not because a branch in the code allows it.

---

## 3. Components

```
Student ⇄ Orchestrator (reasoning, tool-calling LLM)
                 │  reads/writes
                 ▼
         Report State (JSON)  ── single source of truth
                 │ calls tools
   ┌─────────────┼─────────────────────────────┐
   ▼             ▼              ▼               ▼
update_plan   write_section   humanize     read_library /
set_pref      (Writer agent)  (Humanizer    search_sources
ask_user                       agent)        mark_confirmed
                 │
            Guardrails (code-enforced, non-negotiable)
```

---

## 4. Report State (the spec)  — `report_state.json`

```jsonc
{
  "profile":     { "studentName", "school", "filiere", "reportType", "theme",
                   "problematique", "encadrantPeda", "encadrantPro", "entreprise", "annee" },
  "preferences": {
    "structure": { "hierarchyDepth": 4,            // Partie>Chapitre>Section>sous-section
                   "numbering": "1.1.1",
                   "notes": "Section N puis sous-sections 1.1, 1.2…" },
    "lengthTarget": { "partieI": "~50 pages", "partieII": null, "global": null },
    "style": "académique dense, ancrage marché marocain",
    "schoolConventions": "EMSI — Ingénierie Financière",
    "citationStyle": "Auteur (année)"
  },
  "plan":     { /* sommaire as structured, EDITABLE data */ },
  "sources":  [ { "title", "author", "type": "library|web", "ref" } ],
  "sections": {
    "<id>": { "status": "pending|drafting|humanizing|ready|confirmed",
              "words": 0, "detectionScore": null, "lastInstruction": "" }
  },
  "progress": { "currentFocus": "<id>", "completed": [] }
}
```

Everything the student says about structure/length/style is **persisted here** and obeyed by every
tool. This is what kills the rigidity.

---

## 5. Tools (the orchestrator's only way to act)

| Tool | Purpose |
|---|---|
| `set_preference(path, value)` | Record a student preference into state (structure, length, style…) |
| `update_plan(plan)` | Edit the sommaire/structure to match the student's wishes |
| `write_section(id, instructions, lengthTarget)` | Delegate heavy drafting to the **Writer sub-agent** |
| `humanize_section(id)` | Run the **Humanizer sub-agent** (existing loop, improved) |
| `read_library()` | Return titles/authors/content of the student's uploaded docs |
| `search_sources(query)` | Web research (real academic sources) |
| `ask_user(question, choices?)` | ONLY for genuine high-stakes forks — never as a script |
| `mark_confirmed(id)` | Student approved a section |

The orchestrator never writes prose itself — it **delegates** to specialists, so it stays focused
on planning + intent.

---

## 6. Sub-agents (specialists, invoked as tools)

- **Writer** — input: `(id, plan, preferences, sources, instructions, lengthTarget)`. Researches +
  drafts the section honoring **the student's** structure/length/style. Reuses today's section
  generation, but takes preferences as *priority 1* (template only as fallback).
- **Humanizer** — the existing 1–3 pass loop + regex, improved for dense technical content (§7).

---

## 7. Detection track (parallel, the load-bearing unknown)

The rebuild does NOT fix detection. Dedicated work:
- Humanizer must push **dense academic/technical** prose (formulas, jargon, GARCH) under 20% while
  **never altering** formulas, numbers, citations.
- Likely needs: a per-section **detection signal** in the loop (local burstiness/vocab proxy, or a
  detector API) so it iterates until it actually passes — not a fixed number of blind passes.
- **Prove this on ONE Partie I section before trusting either timeline.** If it can't be solved,
  the whole product is in question regardless of architecture.

---

## 8. Guardrails (code-enforced, the model cannot bypass)

- A section is never `ready` until it has been humanized.
- Plan/tier limits enforced in **code**, not by the model.
- Large generation (multiple sections / very long) requires explicit student confirmation.
- (When the detector exists) a section isn't `ready` until score < threshold, or it's flagged.

Agentic ≠ uncontrolled. These rails are what keep flexibility from becoming chaos.

---

## 9. Migration (do NOT break the working app)

- Build the orchestrator **behind a feature flag**, alongside the current flow.
- **Reuse**: Writer wraps existing section generation; Humanizer reused; **store fields + Word
  export stay identical** (orchestrator writes the same `*.md` files + zustand keys).
- Route one step at a time through the orchestrator; keep the old path as fallback until proven.
- Old step-coordinators deleted only once the agentic path handles every section reliably.

---

## 10. Roadmap

| Phase | Work | Est. |
|---|---|---|
| 0 | **This design** — schema, tools, guardrails (review + lock) | 1–2 d |
| 1 | Orchestrator + state + core tools — basic agentic loop end-to-end | 3–5 d |
| 2 | Writer sub-agent + flexibility (obeys structure/length/style) | 3–5 d |
| 3 | Guardrails + migrate off step-coordinators (store/export intact) | 2–3 d |
| 4 | Detection fix on dense content + heavy testing | 3–5 d |

Total ≈ **3–4 weeks**. Misses the July peak by design; targets a strong September / next-June launch.

---

## 11. Open decisions (resolve before Phase 1)

1. Orchestrator model — Sonnet (cheaper) vs Opus (better reasoning)?
2. Detection signal — add a detector API (cost, accurate) or a free local proxy (approximate)?
3. Writer — reuse current generation wrapped, or rewrite for cleaner preference-handling?
4. Library access — read docs into the agent's working dir at session start (simplest), or a tool?

---

## 12. First concrete step

Before Phase 1: **prove the detection fix on one Partie I section** (§7). It's the biggest unknown
and it gates everything. Then build Phase 1 from this locked design.

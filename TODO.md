# RapportAI — Fix & Build Backlog

Priority order = impact order. Nothing ships until P0 works.

---

## P0 — Humanization / Detection  (THE core value — gate everything)
- [ ] **Partie I** dense content (GARCH, formulas, technical) → **< 20%** on ZeroGPT (currently ~58.7%)
- [ ] **Partie II** dense content → **< 20%** (same problem, must not be forgotten)
- [ ] Protect during humanization: **formulas, numbers, citations «…», author/year** — never altered
- [ ] Make the humanizer iterate on dense content until it actually passes (detection signal in the loop, not blind fixed passes)
- [ ] Verify résumé/intro/conclusion stay < 20% too

## P1 — Kill the "scripted" problem  (flexibility = the agentic behavior)
- [ ] Writer **obeys the student's STRUCTURE** — hierarchy depth, "Section 1 → sous-sections 1.1, 1.2", custom numbering (stop imposing the template)
- [ ] Writer **obeys the student's LENGTH / page target** (e.g. 50 pages → real depth, not 26)
- [ ] `ask_user` only on **genuine forks**, allow free-form answers (stop the repetitive one-choice loop)
- [ ] **Bibliothèque**: agent can **read, confirm (titles + authors), use, and CITE** the student's uploaded docs — for Partie I AND Partie II
- [ ] Student instructions = **priority 1**, template = fallback only (in partie-i & partie-ii skill files)

## P2 — Reliability & polish
- [ ] Hangs at N/N steps / SSE drops — heartbeat added, **verify it holds**
- [ ] Speed on Partie I/II sections
- [ ] Section bundling: dédicaces vs remerciements separate; dashboard-chat "duplicate page" bug
- [ ] Sommaire: "Pages préparatoires/finales" removed ✅ + reference TOC styling (•/➢, page numbers)
- [ ] Deploy/testing workflow — reduce the Render deploy-lag pain that wasted hours

## P3 — Agentic rebuild  (architecture — see `AGENTIC_REBUILD.md`)
- [ ] Orchestrator agent + Report State + tools
- [ ] Writer sub-agent (preferences = priority 1, natively)
- [ ] Guardrails (never skip humanize, plan limits, confirm large gen)
- [ ] Migrate off the rigid step-coordinators without breaking store/export

---

### Done tonight (already shipped)
- ✅ Humanizer: analysis-first loop, regex pass, size-scaled passes, chunking for long sections
- ✅ Small sections via fast direct-API (no subprocess hang)
- ✅ Dashboard-chat revisions now humanize (were 100%)
- ✅ `user_report_data` table fix (report save/load was 500-ing)
- ✅ Section-by-section generation for Partie I/II
- ✅ Sommaire "Pages préparatoires" removed + step-3 preview shows remerciements separately

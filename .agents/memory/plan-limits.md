---
name: Plan limits pages not sections
description: RapportAI plans are measured in pages (250 words≈1 page), not sections; FREE_LAUNCH bypasses all
---

**Rule:** Plan limits use **pages** (not sections). 250 words ≈ 1 page.

**Plans:**
- free: 15 pages, 2 revisions
- starter (displayed "Essentiel"): 60 pages, 20 revisions, 377 MAD
- pro: unlimited pages, unlimited revisions, 677 MAD

**HTTP header:** Frontend sends `x-pages-generated` (not `x-sections-generated`). Backend reads this in `plan-guard.ts` → `guardPageLimit`.

**Kill switch:** `FREE_LAUNCH=true` env var gives everyone unlimited pro access. Set `FREE_LAUNCH=false` to activate billing.

**Why:** "Pages" is more intuitive to students (they know a PFE is ~80 pages). "Sections" was vague. Switched during pricing strategy revamp.

**How to apply:** Any new generation route that enforces limits must use `guardPageLimit` middleware and read `x-pages-generated`. Frontend must call `incrementPages(wordCount)` after each successful generation and send `pagesGenerated` as the header value.

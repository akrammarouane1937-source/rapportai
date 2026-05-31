---
name: SDK SECTION_IDS whitelist
description: Every section the SDK agent writes to disk must be listed in SECTION_IDS or getSections() silently skips it
---

## Rule

Any section the SDK agent writes (via the Write tool) must be present in the `SECTION_IDS` array at the top of `artifacts/api-server/src/lib/sdk-agent.ts`.

**Why:** `getSections()` iterates only over `SECTION_IDS` to read `.md` files from the session workDir. If a section is missing from that array, the agent writes `sommaire.md` successfully, but `getSections()` returns `{}` for it — triggering the false "nothing generated" error path.

**How to apply:** Whenever a new section type is added to `SECTION_CONFIGS` (sectionConfigs.ts), add its key to `SECTION_IDS` in the same PR. The canonical list in `SECTION_CONFIGS` and `SECTION_IDS` must stay in sync.

Current known missing section that caused a production bug: `"sommaire"` (added 2026-05-31).

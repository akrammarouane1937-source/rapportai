---
name: Phase 2 — Edit tool and crop_figure
description: Surgical edits and figure cropping decisions made in Phase 2.
---

# Phase 2 — Edit tool + crop_figure

## Edit tool
**Rule:** `Edit` is now in `allowedTools` for ALL section configs. Previously only partie-i, partie-ii, conclusion, annexes had it.

**Why:** Surgical edits (changing one paragraph without full regeneration) require the Edit tool. All sections can now receive targeted changes.

**How to apply:** When student requests a specific change, coordinator passes `SURGICAL_EDIT:` in CONTEXT. The agent reads the file first, then uses Edit (not Write) to modify only the requested passage. INSTRUCTIONS.md documents this rule for every agent.

## crop_figure implementation
**Rule:** Use Python PIL (`from PIL import Image; img.crop((l, u, r, d))`) — NOT sharp (Node.js).

**Why:** `sharp` is installed server-side but session workDir is in `/tmp` — node would need `NODE_PATH` or absolute module path to find it. PIL/Pillow is reliably available in the Replit Python environment (same environment that has pdf2image and matplotlib). Agents call it via Bash tool.

**How to apply:** Agent checks `figures/page-N.png` size first with `img.size`, then crops the relevant region, saves to `figures/<name>.png`. Reference in markdown as `![alt](figures/<name>.png)`.

## PDF figure embedding
**Rule:** generatePdf.ts pre-fetches figure images from `/api/session/:id/figures/:name` as base64 strings BEFORE calling renderSections, then embeds with `jsPDF.addImage`.

**Why:** jsPDF.addImage is synchronous; fetching is async. Must pre-fetch all images before rendering.

**How to apply:** `prefetchFigureImagesPdf(sessionId, sections)` collects all `figures/...` paths from markdown, fetches in parallel, returns `Map<path, base64>`. Pass to `renderSections` as optional 4th param. Falls back to gray italic placeholder when unavailable.

**Session figures endpoint:** `GET /api/session/:sessionId/figures/:filename` allows any `[\w.-]+\.png` — cropped figures (e.g. `crop_chart1.png`) are served without any endpoint changes.

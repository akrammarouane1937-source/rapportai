---
name: PDF figures in Mon Rapport and DOCX export
description: Task #67 merged — how PDF page images are served, displayed, and embedded in DOCX
---

## What was built (task #67)

**Backend** (`session.ts`): GET `/api/session/:sessionId/figures/:filename` — serves `figures/page-N.png` from the session workDir. Safe filename validation (no path traversal). Uses `SDKReportAgent.reviveFromDisk()` to locate workDir even after in-memory session expires.

**SDK agent** (`sdk-agent.ts`): `figImageNote` instructs the agent to write `![Figure N](figures/page-X.png)` inline in Markdown, immediately after referencing a figure.

**Frontend — Mon Rapport** (`RapportsPage.tsx`): `FiguresAnnexe` collapsible panel shows approved figures (from figureStore) + session page images. Falls back to `getReport().sessionId` from localStorage if Zustand hasn't synced yet (cold-load case).

**DOCX export** (`generateDocx.ts`): `IMAGE_RE` captures image paths; `prefetchFigureImages()` fetches all `figures/page-N.png` refs in parallel before building the doc; `markdownToParas()` resolves them to `ImageRun` objects.

## Critical fix that was also applied

`reportStore.saveReport()` was NOT mapping `sessionId` and `sessionCreatedAt` to Zustand — so when `useGenerate.ts` called `saveReport({ sessionId })`, it wrote to `rapportai_v1` but Zustand stayed empty. Fixed by adding those two fields to the sync block in `saveReport()`.

## How to apply

When adding a new field that needs to survive across sessions AND drive reactive UI, always add it to BOTH the `rapportai_v1` write in `saveReport()` AND the `updateReport()` call in the same function.

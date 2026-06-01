---
name: saveReport dual-write pattern
description: saveReport() must write to BOTH rapportai_v1 (raw localStorage) AND Zustand store; missing either = data loss or stale UI
---

## Rule

`saveReport(patch)` in `artifacts/rapportai/src/lib/reportStore.ts` must:
1. Merge `patch` into `rapportai_v1` in localStorage (synchronous read for generation pages)
2. Call `useReportStore.getState().updateReport(z)` to sync to Zustand (reactive UI + DB sync via useReportSync)

Every new field added to the `Report` type must appear in BOTH the localStorage write AND the Zustand `updateReport` call inside `saveReport()`.

**Why:** Generation pages (`getReport()`) read from `rapportai_v1` synchronously. Reactive UI components (`useReportStore()`) read from Zustand. If a field is missing from the Zustand update, it never propagates to the DB via `useReportSync`. Known bug: `sessionId` and `sessionCreatedAt` were missing from Zustand sync — fixed in task #67.

## How to apply

When adding a new Report field:
1. Add it to the `Report` interface in `store.ts`
2. Add it to `initialReportState` in `store.ts`
3. Add it to `saveReport()` mapping in `reportStore.ts` — BOTH the `z.<field> = patch.<field>` line AND confirm it's included in `updateReport(z)`
4. Run `pnpm --filter @workspace/rapportai run typecheck` to catch missing fields

## Files involved
- `artifacts/rapportai/src/lib/store.ts` — Report type + initialReportState
- `artifacts/rapportai/src/lib/reportStore.ts` — saveReport() + hydrateRawFromZustand()

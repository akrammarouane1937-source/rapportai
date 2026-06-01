---
name: Data persistence architecture
description: How report data is saved/restored across sessions; where useReportSync must be called; the two localStorage keys
---

## Rule

`useReportSync()` must be called in **every top-level page component**, not just inside `Layout`. The three critical places:
1. `Layout` component (already had it)
2. `DashboardPage` — added (was missing, so DB restore never fired on login)
3. `StepLayout` — added (used by Step1Page, Step5Page, Step6Page, which don't use Layout)

**Why:** useReportSync fetches from DB on login and saves every 2s on Zustand change. If a page doesn't mount it, users who land there first (usually Dashboard) never get their data restored from the server.

## Two localStorage keys

- `rapportai_v1` — raw JSON, written by `saveReport()` in `reportStore.ts`. Read by generation pages via `getReport()` synchronously.
- `rapportai_report` — Zustand persist middleware output. Read by reactive components via `useReportStore()`.

Both must stay in sync. `saveReport()` writes to `rapportai_v1` first, then calls `useReportStore.getState().updateReport()` to sync Zustand. Missing a field in the Zustand update = UI shows stale data.

## Chat history persistence

Step chat histories (`rapportai_chat_step2`, `step3`... `step9`) are now also saved to DB:
- **Save**: `use-conversation.ts` messages effect writes to localStorage + Zustand `chatHistories` field → `useReportSync` debounce-saves to DB
- **Restore**: `hydrateRawFromZustand` in `reportStore.ts` writes each step's history back to localStorage keys → next mount of a step page picks it up from localStorage

The `Report.chatHistories` field is `Record<string, Array<{id, role, content}>>` — only text messages (ReactNode messages like ChoiceCard, GeneratedCard are filtered out since they can't be serialized).

## DB sync logic (use-report-sync.ts)

`shouldHydrateFromServer`: restores from DB if local is empty OR server has more filled sections OR server is at a higher step. Safe for multi-device use.

Save: debounced 2s after any Zustand change. Uses PUT `/api/me/report` with full serialized report.

## How to apply

Whenever a new layout wrapper or page component is created that doesn't use `Layout`, add `useReportSync()` at the top of the component body.

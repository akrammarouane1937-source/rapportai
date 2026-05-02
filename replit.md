# RapportAI — Workspace

## Overview

pnpm workspace monorepo. SaaS for Moroccan students to generate academic reports (PFE/rapport de stage/mémoire) in 30 minutes using Claude Sonnet 4-6 with Word .docx output. Freemium model: 149/449/749 MAD one-time plans.

## Stack

- **Monorepo**: pnpm workspaces + TypeScript 5.9
- **Frontend**: React + Vite + Wouter + Framer Motion + Tailwind + shadcn/ui (`artifacts/rapportai`)
- **Backend**: Express 5 + esbuild bundle (`artifacts/api-server`)
- **Auth**: Clerk (development keys)
- **AI**: Claude claude-sonnet-4-6 via `@workspace/integrations-anthropic-ai` (SSE streaming)
- **Storage**: localStorage (report data + user plan)
- **Build tool**: esbuild (not tsc — pre-existing TS errors in anthropic lib are non-blocking)

## Key Commands

- `pnpm run typecheck` — full typecheck (libs first, then leaves)
- `pnpm --filter @workspace/rapportai exec tsc --noEmit` — frontend typecheck
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Routes

### Frontend (protected unless noted)
| Path | Page | Notes |
|---|---|---|
| `/` | LandingPage | public |
| `/pricing` | PricingPage | public |
| `/sign-in`, `/sign-up` | Clerk auth | public |
| `/onboarding` | OnboardingPage | protected |
| `/dashboard` | DashboardPage | protected, reads reportStore live |
| `/rapport/step-1..6,9` | StepNPage | protected, pre-fill from store |
| `/rapport/step-2` | Step2Page | Page de Garde with A4 preview |
| `/rapport/step-3` | Step3Page | Dédicaces + Remerciements streaming |
| `/rapport/partie-i` | PartieIPage | protected, page-limit upsell |
| `/rapport/partie-ii` | PartieIIPage | protected, page-limit upsell |
| `/juryai` | JuryAIPage | protected, Pro/Premium gate |
| `/demo/*` | Same pages | public demo versions |

### API (all under `/api` prefix)
| Endpoint | Description |
|---|---|
| `GET /api/healthz` | Health check |
| `POST /api/generate` | SSE streaming — generates report sections via Claude |
| `POST /api/jury` | SSE streaming — JuryAI simulation with 3 jury members |
| `POST /api/figures/analyze` | JSON — Claude suggests 2-4 figure ideas from CSV/Excel data or topic |

## Core Libraries (`artifacts/rapportai/src/lib/`)

| File | Purpose |
|---|---|
| `reportStore.ts` | localStorage report data — `getReport()`, `saveReport()`, `useAutoSave()` |
| `userPlan.ts` | Plan management — `getMyPlan()`, `saveMyPlan()`, `incrementRevision()`, `canUseFeature()`, limits per plan |
| `useGenerate.ts` | SSE streaming hook for `/api/generate` — auto-injects full report context from store |
| `markdownToHtml.ts` | Markdown → HTML for WordPreview |
| `generateDocx.ts` | `.docx` export via docx.js |

## Freemium Plans

| Plan | Price | Pages | Revisions | Features |
|---|---|---|---|---|
| Free | 0 MAD | 5 | 3 | Basic |
| Essentiel | 149 MAD | 30 | 10 | + School templates |
| Pro | 449 MAD | 60 | ∞ | + JuryAI, anti-plagiat, citations, certificat |
| Premium | 749 MAD | ∞ | ∞ | + PowerPoint, support prioritaire |

## Key Components

- **`UpsellModal`** — 4 contextual variants: `page-essentiel`, `revision-essentiel`, `page-pro`, `feature`
- **`WordPreview`** — A4 preview with revision panel (tracks `incrementRevision()`), `.docx` export
- **`Sidebar`** — Collapsible icon→label, gates JuryAI & Bibliothèque behind Pro with UpsellModal
- **`ActiveReportCard`** — 9-step stepper with live progress from reportStore
- **`JuryAIPage`** — Split-panel chat interface, 3 jury members (Pr. Benali, Dr. Alaoui, M. Mansouri), SSE streaming, quick-reply chips, progress counter
- **`FigurePanel`** — CSV/Excel upload → Claude analysis → approve/reject suggestion cards → Chart.js PNG rendering → stored in figureStore → auto-inserted into .docx. Works with or without data file.
- **`ScholarChips`** — Dynamic Google Scholar keyword chips derived from student's keywords + theme/filière. 2-3 chips per section, each opens a targeted search in new tab.

## Figures System (`src/lib/` + `src/components/figures/`)

| File | Purpose |
|---|---|
| `parseDataFile.ts` | CSV (papaparse) and Excel (xlsx/SheetJS) parsing → `{ columns, rows, preview }` |
| `figureStore.ts` | localStorage persistence of approved figures with base64 PNG (`getApprovedFigures`, `addApprovedFigure`, `removeApprovedFigure`) |
| `renderChart.ts` | Chart.js v4 rendering to off-screen canvas → PNG base64 (`renderChartToPng`, `renderFallbackChart`) |
| `FigurePanel.tsx` | Full panel UI: upload → analyze → suggestion cards (approve/reject) → approved thumbnails |
| `ScholarChips.tsx` | Dynamic search chips: `https://scholar.google.com/scholar?q=...` |

### Packages added to `@workspace/rapportai`
- `papaparse` + `@types/papaparse` — CSV parsing
- `xlsx` — Excel/SheetJS parsing
- `chart.js` — Chart rendering

### DOCX integration (`generateDocx.ts`)
- `buildFigureImages(placement)` — reads `getApprovedFigures()`, converts base64 → `Uint8Array`, inserts `ImageRun` + caption + description paragraph
- `buildTableFigures()` — uses live `getApprovedFigures()` as "Liste des figures", falls back to `d.figures`
- Figures for "Partie I" injected at end of Partie I section; "Partie II" at end of Partie II

## Design System

- Primary: `#7c3aed` (purple-600)
- Background: `#f9f8ff`
- Headings: Plus Jakarta Sans
- Body: DM Sans
- Border radius: 12px cards, 8px inputs
- Shadows: `0 4px 24px rgba(124,58,237,0.2)`

## Report Workflow (9 steps)

1. Step-1: Infos générales (pre-fills from store on return)
2. Step-2: Page de Garde (live A4 preview, logo upload, color picker)
3. Step-3: Dédicaces + Remerciements (streaming generation)
4. Step-4: Résumé + Abstract
5. Step-5: Sommaire
6. Step-6: Introduction Générale
7. Partie-I: Corps du rapport (with page-limit upsell)
8. Partie-II: Résultats & Discussion (with page-limit upsell)
9. Step-9: Conclusion

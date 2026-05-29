# RapportAI

SaaS platform helping Moroccan students generate full academic internship / PFE / Mémoire reports through a step-by-step chat-based AI assistant.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/rapportai run dev` — run the React frontend (port 8082)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

Required env vars:
- `DATABASE_URL` — Postgres connection string
- `ANTHROPIC_API_KEY` — Anthropic API key (required for AI features)
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk publishable key (frontend auth)
- `CLERK_SECRET_KEY` — Clerk secret key (backend auth)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080, path `/api`)
- Frontend: React + Vite (port 8082, path `/`)
- DB: PostgreSQL + Drizzle ORM
- AI: Anthropic Claude via direct API (`@anthropic-ai/sdk`) + Claude Code SDK (`@anthropic-ai/claude-agent-sdk`)
- Auth: Clerk
- Validation: Zod (`zod/v4`), `drizzle-zod`
- Build: esbuild (CJS bundle for API)

## Where things live

- `artifacts/api-server/src/routes/` — all Express route handlers
  - `converse.ts` — step-by-step chat agent (the main chat flow, steps 2-9)
  - `chat.ts` — orchestrator (Mon Rapport / JuryAI chat)
  - `generate.ts` — section generation endpoint
  - `session*.ts` — session management
- `artifacts/api-server/src/lib/` — shared utilities
  - `sdk-agent.ts` — Claude Code SDK agent (section generation)
  - `humanize-util.ts` — AI humanization (anti-AI-detection)
  - `find-claude-binary.ts` — locates the claude binary across environments
  - `agents/sectionConfigs.ts` — per-section generation prompts and config
- `artifacts/rapportai/src/` — React frontend
  - `pages/` — step pages (step-1 through step-9, partie-i, partie-ii)
  - `hooks/use-conversation.ts` — step chat streaming hook
  - `hooks/use-generate.ts` — section generation streaming hook
  - `lib/store.ts` — Zustand store (report state)
- `lib/db/` — Drizzle schema and migrations

## Architecture decisions

- **Contract-first**: step agents in `converse.ts` use tool calls (`generate_section`, `step_complete`) that the frontend processes as streaming SSE actions — the chat response and section generation are completely decoupled.
- **Claude Code SDK for generation**: heavy section generation uses the Claude Code SDK (which spawns a full coding agent with file system access) for maximum quality. The `find-claude-binary.ts` locates the binary across environments.
- **Session isolation**: each user gets a working directory under `/tmp/rapportai-sessions/<sessionId>/` where the agent reads/writes Markdown files.
- **Humanization**: every generated section is post-processed through `humanize-util.ts` (Haiku) to reduce AI-detection.
- **FREE_LAUNCH mode**: `FREE_LAUNCH=true` env var bypasses all plan/quota limits (used post-launch).

## Product

A step-by-step report builder:
1. Step 1: General info (theme, school, filiere, type, year) — pure frontend, no AI
2. Step 2: Cover page (page de garde) — chat collects encadrant info, generates
3. Step 3: Dédicaces & Remerciements
4. Step 4: Résumé & Abstract
5. Step 5: Sommaire
6. Step 6: Introduction
7. Step 7-8: Partie I & II (full multi-chapter academic content)
8. Step 9: Conclusion, Bibliographie, Abréviations
9. Final: Mon Rapport (full document view, export to DOCX/PDF)

## User preferences

- Fix bugs precisely — don't rewrite working code
- Keep conversations natural and in French (Moroccan student tone)
- AI should feel proactive, not ask redundant questions

## Gotchas

- **Model names**: Use `claude-haiku-4-5` and `claude-sonnet-4-5` (not versioned suffixes like `-20251001` or `4-6`)
- **Orchestrator model**: `chat.ts` uses `claude-sonnet-4-5` with 2048 tokens — do NOT downgrade to haiku (too weak for orchestration)
- **Step advancement**: `step_complete` must be called in the SAME response as the last `generate_section` — if split across turns, the step never advances
- **Claude binary**: `find-claude-binary.ts` scans multiple paths including Replit's pnpm store at `/home/runner/workspace/node_modules/.pnpm`
- **Port assignments**: API server = 8080, rapportai frontend = 8082, mockup-sandbox = 8081

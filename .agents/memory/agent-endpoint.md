---
name: Unified Agent Endpoint (Phase 1)
description: Architecture of the new /api/agent/:step/stream endpoint replacing the two-agent Vercel AI SDK system.
---

# Unified Agent Endpoint

**Why:** The old system had two separate roundtrips (converse.ts for chat → frontend triggers generate.ts for generation). This caused the GeneratedCard pattern and the complex phase-based state machine in partie-i/ii.

**New architecture:**
- `POST /api/agent/:step/stream` in `artifacts/api-server/src/routes/agent.ts`
- Step "2"–"11", "partie-i", "partie-ii" are valid step values
- Haiku coordinator (non-streaming, max 1200 tokens) decides: `chat | generate | complete`
- If generate: runs `agent.streamSection()` sequentially per section, reads .md files, humanizes, emits `file_written` SSE event
- SSE events: `{ type: "text"|"tool_call"|"file_written"|"step_done"|"done"|"error" }`
- History compressed to first 2 + last 6 turns before sending to coordinator

**Frontend hook:** `useStepAgent` in `artifacts/rapportai/src/hooks/use-step-agent.ts`
- Drop-in replacement for `useConversation` (same return signature)
- Persists chat history to `rapportai_chat_step${step}` in localStorage
- Uses `fetchEventSource` for SSE
- `file_written` event → calls `onSectionGenerated(section, content)` callback
- `step_done` event → calls `onStepComplete()` callback

**How to apply:**
- All step pages (step-2 through step-11, partie-i, partie-ii) now use `useStepAgent` instead of `useConversation`
- `onSectionGenerated` callback still used per step for custom store updates (e.g., step-4 splits resume/abstract)
- `autoSend` option works the same as before (silent initial message)
- Old `useConversation` / `converse.ts` still exist and are NOT removed (backward compat)

**Gotchas:**
- Coordinator output must strictly follow `ACTION: / SECTIONS: / CONTEXT: / RESPONSE:` format
- `step` param in the route is `string | string[]` due to Express types — always cast with `Array.isArray(step) ? step[0] : step`
- Session store set requires `as any` cast because SDKReportAgent and AgentSession aren't formally typed as subclass
- `streamingHumanize` requires a callback even when not streaming: call with `() => {}`

---
name: Unified Agent Endpoint
description: Architectural decision for /api/agent/:step/stream — Haiku coordinator decides chat vs generate, Claude Agent SDK does the generation.
---

# Unified Agent Endpoint Architecture

**Why two phases (coordinator + generation):** The Claude Agent SDK takes 5-10 minutes for Partie I/II. A fast Haiku coordinator (~500ms) gives the user an immediate conversational response before the long generation starts, so the UI never goes blank. This was explicitly designed in Phase 1.

**Coordinator output format (MUST match):**
```
ACTION: chat|generate|complete
SECTIONS: section-id1,section-id2   # only for generate
CONTEXT: <text for extraContext>     # only for generate
RESPONSE: <text shown to student>
```

**Session reliability rule:** If `action === "generate"` but no agent session is found (expired/restarted server), emit a clear "Session expirée, recharge la page" error — never silently skip generation. User's chat history is safe in localStorage.

**File uploads:** Files attached to ChatInput are uploaded to the session workDir via `POST /api/session/:id/upload-document` BEFORE the SSE stream opens. The Claude Agent SDK's Read tool then finds them during generation.

**History strategy:** First 2 + last 6 turns sent to the coordinator (max 8 turns). Middle turns are dropped — acceptable for the coordinator's routing decision.

**Step parameter:** `req.params.step` from Express is typed as `string | string[]` — always cast with `Array.isArray(step) ? step[0] : step` before use.

---
name: Interactive choice cards (ask_user tool)
description: Claude can propose clickable choices in chat; how the tool/action/component pipeline works
---

## Rule

Claude can use the `ask_user` tool (defined in `converse.ts` TOOLS array) to present 2–4 clickable options instead of waiting for free text. Clicking auto-sends the choice as a user message.

**Why:** Better UX for structured decisions (confirm a plan, pick a tone, validate direction). Matches the "radio button" interaction pattern requested.

## Pipeline

1. **Backend** (`converse.ts`): `ask_user` is in TOOLS. When Claude calls it, the streaming loop emits:
   `data: { action: { type: "ask_user", question: "...", choices: ["A", "B"] } }`

2. **Hook** (`use-conversation.ts`): After stream ends, pendingActions loop checks `action.type === "ask_user"` → calls `createElement(ChoiceCard, { question, choices, onChoice: (c) => sendRef.current(c) })`

3. **sendRef pattern**: `sendRef` is a `useRef` kept current via `useEffect(() => { sendRef.current = (text) => send(text); }, [send])`. This prevents the onChoice callback from going stale across re-renders.

4. **Component** (`chat-panel.tsx`): `ChoiceCard` — radio-style buttons, purple on selection, auto-disabled after pick, framer-motion entry animation.

## How to apply

Claude chooses when to use it. The tool description says: "UNIQUEMENT quand tu as 2 à 4 options courtes et claires — jamais pour des questions ouvertes." Don't force it; Claude decides.

If the ChoiceCard needs to be used in a non-converse context (e.g. a standalone chat), import it from `@/components/chat-panel` and wire up an `onChoice` prop manually.

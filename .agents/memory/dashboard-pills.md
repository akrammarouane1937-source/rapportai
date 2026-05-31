---
name: Dashboard quick-action pills
description: How to implement pills that show a short label in the chat bubble but send an enriched prompt to the API
---

The pattern for quick-action pills in DashboardPage.tsx is `sendQuickAction(label, prompt)`.

**Why:** Using `sendWithText(expandedText)` sets `input = expandedText` then calls send(), so the full expanded prompt appears in the user message bubble — ugly and confusing.

**How to apply:** `sendQuickAction` pushes the short `label` into the messages[] array (for display), then calls `sendInternal(prompt, historyWithUser)` which uses `prompt` for the API history. The last user message in history always uses `apiText`, all prior messages use their display text.

The `sendInternal(apiText, historyWithUser)` function is the core send logic — both `sendWithText` and `sendQuickAction` delegate to it. The plain `send()` function reads from the `input` state and calls `sendWithText`.

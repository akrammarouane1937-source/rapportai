---
name: AI SDK package split
description: Where Chat class and transport utilities live across ai v6 and @ai-sdk/react v3
---

# Rule
- `Chat` class (concrete, instantiable) → `@ai-sdk/react` v3
- `AbstractChat`, `ChatInit`, `DefaultChatTransport`, `UIMessage`, `FileUIPart`, `convertToModelMessages`, `pipeUIMessageStreamToResponse`, `streamText` → `ai` v6
- `useChat`, `Chat` → `@ai-sdk/react` v3

**Why:** In v6 the SDK split framework-specific code into `@ai-sdk/react`. The `Chat` class (which implements React-specific subscriptions) lives there, not in the core `ai` package.

**How to apply:** Check imports whenever using `Chat` or `useChat` — `Chat` is from `@ai-sdk/react`, transports and model utilities from `ai`.

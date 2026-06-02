---
name: Vercel AI SDK tool call pattern
description: How to handle static tool calls in @ai-sdk/react v3 with onToolCall returning void
---

# Rule
`onToolCall` in `ChatInit` (and the `Chat` constructor) returns `void | PromiseLike<void>` — you CANNOT return tool result values from it. Use `addToolOutput` from `useChat` to send results instead.

# Pattern

```typescript
const addToolOutputRef = useRef<((toolCallId: string, toolName: string, output: unknown) => void) | null>(null);

// In Chat constructor:
onToolCall: async (options) => {
  const { toolCallId, toolName } = options.toolCall as { toolCallId: string; toolName: string; input: unknown };
  // ... side effects ...
  addToolOutputRef.current?.(toolCallId, toolName, { success: true });
  // implicit void return
},

// After useChat:
const { addToolOutput } = useChat({ chat: chatRef.current });
addToolOutputRef.current = (toolCallId, toolName, output) => {
  (addToolOutput as any)({ toolCallId, tool: toolName, output, state: 'output-available' });
};
```

**Why:** The `ChatAddToolOutputFunction` signature is generic over `keyof InferUIMessageTools<UI_MESSAGE>` — when using base `UIMessage` (no specific tools), you must cast to `any` to call it. The `addToolOutputRef` must be set AFTER `useChat` but is always initialized before any tool call fires.

**How to apply:** Any use of `onToolCall` in the Chat constructor in this codebase.

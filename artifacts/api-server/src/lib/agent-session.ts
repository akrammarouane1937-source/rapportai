import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// ─── Stream event types ───────────────────────────────────────────────────────
// The session yields typed events so routes can handle each case specifically.

export type StreamEvent =
  | { type: "text";      content: string }
  | { type: "tool_call"; name: string }
  | { type: "question";  question: string; choices?: string[]; toolUseId: string };

// ─── AgentSession ─────────────────────────────────────────────────────────────

export class AgentSession {
  readonly id: string;
  readonly createdAt: Date;
  lastActiveAt: Date;

  protected history: Anthropic.MessageParam[] = [];
  protected readonly systemPrompt: string;
  protected readonly tools: Anthropic.Tool[];

  constructor(id: string, systemPrompt: string, tools: Anthropic.Tool[] = []) {
    this.id = id;
    this.systemPrompt = systemPrompt;
    this.tools = tools;
    this.createdAt = new Date();
    this.lastActiveAt = new Date();
  }

  getHistory(): Anthropic.MessageParam[] {
    return this.history;
  }

  /**
   * Resume the session after a user answered a question.
   * The answer is injected as a tool result, then generation continues.
   */
  injectToolResult(toolUseId: string, answer: string): void {
    this.history.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUseId, content: answer }],
    });
  }

  /**
   * Send a user message and stream typed events back.
   * Text is yielded as { type: "text" } chunks.
   * Tool calls fire { type: "tool_call" } then resolve internally.
   * ask_user yields { type: "question" } and stops — caller must resume via injectToolResult.
   */
  async *stream(userContent: string): AsyncGenerator<StreamEvent> {
    this.lastActiveAt = new Date();
    this.history.push({ role: "user", content: userContent });
    yield* this._run();
  }

  /**
   * Continue streaming after a tool result was injected (used for ask_user resume).
   * Does NOT push a new user message — history already has the tool result.
   */
  async *resume(): AsyncGenerator<StreamEvent> {
    this.lastActiveAt = new Date();
    yield* this._run();
  }

  private async *_run(): AsyncGenerator<StreamEvent> {
    const MAX_ITERATIONS = 10;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        system: this.systemPrompt,
        tools: this.tools.length > 0 ? this.tools : undefined,
        messages: this.history,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", content: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      this.history.push({ role: "assistant", content: final.content });

      if (final.stop_reason !== "tool_use") break;

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of final.content) {
        if (block.type !== "tool_use") continue;

        yield { type: "tool_call", name: block.name };

        // ask_user is special — pause and let the caller collect the answer
        if (block.name === "ask_user") {
          // Flush any tool results accumulated before this ask_user call
          if (toolResults.length > 0) {
            this.history.push({ role: "user", content: toolResults });
          }
          const input = block.input as { question: string; choices?: string[] };
          yield { type: "question", question: input.question, choices: input.choices, toolUseId: block.id };
          return; // Stop here — caller must inject the answer and call resume()
        }

        const result = await this.handleTool(block.name, block.input);
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }

      if (toolResults.length > 0) {
        this.history.push({ role: "user", content: toolResults });
      }
    }
  }

  protected async handleTool(_name: string, _input: unknown): Promise<string> {
    return "Tool not implemented.";
  }
}

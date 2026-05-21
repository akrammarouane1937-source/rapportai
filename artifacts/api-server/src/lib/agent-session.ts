import Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@workspace/integrations-anthropic-ai";

// ─── Stream event types ───────────────────────────────────────────────────────

export type StreamEvent =
  | { type: "text";        content: string }
  | { type: "tool_call";   name: string; detail?: string }
  | { type: "tool_result"; name: string; summary: string }
  | { type: "phase";       text: string }
  | { type: "question";    question: string; choices?: string[]; toolUseId: string };

// ─── Per-section token budgets ────────────────────────────────────────────────

export const SECTION_MAX_TOKENS: Record<string, number> = {
  "page-de-garde":  600,
  "remerciements":  500,
  "dedicaces":      400,
  "resume":         800,
  "sommaire":       600,
  "introduction":  1500,
  "partie-i":      4096,
  "partie-ii":     4096,
  "conclusion":    1200,
  "bibliographie": 1000,
};

export function maxTokensForSection(section: string): number {
  return SECTION_MAX_TOKENS[section] ?? 2048;
}

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

  injectToolResult(toolUseId: string, answer: string): void {
    this.history.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUseId, content: answer }],
    });
  }

  async *stream(userContent: string): AsyncGenerator<StreamEvent> {
    this.lastActiveAt = new Date();
    this.history.push({ role: "user", content: userContent });
    yield* this._run();
  }

  async *resume(): AsyncGenerator<StreamEvent> {
    this.lastActiveAt = new Date();
    yield* this._run();
  }

  private async *_run(): AsyncGenerator<StreamEvent> {
    const MAX_ITERATIONS = 10;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
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

        if (block.name === "ask_user") {
          if (toolResults.length > 0) {
            this.history.push({ role: "user", content: toolResults });
          }
          const input = block.input as { question: string; choices?: string[] };
          yield { type: "question", question: input.question, choices: input.choices, toolUseId: block.id };
          return;
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

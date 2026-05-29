/**
 * agent-runner.mjs
 * Runs INSIDE the Vercel Sandbox microVM.
 * Receives a task via stdin JSON, runs the Agent SDK, writes output files.
 * Prints structured JSON lines to stdout so the host can stream them back.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { readFileSync } from "fs";

const input = JSON.parse(readFileSync("/dev/stdin", "utf-8"));
const { prompt, systemPrompt, maxTurns = 25, cwd = "/work" } = input;

process.chdir(cwd);

for await (const message of query({
  prompt,
  options: {
    maxTurns,
    cwd,
    systemPrompt,
    permissionMode: "acceptEdits",
    allowedTools: ["Read", "Write", "Edit", "WebFetch", "Glob", "Bash"],
  },
})) {
  if (message.type === "assistant") {
    for (const block of message.message.content) {
      if (block.type === "text" && block.text) {
        process.stdout.write(JSON.stringify({ type: "text", content: block.text }) + "\n");
      }
      if (block.type === "tool_use") {
        process.stdout.write(JSON.stringify({ type: "tool_call", name: block.name }) + "\n");
      }
    }
  }
  if (message.type === "result") {
    process.stdout.write(JSON.stringify({ type: "done", subtype: message.subtype }) + "\n");
  }
}

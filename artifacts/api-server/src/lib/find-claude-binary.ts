import { existsSync } from "fs";
import { execSync } from "child_process";

// Finds the claude binary in pnpm's virtual store on Render.
// pnpm links optional platform packages into .pnpm/ but doesn't always
// create a symlink in the top-level node_modules/.bin. This function
// probes known locations and returns the first that exists.
export function findClaudeBinary(): string | undefined {
  const candidates = [
    // pnpm hoisted .bin inside the virtual store (most reliable on Render)
    "/opt/render/project/src/node_modules/.pnpm/node_modules/.bin/claude",
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Fallback: scan pnpm store for claude-agent-sdk linux binary
  try {
    const found = execSync(
      "find /opt/render/project/src/node_modules/.pnpm -name 'claude' -type f 2>/dev/null | grep 'claude-agent-sdk-linux' | head -1",
      { encoding: "utf8" }
    ).trim();
    if (found) return found;
  } catch { /* ignore */ }

  // Fallback: claude-code linux binary
  try {
    const found = execSync(
      "find /opt/render/project/src/node_modules/.pnpm -name 'claude' -type f 2>/dev/null | grep 'claude-code-linux' | head -1",
      { encoding: "utf8" }
    ).trim();
    if (found) return found;
  } catch { /* ignore */ }

  return undefined;
}

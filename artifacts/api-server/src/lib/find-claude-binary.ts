import { existsSync } from "fs";
import { execSync } from "child_process";

// Finds the claude binary across Render, Railway, and generic Node environments.
export function findClaudeBinary(): string | undefined {
  const candidates = [
    // Replit workspace pnpm store
    "/home/runner/workspace/node_modules/.pnpm/node_modules/.bin/claude",
    "/home/runner/workspace/node_modules/.bin/claude",
    // Render pnpm virtual store
    "/opt/render/project/src/node_modules/.pnpm/node_modules/.bin/claude",
    // Railway / generic deployments
    "/app/node_modules/.bin/claude",
    "/app/node_modules/.pnpm/node_modules/.bin/claude",
    // Local development (pnpm)
    "./node_modules/.bin/claude",
    "./node_modules/.pnpm/node_modules/.bin/claude",
    // npm global
    "/usr/local/bin/claude",
    "/usr/bin/claude",
  ];

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }

  // Dynamic scan — works on Render, Railway, Fly.io
  const scanRoots = [
    "/home/runner/workspace/node_modules/.pnpm",
    "/opt/render/project/src/node_modules/.pnpm",
    "/app/node_modules/.pnpm",
    "./node_modules/.pnpm",
  ];

  for (const root of scanRoots) {
    if (!existsSync(root)) continue;
    for (const pattern of ["claude-agent-sdk-linux", "claude-code-linux", "claude-code"]) {
      try {
        const found = execSync(
          `find "${root}" -name 'claude' -type f 2>/dev/null | grep '${pattern}' | head -1`,
          { encoding: "utf8", timeout: 3000 }
        ).trim();
        if (found) return found;
      } catch { /* ignore */ }
    }
  }

  // Last resort: check if `claude` is on PATH
  try {
    const found = execSync("which claude 2>/dev/null", { encoding: "utf8", timeout: 2000 }).trim();
    if (found) return found;
  } catch { /* not on PATH */ }

  return undefined;
}

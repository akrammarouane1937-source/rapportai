import Anthropic from "@anthropic-ai/sdk";

// Supports both the standard ANTHROPIC_API_KEY (Railway/Vercel)
// and the Replit-specific AI_INTEGRATIONS_ANTHROPIC_API_KEY wrapper.
const apiKey =
  process.env.ANTHROPIC_API_KEY ??
  process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;

const baseURL =
  process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";

if (!apiKey) {
  throw new Error(
    "ANTHROPIC_API_KEY must be set. Add it as an environment variable."
  );
}

export const anthropic = new Anthropic({ apiKey, baseURL });

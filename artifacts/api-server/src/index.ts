import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { findClaudeBinary } from "./lib/find-claude-binary";

async function runMigrations() {
  if (!process.env.DATABASE_URL) return;
  try {
    const client = await pool.connect();
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE referral_status AS ENUM ('pending', 'completed', 'rewarded');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE reward_status AS ENUM ('pending', 'processing', 'paid');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS users (
        id                      SERIAL PRIMARY KEY,
        clerk_id                TEXT NOT NULL UNIQUE,
        email                   TEXT,
        name                    TEXT,
        referral_code           TEXT NOT NULL UNIQUE,
        referred_by_code        TEXT,
        referral_balance        INTEGER NOT NULL DEFAULT 0,
        referral_balance_frozen INTEGER NOT NULL DEFAULT 0,
        is_founding_user        BOOLEAN NOT NULL DEFAULT FALSE,
        stripe_connect_id       TEXT,
        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS referrals (
        id           SERIAL PRIMARY KEY,
        referrer_id  INTEGER NOT NULL REFERENCES users(id),
        referred_id  INTEGER NOT NULL REFERENCES users(id),
        status       referral_status NOT NULL DEFAULT 'pending',
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS referral_rewards (
        id             SERIAL PRIMARY KEY,
        user_id        INTEGER NOT NULL REFERENCES users(id),
        amount         INTEGER NOT NULL,
        reason         TEXT NOT NULL,
        method         TEXT,
        payout_details TEXT,
        status         reward_status NOT NULL DEFAULT 'pending',
        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at        TIMESTAMPTZ
      );

      -- Autosave of each user's report data (was missing in prod → /me/report 500s,
      -- users couldn't save or load their work).
      CREATE TABLE IF NOT EXISTS user_report_data (
        clerk_user_id TEXT PRIMARY KEY,
        report_data   TEXT NOT NULL,
        updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    client.release();
    logger.info("DB migrations applied");
  } catch (err) {
    logger.error({ err }, "DB migration failed — continuing anyway");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

function logStartupDiagnostics() {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
  const hasClerkSecret = !!process.env.CLERK_SECRET_KEY;
  const hasDb = !!process.env.DATABASE_URL;
  const claudeBinary = findClaudeBinary();

  logger.info({
    env: {
      ANTHROPIC_API_KEY: hasAnthropicKey ? "✅ set" : "❌ MISSING — generation will fail",
      CLERK_SECRET_KEY: hasClerkSecret ? "✅ set" : "❌ MISSING — auth will fail",
      DATABASE_URL: hasDb ? "✅ set" : "❌ MISSING — DB unavailable",
      CLAUDE_BINARY: claudeBinary ?? "❌ NOT FOUND — generation will fail",
      FREE_LAUNCH: process.env.FREE_LAUNCH ?? "not set",
    },
  }, "Startup diagnostics");

  if (!hasAnthropicKey) {
    logger.error("ANTHROPIC_API_KEY is not set — add it to your environment variables on Render/Railway");
  }
  if (!claudeBinary) {
    logger.error("Claude binary not found — @anthropic-ai/claude-code may not be installed");
  }
}

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    logStartupDiagnostics();
  });
});

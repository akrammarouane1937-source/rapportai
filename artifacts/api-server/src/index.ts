import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

async function runMigrations() {
  if (!process.env.DATABASE_URL) return;
  try {
    const client = await pool.connect();
    await client.query(`
      CREATE TYPE IF NOT EXISTS referral_status AS ENUM ('pending', 'completed', 'rewarded');
      CREATE TYPE IF NOT EXISTS reward_status   AS ENUM ('pending', 'processing', 'paid');

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

runMigrations().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});

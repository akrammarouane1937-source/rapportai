import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachPlan } from "./lib/plan-guard";
import { stripeWebhookHandler } from "./routes/stripe";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// ── CORS ──────────────────────────────────────────────────────────────────
// Priority: CORS_ORIGIN env var (Vercel/Railway) → REPLIT_DOMAINS → allow all
const ALLOWED_ORIGINS = (() => {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(",").map((o) => o.trim());
  }
  const domains = process.env.REPLIT_DOMAINS;
  if (!domains) return null; // dev / Railway without explicit origin: allow all
  return domains.split(",").map((d) => `https://${d.trim()}`);
})();

app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      if (!ALLOWED_ORIGINS) return cb(null, true); // local dev
      if (!origin) return cb(null, true);           // server-to-server / curl
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: origin ${origin} not allowed`));
    },
  }),
);

// Stripe webhook MUST be before express.json() — needs raw body for signature verification
app.post("/api/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Force UTF-8 charset on all JSON responses so French accents never corrupt
app.use((_req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return originalJson(body);
  };
  next();
});

// Only activate Clerk middleware when the secret key is present.
// Without it the middleware throws on every request, blocking all routes.
if (process.env.CLERK_SECRET_KEY) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

// ── Rate limiter — 20 req / 60 s per IP on /api/generate & /api/chat ──────
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress
    ?? "unknown";
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  if (bucket.count > RATE_LIMIT) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfter);
    res.status(429).json({ error: "Trop de requêtes. Réessaie dans quelques secondes." });
    return;
  }
  next();
}

// Clean up old buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBuckets) {
    if (now > bucket.resetAt) rateBuckets.delete(ip);
  }
}, 5 * 60_000);

// Strict limit on session start (prevent session flooding — 10/min per IP)
const rateBucketsStrict = new Map<string, { count: number; resetAt: number }>();
function rateLimitStrict(req: Request, res: Response, next: NextFunction) {
  const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim()
    ?? req.socket?.remoteAddress ?? "unknown";
  const now = Date.now();
  let bucket = rateBucketsStrict.get(ip);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateBucketsStrict.set(ip, bucket);
  }
  bucket.count++;
  if (bucket.count > 10) {
    res.status(429).json({ error: "Trop de sessions créées. Attends 1 minute." });
    return;
  }
  next();
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, bucket] of rateBucketsStrict) {
    if (now > bucket.resetAt) rateBucketsStrict.delete(ip);
  }
}, 5 * 60_000);

app.use("/api/generate",        rateLimit);
app.use("/api/chat",            rateLimit);
app.use("/api/session/start",   rateLimitStrict);
app.use("/api/session",         rateLimit);  // generate + revise + upload

// Attach plan context to every /api request (bypassed during FREE_LAUNCH)
app.use("/api", attachPlan);

app.use("/api", router);

// ── Global error handler ───────────────────────────────────────────────────
// Catches any unhandled Express errors and logs them before responding.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err, url: req.url, method: req.method }, "Unhandled server error");
  if (!res.headersSent) {
    res.status(500).json({ error: "Une erreur interne est survenue. Réessaie." });
  }
});

export default app;

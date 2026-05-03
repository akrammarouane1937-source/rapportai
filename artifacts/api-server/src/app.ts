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

// ── CORS — locked to the Replit proxy domain ──────────────────────────────
const ALLOWED_ORIGINS = (() => {
  const domains = process.env.REPLIT_DOMAINS;
  if (!domains) return null; // dev: allow all
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

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use("/api/generate", rateLimit);
app.use("/api/chat", rateLimit);

app.use("/api", router);

export default app;

import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, reportsTable } from "@workspace/db";

// ─── Plan definitions (must mirror frontend userPlan.ts) ─────────────────────

export type PlanId = "free" | "starter" | "pro";

interface PlanLimit {
  pages:     number;   // max pages (250 words ≈ 1 page). Infinity = unlimited.
  revisions: number;
}

const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
  free:    { pages: 15,       revisions: 2        },
  starter: { pages: 60,       revisions: 20       },
  pro:     { pages: Infinity, revisions: Infinity },
};

const VALID_PLANS = new Set<string>(["free", "starter", "pro"]);

function parsePlanId(raw: string | undefined): PlanId {
  if (raw && VALID_PLANS.has(raw)) return raw as PlanId;
  return "pro"; // default: unlimited during free launch
}

/** 250 words ≈ 1 page */
export function wordsToPages(wordCount: number): number {
  return Math.ceil(wordCount / 250);
}

// ─── Augment Express request with plan context ────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      planId:        PlanId;
      planPages:     number;
      planRevisions: number;
    }
  }
}

// ─── Middleware: attach plan to every request ─────────────────────────────────
// During free launch (FREE_LAUNCH=true), all limits are bypassed.
// Founding users (x-founding: true) bypass all limits forever.

export function attachPlan(req: Request, _res: Response, next: NextFunction) {
  if (process.env.FREE_LAUNCH === "true" || req.headers["x-founding"] === "true") {
    req.planId        = "pro";
    req.planPages     = Infinity;
    req.planRevisions = Infinity;
    return next();
  }

  const planId      = parsePlanId(req.headers["x-plan-id"] as string | undefined);
  req.planId        = planId;
  req.planPages     = PLAN_LIMITS[planId].pages;
  req.planRevisions = PLAN_LIMITS[planId].revisions;
  next();
}

// ─── Guard: reject if report is unpaid ───────────────────────────────────────

export async function guardPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (process.env.FREE_LAUNCH === "true" || req.headers["x-founding"] === "true") {
    next(); return;
  }
  if (req.planId === "free") { next(); return; }

  const reportId = req.params.sessionId;
  if (!reportId) { next(); return; }

  try {
    const report = await db.query.reportsTable.findFirst({
      where: eq(reportsTable.id, reportId),
    });
    if (!report || report.paymentStatus !== "paid") {
      res.status(402).json({
        error:             "payment_required",
        checkout_required: true,
        message:           "Complétez le paiement pour générer votre rapport.",
      });
      return;
    }
  } catch {
    // DB unavailable — fail open so generation isn't blocked by infra issues
  }
  next();
}

// ─── Guard: reject if page limit exceeded ────────────────────────────────────
// Frontend sends x-pages-generated header (total pages generated so far).

export function guardPageLimit(req: Request, res: Response, next: NextFunction) {
  if (process.env.FREE_LAUNCH === "true" || req.headers["x-founding"] === "true") return next();

  const pagesGenerated = parseInt(req.headers["x-pages-generated"] as string ?? "0", 10);
  const limit          = req.planPages;

  if (isFinite(limit) && pagesGenerated >= limit) {
    res.status(403).json({
      error:       "plan_limit_reached",
      limit_type:  "pages",
      message:     `Tu as atteint la limite de ${limit} pages de ton plan ${req.planId === "free" ? "Gratuit" : "Essentiel"}.`,
      planId:      req.planId,
      limit,
      pagesGenerated,
    });
    return;
  }
  next();
}

// ─── Guard: reject if revision limit exceeded ─────────────────────────────────

export function guardRevisionLimit(req: Request, res: Response, next: NextFunction) {
  if (process.env.FREE_LAUNCH === "true" || req.headers["x-founding"] === "true") return next();

  const revisions = parseInt(req.headers["x-revision-count"] as string ?? "0", 10);
  const limit      = req.planRevisions;

  if (isFinite(limit) && revisions >= limit) {
    res.status(403).json({
      error:      "plan_limit_reached",
      limit_type: "revisions",
      message:    `Tu as atteint la limite de ${limit} révisions de ton plan ${req.planId === "free" ? "Gratuit" : "Essentiel"}.`,
      planId:     req.planId,
      limit,
      revisions,
    });
    return;
  }
  next();
}

// ─── Legacy aliases (kept for backward compat with old routes) ────────────────
export const guardSectionLimit = guardPageLimit;

import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, reportsTable } from "@workspace/db";

// ─── Plan definitions (must mirror frontend userPlan.ts) ─────────────────────

export type PlanId = "free" | "basique" | "starter" | "pro";

interface PlanLimit {
  pages:     number;   // max pages (250 words ≈ 1 page). Infinity = unlimited.
  revisions: number;
}

const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
  free:    { pages: 12,       revisions: 2        },
  basique: { pages: Infinity, revisions: 8        },  // section-gated only (Partie I), no page cap
  starter: { pages: 60,       revisions: 20       },
  pro:     { pages: Infinity, revisions: Infinity },
};

const VALID_PLANS = new Set<string>(["free", "basique", "starter", "pro"]);

// ─── Section-based gating ─────────────────────────────────────────────────────
// The real paywall is BY SECTION, not page count. Free gets the full frame
// (front matter + Introduction); Partie I is the first locked section.

const PLAN_RANK: Record<PlanId, number> = { free: 0, basique: 1, starter: 2, pro: 3 };

// Minimum plan required to generate each section. Keys are server section ids
// (see ZUSTAND_KEY in routes/agent.ts). Sections absent here default to "free".
const SECTION_MIN_PLAN: Record<string, PlanId> = {
  "page-de-garde": "free",
  "dedicaces":     "free",
  "remerciements": "free",
  "resume":        "free",
  "abstract":      "free",
  "sommaire":      "free",
  "introduction":  "free",
  "partie-i":      "basique",
  "partie-ii":     "starter",
  "conclusion":    "starter",
  "bibliographie": "starter",
  "abbreviations": "starter",
  "liste-figures": "starter",
  "liste-tableaux":"starter",
};

function planLabel(plan: PlanId): string {
  return plan === "free" ? "Gratuit" : plan === "basique" ? "Basique" : plan === "starter" ? "Essentiel" : "Pro";
}

function parsePlanId(raw: string | undefined): PlanId {
  if (raw && VALID_PLANS.has(raw)) return raw as PlanId;
  return "free";
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
// Founding users bypass limits only if x-founding matches the FOUNDING_SECRET
// env var — a bare "true" header was spoofable from DevTools.

function bypassLimits(req: Request): boolean {
  if (process.env.FREE_LAUNCH === "true") return true;
  const secret = process.env.FOUNDING_SECRET;
  return !!secret && req.headers["x-founding"] === secret;
}

export function attachPlan(req: Request, _res: Response, next: NextFunction) {
  if (bypassLimits(req)) {
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
  if (bypassLimits(req)) {
    next(); return;
  }
  if (req.planId === "free") { next(); return; }

  const reportId = req.params.sessionId as string;
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

// ─── Guard: reject if the section is above the user's plan ────────────────────
// The generate route puts the section id in req.body.section (parsed by the
// multipart middleware that runs before this guard).

export function guardSectionAccess(req: Request, res: Response, next: NextFunction) {
  if (bypassLimits(req)) return next();

  const section = (req.body as { section?: string } | undefined)?.section?.trim();
  if (!section) { next(); return; }   // unknown section → let downstream handle

  const required = SECTION_MIN_PLAN[section] ?? "free";
  if (PLAN_RANK[req.planId] < PLAN_RANK[required]) {
    res.status(403).json({
      error:        "plan_limit_reached",
      limit_type:   "section",
      section,
      requiredPlan: required,
      planId:       req.planId,
      message:      `Cette section nécessite le plan ${planLabel(required)}.`,
    });
    return;
  }
  next();
}

// ─── Guard: reject if page limit exceeded ────────────────────────────────────
// Frontend sends x-pages-generated header (total pages generated so far).
// Secondary backstop — section gating is the primary control.

export function guardPageLimit(req: Request, res: Response, next: NextFunction) {
  if (bypassLimits(req)) return next();

  const pagesGenerated = parseInt(req.headers["x-pages-generated"] as string ?? "0", 10);
  const limit          = req.planPages;

  if (isFinite(limit) && pagesGenerated >= limit) {
    res.status(403).json({
      error:       "plan_limit_reached",
      limit_type:  "pages",
      message:     `Tu as atteint la limite de ${limit} pages de ton plan ${planLabel(req.planId)}.`,
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
  if (bypassLimits(req)) return next();

  const revisions = parseInt(req.headers["x-revision-count"] as string ?? "0", 10);
  const limit      = req.planRevisions;

  if (isFinite(limit) && revisions >= limit) {
    res.status(403).json({
      error:      "plan_limit_reached",
      limit_type: "revisions",
      message:    `Tu as atteint la limite de ${limit} révisions de ton plan ${planLabel(req.planId)}.`,
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

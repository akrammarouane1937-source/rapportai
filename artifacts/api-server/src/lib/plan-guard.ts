import type { Request, Response, NextFunction } from "express";

// ─── Plan definitions (must mirror frontend userPlan.ts) ─────────────────────

export type PlanId = "free" | "starter" | "pro";

interface PlanLimit {
  sections:  number;
  revisions: number;
}

const PLAN_LIMITS: Record<PlanId, PlanLimit> = {
  free:    { sections: 3,        revisions: 2        },
  starter: { sections: 60,       revisions: 10       },
  pro:     { sections: Infinity, revisions: Infinity },
};

const VALID_PLANS = new Set<string>(["free", "starter", "pro"]);

function parsePlanId(raw: string | undefined): PlanId {
  if (raw && VALID_PLANS.has(raw)) return raw as PlanId;
  return "pro"; // default: unlimited during free launch
}

// ─── Augment Express request with plan context ────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      planId:            PlanId;
      planSections:      number;
      planRevisions:     number;
    }
  }
}

// ─── Middleware: attach plan to every request ─────────────────────────────────
// During free launch (FREE_LAUNCH=true), all limits are bypassed.
// Post-launch: reads plan from x-plan-id header (honor system until Clerk metadata
// is wired — replace header read with clerkClient.users.getUser() at that point).

export function attachPlan(req: Request, _res: Response, next: NextFunction) {
  if (process.env.FREE_LAUNCH === "true") {
    req.planId        = "pro";
    req.planSections  = Infinity;
    req.planRevisions = Infinity;
    return next();
  }

  const planId      = parsePlanId(req.headers["x-plan-id"] as string | undefined);
  req.planId        = planId;
  req.planSections  = PLAN_LIMITS[planId].sections;
  req.planRevisions = PLAN_LIMITS[planId].revisions;
  next();
}

// ─── Guard: reject if section limit exceeded ─────────────────────────────────
// Reads x-sections-generated header (sent by frontend) to check against plan.
// Post-launch: replace this with a DB/Clerk read for real enforcement.

export function guardSectionLimit(req: Request, res: Response, next: NextFunction) {
  if (process.env.FREE_LAUNCH === "true") return next();

  const generated = parseInt(req.headers["x-sections-generated"] as string ?? "0", 10);
  const limit      = req.planSections;

  if (isFinite(limit) && generated >= limit) {
    res.status(403).json({
      error:       "plan_limit_reached",
      message:     `Votre plan ${req.planId} permet ${limit} sections. Passez au plan supérieur pour continuer.`,
      planId:      req.planId,
      limit,
      generated,
    });
    return;
  }
  next();
}

// ─── Guard: reject if revision limit exceeded ─────────────────────────────────

export function guardRevisionLimit(req: Request, res: Response, next: NextFunction) {
  if (process.env.FREE_LAUNCH === "true") return next();

  const revisions = parseInt(req.headers["x-revision-count"] as string ?? "0", 10);
  const limit      = req.planRevisions;

  if (isFinite(limit) && revisions >= limit) {
    res.status(403).json({
      error:    "revision_limit_reached",
      message:  `Votre plan ${req.planId} permet ${limit} révisions. Passez au plan supérieur pour continuer.`,
      planId:   req.planId,
      limit,
      revisions,
    });
    return;
  }
  next();
}

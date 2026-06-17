// Server-side cost guard that holds EVEN during FREE_LAUNCH (unlike plan-guard,
// which bypasses everything and trusts spoofable frontend headers).
//
// Model: one UNIFIED daily revision budget per account, across all sections.
//  - A "revision" = regenerating or editing an already-generated section.
//  - First-time generation of a section does NOT count (building the report is free);
//    a generous hidden generation backstop still prevents report-farming.
//
// Tune without redeploy: FREE_DAILY_REVISIONS, FREE_DAILY_GENERATIONS.

const REVISION_CAP = parseInt(process.env.FREE_DAILY_REVISIONS ?? "15", 10) || 15;
const GEN_BACKSTOP = parseInt(process.env.FREE_DAILY_GENERATIONS ?? "40", 10) || 40;

interface DayBucket {
  day: string;        // YYYY-MM-DD
  revisions: number;
  generations: number;
}

const buckets = new Map<string, DayBucket>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function getBucket(key: string): DayBucket {
  const day = today();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.day !== day) buckets.delete(k);
  }
  let b = buckets.get(key);
  if (!b || b.day !== day) {
    b = { day, revisions: 0, generations: 0 };
    buckets.set(key, b);
  }
  return b;
}

export interface Usage {
  revisions: number;
  revisionLimit: number;
}

// Read-only: current revision usage for the counter shown in the UI.
export function getUsage(key: string): Usage {
  const b = getBucket(key);
  return { revisions: b.revisions, revisionLimit: REVISION_CAP };
}

export interface ActionResult extends Usage {
  ok: boolean;
  reason?: string;
}

// Record one action and report whether it's allowed.
// isRevision=true → counts against the visible 15/day revision budget.
// isRevision=false → first-time generation, only bounded by the hidden backstop.
export function recordAction(key: string, isRevision: boolean): ActionResult {
  const b = getBucket(key);

  if (isRevision) {
    if (b.revisions >= REVISION_CAP) {
      return {
        ok: false,
        revisions: b.revisions,
        revisionLimit: REVISION_CAP,
        reason: `Tu as utilisé tes ${REVISION_CAP} révisions du jour. Reviens demain — ou passe à un plan payant pour réviser sans limite.`,
      };
    }
    b.revisions += 1;
  } else {
    if (b.generations >= GEN_BACKSTOP) {
      return {
        ok: false,
        revisions: b.revisions,
        revisionLimit: REVISION_CAP,
        reason: `Limite quotidienne de génération atteinte. Reviens demain.`,
      };
    }
    b.generations += 1;
  }

  return { ok: true, revisions: b.revisions, revisionLimit: REVISION_CAP };
}

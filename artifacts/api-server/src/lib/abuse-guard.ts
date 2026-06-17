// Server-side cost guard that holds EVEN during FREE_LAUNCH (unlike plan-guard,
// which bypasses everything and trusts spoofable frontend headers).
//
// Two caps per account per day:
//  - PER_SECTION_CAP: how many times one section can be (re)generated → stops the
//    "loop Partie II 30×" attack, the #1 cost leak (expensive section + humanize).
//  - DAILY_TOTAL_CAP: total section generations/day → stops report-farming.
//
// A real student finishing a PFE never hits these; abusers hit the wall fast.
// Tune without redeploy via env: FREE_LAUNCH_SECTION_CAP, FREE_LAUNCH_DAILY_CAP.

const PER_SECTION_CAP = parseInt(process.env.FREE_LAUNCH_SECTION_CAP ?? "6", 10) || 6;
const DAILY_TOTAL_CAP = parseInt(process.env.FREE_LAUNCH_DAILY_CAP ?? "30", 10) || 30;

interface DayBucket {
  day: string;                 // YYYY-MM-DD
  sections: Map<string, number>;
}

const buckets = new Map<string, DayBucket>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface AbuseCheck {
  ok: boolean;
  reason?: string;
}

// Record one generation of `section` for `key` (clerkId or IP) and report whether
// it's allowed. Call this right before generating a section.
export function recordGeneration(key: string, section: string): AbuseCheck {
  const day = today();

  // Cheap periodic cleanup so the map can't grow unbounded.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.day !== day) buckets.delete(k);
  }

  let b = buckets.get(key);
  if (!b || b.day !== day) {
    b = { day, sections: new Map() };
    buckets.set(key, b);
  }

  const total = [...b.sections.values()].reduce((a, c) => a + c, 0);
  if (total >= DAILY_TOTAL_CAP) {
    return {
      ok: false,
      reason: `Tu as atteint la limite de ${DAILY_TOTAL_CAP} générations pour aujourd'hui. Reviens demain — ou passe à un plan payant pour générer sans limite.`,
    };
  }

  const secCount = b.sections.get(section) ?? 0;
  if (secCount >= PER_SECTION_CAP) {
    return {
      ok: false,
      reason: `Tu as régénéré cette section ${PER_SECTION_CAP} fois aujourd'hui. Limite atteinte pour préserver la qualité du service. Réessaie demain.`,
    };
  }

  b.sections.set(section, secCount + 1);
  return { ok: true };
}

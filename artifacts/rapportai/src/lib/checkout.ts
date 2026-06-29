import { type PlanId, getMyPlan } from "@/lib/userPlan";
import { API_BASE } from "@/lib/apiBase";
import { getReport } from "@/lib/reportStore";

/**
 * Start a Stripe checkout and redirect to the hosted payment page.
 *
 * `reportId` defaults to the current agent session id so the purchase unlocks
 * the report the user is actually working on (and the backend can charge only
 * the upgrade difference against that report's already-paid plan). The backend
 * is authoritative on price — this just names the target plan.
 */
export async function startCheckout(opts: {
  plan:       PlanId;
  reportId?:  string;
  userEmail?: string;
  clerkId?:   string;
}): Promise<void> {
  if (opts.plan === "free") return;

  const reportId = opts.reportId ?? getReport().sessionId ?? crypto.randomUUID();

  const res = await fetch(`${API_BASE}/api/payments/checkout`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...(opts.clerkId ? { "x-clerk-id": opts.clerkId } : {}),
    },
    body: JSON.stringify({
      plan:         opts.plan,
      report_id:    reportId,
      user_email:   opts.userEmail,
      current_plan: getMyPlan().planId,   // so the backend charges the upgrade difference
    }),
  });

  const data = await res.json() as { checkout_url?: string; error?: string };
  if (!res.ok || !data.checkout_url) throw new Error(data.error ?? "Erreur de paiement");
  window.location.href = data.checkout_url;
}

import { create } from "zustand";
import type { PlanId } from "@/lib/userPlan";

const RETURN_PATH_KEY = "rapportai_paywall_return";

interface PaywallState {
  open:        boolean;
  limitType:   "pages" | "revisions" | null;
  currentPlan: PlanId;
  // "limit" = a cap was truly hit (show the limit-framed upsell). "upgrade" = the user chose to
  // upgrade voluntarily (e.g. "Améliorer mon plan") → show neutral plan cards with the difference.
  intent:      "limit" | "upgrade";
  trigger:     (limitType: "pages" | "revisions", currentPlan: PlanId, intent?: "limit" | "upgrade") => void;
  close:       () => void;
}

export const usePaywallStore = create<PaywallState>((set) => ({
  open:        false,
  limitType:   null,
  currentPlan: "free",
  intent:      "limit",
  trigger: (limitType, currentPlan, intent = "limit") => {
    // Save current path so PaymentSuccessPage can redirect back here after payment
    try { sessionStorage.setItem(RETURN_PATH_KEY, window.location.pathname); } catch {}
    set({ open: true, limitType, currentPlan, intent });
  },
  close: () => set({ open: false, limitType: null }),
}));

/** Read and clear the stored return path (called once from PaymentSuccessPage) */
export function consumeReturnPath(): string {
  try {
    const path = sessionStorage.getItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(RETURN_PATH_KEY);
    return path ?? "/dashboard";
  } catch {
    return "/dashboard";
  }
}

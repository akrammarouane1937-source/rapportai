import { create } from "zustand";
import type { PlanId } from "@/lib/userPlan";

const RETURN_PATH_KEY = "rapportai_paywall_return";

interface PaywallState {
  open:        boolean;
  limitType:   "pages" | "revisions" | null;
  currentPlan: PlanId;
  trigger:     (limitType: "pages" | "revisions", currentPlan: PlanId) => void;
  close:       () => void;
}

export const usePaywallStore = create<PaywallState>((set) => ({
  open:        false,
  limitType:   null,
  currentPlan: "free",
  trigger: (limitType, currentPlan) => {
    // Save current path so PaymentSuccessPage can redirect back here after payment
    try { sessionStorage.setItem(RETURN_PATH_KEY, window.location.pathname); } catch {}
    set({ open: true, limitType, currentPlan });
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

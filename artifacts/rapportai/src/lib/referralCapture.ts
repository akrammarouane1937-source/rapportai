// Referral code capture.
//
// A referred user lands on /sign-up?ref=CODE, but Clerk's hosted sign-up flow
// strips query params during its redirect dance, so by the time the user reaches
// /onboarding the ?ref= is gone. We therefore capture it as early as possible
// (at app boot) and persist it to localStorage, then read it back at register.

const REF_KEY = "rapportai_ref_code";

/** Capture ?ref= from the current URL into localStorage (call once at boot). */
export function captureRefFromUrl(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && ref.trim()) localStorage.setItem(REF_KEY, ref.trim());
  } catch { /* private mode / quota — non-fatal */ }
}

/** The referral code to register with — URL param wins, else the stored value. */
export function getStoredRef(): string | undefined {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("ref");
    if (fromUrl && fromUrl.trim()) return fromUrl.trim();
    const stored = localStorage.getItem(REF_KEY);
    return stored && stored.trim() ? stored.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** Clear the stored code once it has been consumed at registration. */
export function clearStoredRef(): void {
  try { localStorage.removeItem(REF_KEY); } catch { /* non-fatal */ }
}

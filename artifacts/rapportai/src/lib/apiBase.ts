// On Vercel: set VITE_API_URL to the Render backend URL.
// On Replit: leave unset — falls back to BASE_URL (same host proxy).
export const API_BASE = (
  (import.meta.env.VITE_API_URL as string | undefined) ??
  (import.meta.env.BASE_URL as string)
).replace(/\/$/, "");

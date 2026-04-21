/**
 * Per-tab auth storage.
 *
 * Auth tokens live in `sessionStorage` so each browser tab has its own
 * session. This lets testers sign in as different users (e.g. rider + 5
 * drivers) in different tabs of the same browser without the tabs stomping
 * on each other's tokens the way `localStorage` used to.
 *
 * Trade-off: closing the tab ends the session. Refreshing the tab keeps it.
 * For a long-lived "remember me" experience, migrate the same keys to
 * `localStorage` — but then you lose per-tab isolation.
 */

const AUTH_KEYS = ["token", "refresh_token", "user"] as const;
type AuthKey = (typeof AUTH_KEYS)[number];

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function getAuth(key: AuthKey): string | null {
  return storage()?.getItem(key) ?? null;
}

export function setAuth(key: AuthKey, value: string): void {
  storage()?.setItem(key, value);
}

export function removeAuth(key: AuthKey): void {
  storage()?.removeItem(key);
}

export function clearAuth(): void {
  const s = storage();
  if (!s) return;
  for (const k of AUTH_KEYS) s.removeItem(k);
}

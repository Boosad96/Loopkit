"use client";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
const key = "loopkit.analytics.preference";
const cookie = "lk_visitor";
function enabled() {
  try {
    return (
      localStorage.getItem(key) === "allow" &&
      !navigator.globalPrivacyControl &&
      navigator.doNotTrack !== "1"
    );
  } catch {
    return false;
  }
}
declare global {
  interface Navigator {
    readonly globalPrivacyControl?: boolean;
  }
}
export function track(event: string, slug?: string) {
  if (!enabled()) return;
  if (!document.cookie.split("; ").some((v) => v.startsWith(cookie + "=")))
    document.cookie =
      cookie +
      "=" +
      crypto.randomUUID() +
      "; Path=/; SameSite=Lax; Max-Age=7776000" +
      (location.protocol === "https:" ? "; Secure" : "");
  void fetch("/api/account/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, slug }),
    keepalive: true,
  }).catch(() => {});
}
function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("loopkit-preferences", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("loopkit-preferences", listener);
  };
}
export function AnalyticsPreferences() {
  const allowed = useSyncExternalStore(subscribe, enabled, () => false);
  return (
    <section>
      <h2>Usage analytics</h2>
      <p>
        Allow anonymous usage measurement on this browser. You can change this
        preference at any time.
      </p>
      <label>
        <input
          type="checkbox"
          checked={allowed}
          onChange={(event) => {
            const value = event.target.checked;
            try {
              localStorage.setItem(key, value ? "allow" : "deny");
            } catch {
              return;
            }
            if (!value)
              document.cookie = cookie + "=; Path=/; Max-Age=0; SameSite=Lax";
            window.dispatchEvent(new Event("loopkit-preferences"));
          }}
        />{" "}
        Allow usage measurement
      </label>
    </section>
  );
}
export function AnalyticsObserver() {
  const path = usePathname();
  useEffect(() => {
    if (
      !path ||
      /^\/(auth|login|register|admin|dashboard|api|embed)(\/|$)/.test(path)
    )
      return;
    track("page_view");
    if (/^\/s\/[a-f0-9]{24}$/.test(path))
      track("shared_visit", path.split("/")[2]);
    if (/^\/tools\/[a-z-]+$/.test(path)) track("tool_view");
  }, [path]);
  return null;
}

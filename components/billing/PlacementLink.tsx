"use client";
import { useEffect, useRef } from "react";
export function PlacementLink({ id, href }: { id: string; href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  function record(kind: "view" | "click") {
    void fetch("/api/billing/metric", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, kind }),
      keepalive: true,
    }).catch(() => {});
  }
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          record("view");
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <a
      ref={ref}
      href={href}
      rel="sponsored ugc nofollow"
      onClick={() => record("click")}
    >
      View community
    </a>
  );
}

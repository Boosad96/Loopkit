"use client";
import { useEffect, useState } from "react";
import { type View } from "@/lib/projects/model";
import ProjectEditor from "./ProjectEditor";
async function fetchManaged(
  slug: string,
  token: string,
  signal?: AbortSignal,
): Promise<View> {
  const r = await fetch("/api/projects/" + slug + "?manage=1", {
    cache: "no-store",
    headers: token ? { Authorization: "Bearer " + token } : {},
    signal,
  });
  const result = await r.json();
  if (!r.ok) throw Error(result.error);
  if (token) {
    try {
      sessionStorage.setItem("lk-manage:" + slug, token);
    } catch {}
  }
  return result;
}
export default function ManageProject({ slug }: { slug: string }) {
  const [key, setKey] = useState(""),
    [message, setMessage] = useState("Checking organizer access…"),
    [view, setView] = useState<View | null>(null);
  useEffect(() => {
    let token = "";
    try {
      token = sessionStorage.getItem("lk-manage:" + slug) ?? "";
    } catch {}
    const ctrl = new AbortController();
    void fetchManaged(slug, token, ctrl.signal)
      .then(setView)
      .catch((e) => {
        if (!ctrl.signal.aborted) setMessage(e.message);
      });
    return () => ctrl.abort();
  }, [slug]);
  if (view)
    return <ProjectEditor slug={view.kind} existing={view} mode="edit" />;
  return (
    <form
      className="project-controls"
      onSubmit={(e) => {
        e.preventDefault();
        void fetchManaged(slug, key)
          .then(setView)
          .catch((e) => setMessage(e.message));
      }}
    >
      <p role="status">{message}</p>
      <label>
        Private management key
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
      </label>
      <button>Open organizer editor</button>
    </form>
  );
}

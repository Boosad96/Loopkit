"use client";

import { useState, useSyncExternalStore } from "react";

const subscribe = () => () => {};
const browserOrigin = () => location.origin;
const serverOrigin = () => "";

export default function ToolDistribution({ slug, name, embeddable }: {
  slug: string; name: string; embeddable: boolean;
}) {
  const origin = useSyncExternalStore(subscribe, browserOrigin, serverOrigin);
  const [attribution, setAttribution] = useState(false);
  const [message, setMessage] = useState("");
  if (!origin) return null;

  const url = origin + "/tools/" + slug;
  const widget = origin + "/embed/tool/" + slug + (attribution ? "?attribution=1" : "");
  const code = `<iframe src="${widget}" title="LoopKit tool" width="100%" height="680" loading="lazy" sandbox="allow-scripts allow-same-origin allow-downloads${attribution ? " allow-popups allow-popups-to-escape-sandbox" : ""}" allow="clipboard-write" referrerpolicy="no-referrer"></iframe>`;
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
    } catch {
      setMessage("Select the field to copy it manually.");
    }
  }
  return (
    <details className="tool-guide">
      <summary>{embeddable ? "Share or embed this tool" : "Share this tool"}</summary>
      <div className="lk-tool-distribution">
        <label>Tool link<input readOnly value={url} onFocus={(event) => event.target.select()} /></label>
        <button type="button" onClick={() => copy(url)}>Copy tool link</button>
        {typeof navigator.share === "function" && (
          <button type="button" onClick={() => {
            void navigator.share({ title: name, url }).catch(() => setMessage("Sharing closed."));
          }}>Share via device</button>
        )}
        {embeddable && (
          <>
            <label><input type="checkbox" checked={attribution} onChange={(event) => setAttribution(event.target.checked)} /> Include Made with LoopKit attribution</label>
            <label>Embed code<textarea readOnly value={code} onFocus={(event) => event.target.select()} /></label>
            <button type="button" onClick={() => copy(code)}>Copy embed code</button>
          </>
        )}
        <p role="status">{message}</p>
      </div>
    </details>
  );
}

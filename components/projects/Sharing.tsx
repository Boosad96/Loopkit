"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { track } from "@/components/account/Analytics";
import Image from "next/image";
import QRCode from "qrcode";
import { slugPattern, type Kind } from "@/lib/projects/model";
const subscribe = () => () => {};
export default function Sharing({
  slug,
  title,
  kind,
}: {
  slug: string;
  title: string;
  kind: Kind;
}) {
  const origin = useSyncExternalStore(
    subscribe,
    () => location.origin,
    () => "",
  );
  const [qr, setQr] = useState(""),
    [message, setMessage] = useState(""),
    [theme, setTheme] = useState("midnight"),
    [embed, setEmbed] = useState(false);
  const url = origin + "/s/" + slug,
    canEmbed = [
      "goal-tracker",
      "leaderboard-maker",
      "countdown-maker",
      "poll-maker",
      "community-event-page-maker",
    ].includes(kind);
  useEffect(() => {
    let active = true;
    if (origin)
      QRCode.toDataURL(url, { width: 160, margin: 2 })
        .then((v) => {
          if (active) setQr(v);
        })
        .catch(() => {
          if (active) setMessage("QR creation failed.");
        });
    return () => {
      active = false;
    };
  }, [origin, url]);
  if (!origin || !slugPattern.test(slug)) return null;
  const code =
    '<iframe src="' +
    origin +
    "/embed/" +
    slug +
    "?theme=" +
    theme +
    '" title="Community widget" style="width:100%;height:430px;border:0" loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Copied to clipboard.");
      track("share", slug);
    } catch {
      setMessage("Select the text below and copy it manually.");
    }
  }
  return (
    <details className="project-share">
      <summary>Share this project</summary>
      <div className="project-share-body">
        <label>
          Public link
          <input value={url} readOnly onFocus={(e) => e.target.select()} />
        </label>
        <div className="project-actions">
          <button onClick={() => copy(url)}>Copy link</button>
          {typeof navigator.share === "function" && (
            <button
              onClick={() =>
                navigator
                  .share({ url, title })
                  .then(() => track("share", slug))
                  .catch(() => setMessage("Sharing closed."))
              }
            >
              Share via device
            </button>
          )}
          {Object.entries({
            Telegram: "https://t.me/share/url?url=" + encodeURIComponent(url),
            WhatsApp:
              "https://wa.me/?text=" + encodeURIComponent(title + " " + url),
            X: "https://x.com/intent/post?url=" + encodeURIComponent(url),
          }).map(([name, href]) => (
            <a
              key={name}
              href={href}
              onClick={() => track("share", slug)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {name}
            </a>
          ))}
        </div>
        {qr && (
          <Image
            unoptimized
            src={qr}
            alt="Scan the code to open this project"
            width={160}
            height={160}
          />
        )}
        {canEmbed && (
          <>
            <button onClick={() => setEmbed(!embed)} aria-expanded={embed}>
              Embed widget
            </button>
            {embed && (
              <>
                <label>
                  Widget theme
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value)}
                  >
                    <option>midnight</option>
                    <option>paper</option>
                    <option>forest</option>
                  </select>
                </label>
                <textarea readOnly aria-label="Embed code" value={code} />
                <button onClick={() => copy(code)}>Copy embed code</button>
                <iframe
                  src={"/embed/" + slug + "?theme=" + theme}
                  title="Widget preview"
                  loading="lazy"
                  style={{ width: "100%", height: 350, border: 0 }}
                />
              </>
            )}
          </>
        )}
        <p role="status">{message}</p>
      </div>
    </details>
  );
}

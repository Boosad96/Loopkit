"use client";
import { track } from "@/components/account/Analytics";
import Image from "next/image";
import { useState } from "react";
import { Copy } from "./common";

export default function Share({
  data,
  title,
}: {
  data: Record<string, string>;
  title: string;
}) {
  const [url, setUrl] = useState(""),
    [qr, setQr] = useState(""),
    [status, setStatus] = useState("");
  async function prepare() {
    const generated = new URL(location.href);
    generated.search = "";
    generated.hash = new URLSearchParams(data).toString();
    setUrl(generated.href);
    setQr("");
    setStatus("");
    try {
      const { toDataURL } = await import("qrcode");
      setQr(
        await toDataURL(generated.href, {
          width: 240,
          margin: 4,
          errorCorrectionLevel: "L",
        }),
      );
    } catch {
      setStatus(
        "This configuration is too large for a QR code. Use the link instead.",
      );
    }
  }
  return (
    <details>
      <summary>Share configuration</summary>
      <p>
        Anyone with this link can read and remix the entries. Review names
        before sharing. The configuration is stored in the link fragment.
      </p>
      <button onClick={() => void prepare()}>Create configuration link</button>
      {url && (
        <>
          <label>
            Share link
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <Copy value={url} label="Copy link" event="share" />{" "}
          {typeof navigator.share === "function" && (
            <button
              onClick={async () => {
                try {
                  await navigator.share({ url, title });
                  track("share");
                } catch (e) {
                  if ((e as Error).name !== "AbortError")
                    setStatus("Sharing unavailable. Copy the link instead.");
                }
              }}
            >
              Share via device
            </button>
          )}
          <div className="lk-share-links">
            {[
              ["Telegram", "https://t.me/share/url?url="],
              ["WhatsApp", "https://wa.me/?text="],
              ["X", "https://twitter.com/intent/tweet?url="],
            ].map(([label, base]) => (
              <a
                key={label}
                href={base + encodeURIComponent(url)}
                onClick={() => track("share")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label}
              </a>
            ))}
          </div>
          {qr && (
            <Image
              unoptimized
              alt="Configuration QR code"
              src={qr}
              width={240}
              height={240}
            />
          )}
        </>
      )}
      <p role="status">{status}</p>
    </details>
  );
}

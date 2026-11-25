"use client";
import { useEffect, useRef, useState } from "react";
import { canvasBlob, downloadBlob, imageLimits, readImage } from "./common";
import { stickerSize } from "./algorithms";

function useBitmap() {
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const serial = useRef(0);
  useEffect(
    () => () => {
      serial.current++;
    },
    [],
  );
  useEffect(
    () => () => {
      bitmap?.close();
    },
    [bitmap],
  );
  async function select(file?: File) {
    const id = ++serial.current;
    setError("");
    setPending(Boolean(file));
    setBitmap(null);
    if (!file) return;
    try {
      const next = await readImage(file);
      if (id === serial.current) setBitmap(next);
      else next.close();
    } catch (e) {
      if (id === serial.current) setError((e as Error).message);
    } finally {
      if (id === serial.current) setPending(false);
    }
  }
  return { bitmap, error, pending, select };
}
export function Resizer({ sticker }: { sticker: boolean }) {
  const { bitmap, error, pending, select } = useBitmap();
  const canvas = useRef<HTMLCanvasElement>(null),
    [format, setFormat] = useState("image/png"),
    [zoom, setZoom] = useState(1),
    [horizontal, setHorizontal] = useState(50),
    [vertical, setVertical] = useState(50),
    [quality, setQuality] = useState(0.85);
  const settings = [format, quality, horizontal, vertical, zoom, sticker].join(
    "/",
  );
  const [encoded, setEncoded] = useState<{
    blob: Blob;
    bitmap: ImageBitmap;
    settings: string;
    width: number;
    height: number;
  } | null>(null);
  const result =
    encoded?.bitmap === bitmap && encoded?.settings === settings
      ? encoded.blob
      : null;
  const [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    const c = canvas.current;
    if (!bitmap || !c) return;
    const size = sticker
      ? stickerSize(bitmap.width, bitmap.height, imageLimits.stickerEdge)
      : [imageLimits.emojiEdge, imageLimits.emojiEdge];
    c.width = size[0];
    c.height = size[1];
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    if (sticker) {
      ctx.drawImage(bitmap, 0, 0, c.width, c.height);
    } else {
      const crop = Math.min(bitmap.width, bitmap.height) / zoom;
      ctx.drawImage(
        bitmap,
        ((bitmap.width - crop) * horizontal) / 100,
        ((bitmap.height - crop) * vertical) / 100,
        crop,
        crop,
        0,
        0,
        c.width,
        c.height,
      );
    }
    canvasBlob(c, format, quality)
      .then((b) => {
        if (active) {
          setEncoded({
            blob: b,
            bitmap,
            settings,
            width: c.width,
            height: c.height,
          });
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [bitmap, format, horizontal, quality, sticker, vertical, zoom, settings]);
  const max = sticker ? imageLimits.stickerBytes : imageLimits.emojiBytes;
  return (
    <section>
      <label>
        Source image
        <input
          type="file"
          accept="image/png,image/webp,image/jpeg"
          onChange={(e) => void select(e.target.files?.[0])}
        />
      </label>
      <p>
        Choose a static PNG, JPEG or WebP. Your image stays in this browser.
      </p>
      <p role="alert">{error}</p>
      {bitmap && (
        <>
          {!sticker && (
            <fieldset>
              <legend>Square crop</legend>
              {[
                ["Zoom", zoom, setZoom, 1, 4, 0.05],
                ["Horizontal position", horizontal, setHorizontal, 0, 100, 1],
                ["Vertical position", vertical, setVertical, 0, 100, 1],
              ].map(([label, value, set, min, max, step]) => (
                <label key={String(label)}>
                  {String(label)}
                  <input
                    type="range"
                    value={Number(value)}
                    min={Number(min)}
                    max={Number(max)}
                    step={Number(step)}
                    onChange={(e) =>
                      (set as (n: number) => void)(e.target.valueAsNumber)
                    }
                  />
                </label>
              ))}
            </fieldset>
          )}
          <label>
            Output format
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="image/png">PNG (lossless)</option>
              <option value="image/webp">WebP (adjustable compression)</option>
            </select>
          </label>
          {format === "image/webp" && (
            <label>
              Quality {Math.round(quality * 100)}%
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={quality}
                onChange={(e) => setQuality(e.target.valueAsNumber)}
              />
            </label>
          )}
          <canvas
            className="lk-output"
            aria-label="Resized image preview"
            ref={canvas}
          />
        </>
      )}
      <p role="status">
        {pending ? "Reading image…" : message}
        {result &&
          encoded &&
          encoded.width +
            " × " +
            encoded.height +
            " px · " +
            (result.size / 1024).toFixed(1) +
            " KiB"}{" "}
        {result &&
          result.size > max &&
          "Output exceeds the platform limit. Select WebP and reduce quality."}
      </p>
      <button
        disabled={!bitmap || !result || result.size > max}
        onClick={() => {
          if (result)
            downloadBlob(
              result,
              (sticker ? "sticker" : "emoji") +
                (format === "image/png" ? ".png" : ".webp"),
            );
        }}
      >
        Download image
      </button>
      <p>
        {sticker
          ? "Static stickers have one 512 px edge. Maximum file size is 512 KiB."
          : "Square emoji export at 128 × 128 px. Maximum file size is 256 KiB."}{" "}
        <a
          href={
            sticker
              ? "https://core.telegram.org/import-stickers"
              : "https://docs.discord.com/developers/resources/emoji"
          }
        >
          Platform specifications
        </a>
      </p>
    </section>
  );
}
export function Profile() {
  const { bitmap, error, pending, select } = useBitmap(),
    canvas = useRef<HTMLCanvasElement>(null);
  const [username, setUsername] = useState("Player One"),
    [game, setGame] = useState(""),
    [rank, setRank] = useState(""),
    [bio, setBio] = useState(""),
    [theme, setTheme] = useState("Lime"),
    [outputError, setOutputError] = useState("");
  const accents: Record<string, string> = {
    Lime: "#a3e635",
    Ice: "#67e8f9",
    Violet: "#c4b5fd",
  };
  const accent = accents[theme];
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, 960, 520);
    ctx.fillStyle = "#171f2b";
    ctx.fillRect(24, 24, 912, 472);
    ctx.fillStyle = accent;
    ctx.fillRect(24, 24, 8, 472);
    ctx.fillStyle = accent;
    ctx.font = "bold 19px sans-serif";
    ctx.fillText("GAMING PROFILE", 64, 81);
    ctx.save();
    ctx.beginPath();
    ctx.arc(141, 203, 70, 0, Math.PI * 2);
    ctx.clip();
    if (bitmap) {
      const side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        71,
        133,
        140,
        140,
      );
    } else {
      ctx.fillStyle = accent;
      ctx.fillRect(71, 133, 140, 140);
      ctx.fillStyle = "#0c1017";
      ctx.font = "bold 50px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(username.slice(0, 2).toUpperCase(), 141, 222, 110);
    }
    ctx.restore();
    ctx.fillStyle = "#f8fafc";
    ctx.font = "bold 56px sans-serif";
    ctx.fillText(username, 245, 194, 640);
    ctx.fillStyle = accent;
    ctx.font = "28px sans-serif";
    ctx.fillText([game, rank].filter(Boolean).join("  /  "), 245, 244, 640);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "27px sans-serif";
    let line = "",
      y = 350;
    for (const word of bio.split(/\s+/)) {
      if (ctx.measureText(line + " " + word).width > 810 && line) {
        ctx.fillText(line, 65, y, 810);
        line = "";
        y += 37;
      }
      line += (line ? " " : "") + word;
    }
    ctx.fillText(line, 65, y, 810);
  }, [accent, bio, bitmap, game, rank, username]);
  return (
    <section>
      <label>
        Username
        <input
          value={username}
          maxLength={32}
          onChange={(e) => setUsername(e.target.value)}
        />
      </label>
      <label>
        Avatar
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void select(e.target.files?.[0])}
        />
      </label>
      <label>
        Favorite game
        <input
          value={game}
          maxLength={50}
          onChange={(e) => setGame(e.target.value)}
        />
      </label>
      <label>
        Rank
        <input
          value={rank}
          maxLength={40}
          onChange={(e) => setRank(e.target.value)}
        />
      </label>
      <label>
        Biography
        <textarea
          value={bio}
          maxLength={140}
          onChange={(e) => setBio(e.target.value)}
        />
      </label>
      <label>
        Theme
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          {Object.keys(accents).map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <canvas
        className="lk-profile"
        ref={canvas}
        width={960}
        height={520}
        aria-label={"Gaming profile for " + username}
      />
      <button
        disabled={!username.trim() || pending}
        onClick={async () => {
          try {
            if (canvas.current)
              downloadBlob(
                await canvasBlob(canvas.current),
                "gaming-profile.png",
              );
          } catch (e) {
            setOutputError((e as Error).message);
          }
        }}
      >
        Download profile PNG
      </button>
      <p role="alert">{error || outputError}</p>
    </section>
  );
}

"use client";
import { useState } from "react";
export default function LogoField({ initial }: { initial?: string }) {
  const [data, setData] = useState(initial || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <>
      <input name="logo" type="hidden" value={data} />
      <label>
        Community logo{" "}
        <small>
          Optional PNG or JPEG, up to 1 MB. Resized locally to 96 pixels.
        </small>
        <input
          type="file"
          accept="image/png,image/jpeg"
          disabled={busy}
          onChange={async (event) => {
            const file = event.currentTarget.files?.[0];
            if (!file) return;
            setError("");
            if (
              file.size > 1024 * 1024 ||
              !["image/png", "image/jpeg"].includes(file.type)
            ) {
              setError("Choose a PNG or JPEG smaller than 1 MB.");
              return;
            }
            setBusy(true);
            try {
              const image = await createImageBitmap(file, {
                resizeHeight: 96,
                resizeQuality: "high",
              });
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 96;
              const ctx = canvas.getContext("2d");
              if (!ctx) throw Error();
              const ratio = Math.min(96 / image.width, 96 / image.height);
              ctx.drawImage(
                image,
                (96 - image.width * ratio) / 2,
                (96 - image.height * ratio) / 2,
                image.width * ratio,
                image.height * ratio,
              );
              image.close();
              setData(canvas.toDataURL("image/png"));
            } catch {
              setError("This image could not be opened.");
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      {busy && <p role="status">Preparing logo…</p>}
      {error && <p role="alert">{error}</p>}
      {data && (
        <button type="button" onClick={() => setData("")}>
          Remove logo
        </button>
      )}
    </>
  );
}

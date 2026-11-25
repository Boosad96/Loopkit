"use client";
import { imageDimensions } from "./image-header";
import { track } from "@/components/account/Analytics";
import { useState } from "react";

export function downloadBlob(data: Blob, name: string, completion = true) {
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  if (completion) track("tool_complete");
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function Copy({
  value,
  label = "Copy",
  event = "tool_complete",
}: {
  value: string;
  label?: string;
  event?: "share" | "tool_complete" | null;
}) {
  const [message, setMessage] = useState("");
  return (
    <span>
      <button
        type="button"
        disabled={!value}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage("Copied.");
            if (event) track(event);
          } catch {
            setMessage(
              "Clipboard unavailable. Select and copy the text manually.",
            );
          }
        }}
      >
        {label}
      </button>{" "}
      <small role="status">{message}</small>
    </span>
  );
}
export function canvasBlob(
  canvas: HTMLCanvasElement,
  type = "image/png",
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob && blob.type === type
          ? resolve(blob)
          : reject(
              new Error("This browser could not export that image format."),
            ),
      type,
      quality,
    ),
  );
}
export const imageLimits = {
  uploadBytes: 8 * 1024 * 1024,
  inputPixels: 16_000_000,
  emojiEdge: 128,
  emojiBytes: 256 * 1024,
  stickerEdge: 512,
  stickerBytes: 512 * 1024,
};
export async function readImage(file: File): Promise<ImageBitmap> {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > imageLimits.uploadBytes
  )
    throw new Error("Choose a PNG, JPEG or WebP under 8 MiB.");
  const dimensions = imageDimensions(
    new DataView(await file.arrayBuffer()),
    file.type,
  );
  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.width * dimensions.height > imageLimits.inputPixels
  )
    throw new Error("Choose an image under 16 megapixels.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > imageLimits.inputPixels) {
    bitmap.close();
    throw new Error("Choose an image under 16 megapixels.");
  }
  return bitmap;
}

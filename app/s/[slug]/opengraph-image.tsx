import { ImageResponse } from "next/og";
import { getView } from "@/lib/projects/server";
import { labels } from "@/lib/projects/model";
import { brand } from "@/lib/brand";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const dynamic = "force-dynamic";
export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const v = await getView((await params).slug).catch(() => null);
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        background: "#101821",
        color: "#f8fafc",
        padding: 70,
        fontSize: 36,
      }}
    >
      <span style={{ color: "#a3e635" }}>{brand.name}</span>
      <strong style={{ fontSize: 68 }}>
        {v?.config.title ?? "Community project"}
      </strong>
      <span>{v ? labels[v.kind] : brand.tagline}</span>
    </div>,
    size,
  );
}

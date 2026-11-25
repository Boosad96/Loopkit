import { toolPolicies } from "@/lib/account/tools";
import ToolDirectory from "./tool-directory";
import type { Metadata } from "next";
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}): Promise<Metadata> {
  return {
    title: "Free community tools",
    description:
      "Find tools for community events, creative projects and friendly competition.",
    alternates: { canonical: "/tools" },
    robots: Object.keys(await searchParams).length
      ? { index: false, follow: true }
      : undefined,
  };
}
export default async function Directory({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const policy = await toolPolicies();
  return (
    <ToolDirectory
      hidden={Object.keys(policy).filter((k) => !policy[k].available)}
      initial={(await searchParams).q || ""}
    />
  );
}

import { requireRole } from "@/lib/account/server";
import type { ReactNode } from "react";
import { privateMetadata } from "@/components/account/ui";
export const metadata = { ...privateMetadata, title: "Administration" };
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: ReactNode }) {
  await requireRole(["moderator", "admin"]);
  return children;
}

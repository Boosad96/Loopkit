import { requireUser } from "@/lib/account/server";
import { privateMetadata } from "@/components/account/ui";
import type { ReactNode } from "react";
export const metadata = { ...privateMetadata, title: "Your workspace" };
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: ReactNode }) {
  await requireUser();
  return children;
}

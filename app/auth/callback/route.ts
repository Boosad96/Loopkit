import { NextResponse } from "next/server";
import { userClient } from "@/lib/account/server";
import { safeNext } from "@/lib/account/validation";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = await userClient();
  const code = url.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || url.origin;
  if (code && db) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(safeNext(url.searchParams.get("next")), origin),
      );
  }
  return NextResponse.redirect(new URL("/login?notice=expired", origin));
}

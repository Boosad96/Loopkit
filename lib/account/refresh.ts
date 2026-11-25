import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

export async function refreshSession(
  request: NextRequest,
  response: NextResponse,
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (
    !url ||
    !key ||
    !request.cookies.getAll().some((cookie) => cookie.name.startsWith("sb-"))
  )
    return response;
  const client = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") === true,
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, cacheHeaders) => {
        for (const { name, value, options } of values) {
          request.cookies.set(name, value);
          response.cookies.set(name, value, options);
        }
        // Next forwards request-header overrides to the route after middleware.
        // Include freshly rotated credentials on this request as well as the next.
        response.headers.set(
          "x-middleware-request-cookie",
          request.cookies.toString(),
        );
        const forwarded = new Set(
          (response.headers.get("x-middleware-override-headers") || "")
            .split(",")
            .filter(Boolean),
        );
        forwarded.add("cookie");
        response.headers.set(
          "x-middleware-override-headers",
          [...forwarded].join(","),
        );
        for (const [key, value] of Object.entries(cacheHeaders || {}))
          response.headers.set(key, value);
      },
    },
  });
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

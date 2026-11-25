import "server-only";
import { cache } from "react";
import { serviceClient } from "./server";
export type ToolPolicy = { available: boolean; indexable: boolean };
export const toolPolicies = cache(
  async (): Promise<Record<string, ToolPolicy>> => {
    if (
      !process.env.SUPABASE_SERVICE_ROLE_KEY ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL
    )
      return {};
    const { data, error } = await serviceClient()
      .from("site_settings")
      .select("key,value")
      .like("key", "tool.%")
      .limit(64);
    if (error) throw Error("Cannot load tool availability settings.");
    return Object.fromEntries(
      (data || []).map((row) => [
        row.key.slice(5),
        {
          available: row.value.available !== false,
          indexable: row.value.indexable !== false,
        },
      ]),
    );
  },
);

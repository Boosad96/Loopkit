import { notFound } from "next/navigation";
import { z } from "zod";
import {
  Page,
  styles,
  Notice,
  type Query,
  privateMetadata,
  one,
} from "@/components/account/ui";
import Challenge from "@/components/account/Challenge";
import LogoField from "@/components/account/LogoField";
import { requireUser, userClient } from "@/lib/account/server";
import { categories, platformNames } from "@/lib/account/validation";
import { saveListing } from "@/lib/account/listing-actions";
export const metadata = { ...privateMetadata, title: "Submit a community" };
export default async function Screen({
  searchParams,
}: {
  searchParams: Query;
}) {
  const user = await requireUser();
  const q = await searchParams;
  const edit = one(q.edit);
  const db = await userClient();
  if (edit && !z.uuid().safeParse(edit).success) notFound();
  const row = edit
    ? (
        await db!
          .from("community_listings")
          .select("*")
          .eq("id", edit)
          .eq("owner_id", user.id)
          .maybeSingle()
      ).data
    : null;
  if (edit && !row) notFound();
  return (
    <Page
      title={edit ? "Edit community listing" : "Submit your community"}
      intro="A moderator reviews each submission and updated listing before it appears in discovery."
    >
      <Notice code={one(q.notice)} />
      <form className={styles.form} action={saveListing}>
        <input type="hidden" name="id" value={edit} />
        <label>
          Community name
          <input
            name="name"
            defaultValue={row?.name}
            minLength={3}
            maxLength={80}
            required
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            defaultValue={row?.description}
            minLength={30}
            maxLength={1800}
            required
          />
          <small>
            Describe who the community is for and what members do together.
          </small>
        </label>
        <label>
          Platform
          <select name="platform" defaultValue={row?.platform}>
            {Object.entries(platformNames).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label>
          Official community link
          <input
            type="url"
            name="link"
            defaultValue={row?.official_link}
            placeholder="https://discord.gg/yourcommunity"
            maxLength={250}
            required
          />
          <small>
            Use an official discord.gg, discord.com/invite or t.me link.
          </small>
        </label>
        <label>
          Category
          <select name="category" defaultValue={row?.category}>
            {categories.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Language
          <input
            name="language"
            defaultValue={row?.language || "English"}
            maxLength={40}
            required
          />
        </label>
        <label>
          Tags
          <input
            name="tags"
            defaultValue={row?.tags?.join(", ")}
            maxLength={154}
          />
          <small>Up to six comma-separated tags.</small>
        </label>
        <LogoField initial={row?.logo_path || ""} />
        <Challenge action="listing" />
        <button>Submit for review</button>
      </form>
    </Page>
  );
}

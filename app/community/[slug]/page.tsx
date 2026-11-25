import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Challenge from "@/components/account/Challenge";
import {
  Notice,
  Page,
  styles,
  privateMetadata,
  one,
  type Query,
} from "@/components/account/ui";
import { currentUser, userClient } from "@/lib/account/server";
import { vote } from "@/lib/account/listing-actions";
import { platformNames, type Platform } from "@/lib/account/validation";
export const metadata = { ...privateMetadata, title: "Community profile" };
export default async function Screen({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Query;
}) {
  const db = await userClient();
  if (!db)
    return (
      <Page title="Community profile">
        <Notice code="config" />
      </Page>
    );
  const { slug } = await params;
  const { data: item, error } = await db
    .from("directory_entries")
    .select("*")
    .eq("slug", slug.slice(0, 80))
    .maybeSingle();
  if (error) throw Error("Unable to load this community.");
  if (!item) notFound();
  const user = await currentUser();
  return (
    <Page
      title={item.name}
      intro={
        platformNames[item.platform as Platform] +
        " · " +
        item.category +
        " · " +
        item.language
      }
    >
      <Notice code={one((await searchParams).notice)} />
      <div className={styles.panel}>
        {item.logo_path && (
          <Image
            unoptimized
            src={item.logo_path}
            alt=""
            width={96}
            height={96}
          />
        )}
        <p>{item.description}</p>
        <p>{(item.tags as string[]).join(" · ")}</p>
        <p>
          <a
            href={item.official_link}
            target="_blank"
            rel="ugc nofollow noopener noreferrer"
          >
            Visit community
          </a>
        </p>
        <p>
          {item.vote_count} community votes · Submitted{" "}
          {String(item.created_at).slice(0, 10)}
        </p>
        {user ? (
          <form action={vote}>
            <input type="hidden" name="id" value={item.id} />
            <Challenge action="vote" />
            <button>Vote for this community</button>
          </form>
        ) : (
          <Link href="/login">Sign in to vote</Link>
        )}
        <p>
          <Link href={"/report?id=" + item.id}>Report this listing</Link>
        </p>
      </div>
    </Page>
  );
}

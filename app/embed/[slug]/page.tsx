import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProjectView from "@/components/projects/ProjectView";
import { getView } from "@/lib/projects/server";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default async function Embed({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ theme?: string }>;
}) {
  const view = await getView((await params).slug).catch(() => undefined);
  if (view === undefined)
    return (
      <main>
        <p>Project storage is unavailable.</p>
      </main>
    );
  if (
    !view ||
    ![
      "countdown-maker",
      "leaderboard-maker",
      "goal-tracker",
      "poll-maker",
      "community-event-page-maker",
    ].includes(view.kind)
  )
    notFound();
  const t = (await searchParams).theme;
  return (
    <main className="pj-embed">
      <ProjectView
        initial={view}
        embed
        theme={
          t === "paper" || t === "forest" || t === "midnight" ? t : undefined
        }
      />
    </main>
  );
}

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ProjectView from "@/components/projects/ProjectView";
import { getView } from "@/lib/projects/server";
import { labels } from "@/lib/projects/model";
import { brand } from "@/lib/brand";
type Props = { params: Promise<{ slug: string }> };
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await getView((await params).slug).catch(() => null);
  const title = view
    ? view.config.title + " · " + labels[view.kind]
    : "Community project";
  return {
    title,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description: "Join a shared community project on " + brand.name,
      images: ["/s/" + (await params).slug + "/opengraph-image"],
    },
  };
}
export default async function Shared({ params }: Props) {
  const view = await getView((await params).slug).catch(() => undefined);
  if (view === undefined)
    return (
      <section className="project-host">
        <h1>Project storage is unavailable</h1>
        <p>
          Please try again after the site owner checks the server configuration.
        </p>
      </section>
    );
  if (!view) notFound();
  return (
    <section className="project-host">
      <ProjectView initial={view} />
    </section>
  );
}

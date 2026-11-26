import Link from "next/link";
import { notFound } from "next/navigation";
import UtilityEditor from "@/components/utilities/UtilityEditor";
import { toolPolicies } from "@/lib/account/tools";
import { tools } from "@/lib/tools";

export const metadata = {
  title: "LoopKit tool widget",
  robots: { index: false, follow: false },
};
type Props = {
  params: Promise<{ tool: string }>;
  searchParams: Promise<{ attribution?: string }>;
};
export default async function ToolWidget({ params, searchParams }: Props) {
  const [{ tool: slug }, { attribution }, policies] = await Promise.all([
    params,
    searchParams,
    toolPolicies(),
  ]);
  const tool = tools.find((item) => item.slug === slug && item.local);
  if (!tool || policies[slug]?.available === false) notFound();
  return (
    <main className="tool-wrap">
      <h1>{tool.name}</h1>
      <UtilityEditor slug={slug} />
      {attribution === "1" && (
        <p>
          <Link
            href={
              "/tools/" +
              slug +
              "?utm_source=widget&utm_medium=referral&utm_campaign=loopkit_widget"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Made with LoopKit
          </Link>
        </p>
      )}
    </main>
  );
}

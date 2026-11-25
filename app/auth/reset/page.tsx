import AuthPage from "@/components/account/AuthPage";
import { privateMetadata, type Query } from "@/components/account/ui";
export const metadata = { ...privateMetadata, title: "Set password" };
export default function Screen({ searchParams }: { searchParams: Query }) {
  return <AuthPage mode="reset" searchParams={searchParams} />;
}

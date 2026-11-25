import AuthPage from "@/components/account/AuthPage";
import { privateMetadata, type Query } from "@/components/account/ui";
export const metadata = { ...privateMetadata, title: "Create account" };
export default function Screen({ searchParams }: { searchParams: Query }) {
  return <AuthPage mode="register" searchParams={searchParams} />;
}

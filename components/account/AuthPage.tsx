import Link from "next/link";
import {
  signIn,
  register,
  resetRequest,
  changePassword,
  googleSignIn,
} from "@/lib/account/auth-actions";
import { requireUser } from "@/lib/account/server";
import Challenge from "./Challenge";
import { Notice, Page, styles, type Query, one } from "./ui";

const modes = {
  login: {
    title: "Welcome back",
    description: "Sign in to manage your projects, communities and billing.",
    action: signIn,
    submit: "Sign in",
  },
  register: {
    title: "Create your account",
    description:
      "Keep your shared projects and community listings in one workspace.",
    action: register,
    submit: "Create account",
  },
  forgot: {
    title: "Reset your password",
    description: "Enter your account email to request a secure recovery link.",
    action: resetRequest,
    submit: "Send recovery email",
  },
  reset: {
    title: "Choose a new password",
    description: "Use a unique password with at least 12 characters.",
    action: changePassword,
    submit: "Update password",
  },
};
export default async function AuthPage({
  mode,
  searchParams,
}: {
  mode: keyof typeof modes;
  searchParams: Query;
}) {
  if (mode === "reset") await requireUser();
  const q = await searchParams;
  const info = modes[mode];
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SITE_URL,
  );
  const canSubmit =
    configured &&
    (mode === "reset" ||
      Boolean(
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY &&
        process.env.TURNSTILE_SECRET_KEY,
      ));
  return (
    <Page title={info.title} intro={info.description}>
      <Notice code={one(q.notice)} />
      {!configured && <Notice code="config" />}
      <form className={styles.form} action={info.action}>
        {mode !== "reset" && (
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              name="email"
              required
              maxLength={254}
            />
          </label>
        )}
        {mode !== "forgot" && (
          <label>
            {mode === "reset" ? "New password" : "Password"}
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "login" ? 1 : 12}
              maxLength={128}
              required
            />
            {mode === "register" && <small>Use at least 12 characters.</small>}
          </label>
        )}
        {configured && mode !== "reset" && (
          <Challenge action={mode === "forgot" ? "recover" : mode} />
        )}
        <button disabled={!canSubmit}>{info.submit}</button>
      </form>
      {mode === "login" &&
        configured &&
        process.env.GOOGLE_OAUTH_ENABLED === "true" && (
          <form action={googleSignIn} className={styles.authlinks}>
            <button className={styles.button}>Continue with Google</button>
          </form>
        )}
      <div className={styles.authlinks}>
        {mode === "login" ? (
          <>
            <Link href="/register">Create an account</Link>
            <Link href="/auth/forgot">Forgot password?</Link>
          </>
        ) : (
          <Link href="/login">Back to sign in</Link>
        )}
      </div>
    </Page>
  );
}

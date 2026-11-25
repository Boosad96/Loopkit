"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, serviceClient, userClient } from "./server";
import { verifyChallenge } from "./challenge";

const emailField = z.string().trim().email().max(254);
const passwordField = z.string().min(12).max(128);
function callback(reset = false) {
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (!site) return null;
  try {
    const url = new URL("/auth/callback", site);
    if (
      url.protocol !== "https:" &&
      !["localhost", "127.0.0.1"].includes(url.hostname)
    )
      return null;
    if (reset) url.searchParams.set("next", "/auth/reset");
    return url.toString();
  } catch {
    return null;
  }
}
export async function signIn(form: FormData) {
  const db = await userClient();
  if (!db) redirect("/login?notice=config");
  const email = emailField.safeParse(form.get("email"));
  const password = form.get("password");
  if (!email.success || typeof password !== "string" || password.length > 128)
    redirect("/login?notice=invalid");
  if (!(await verifyChallenge(form.get("cf-turnstile-response"), "login")))
    redirect("/login?notice=challenge");
  const { error } = await db.auth.signInWithPassword({
    email: email.data,
    password,
  });
  if (error) redirect("/login?notice=invalid");
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
export async function register(form: FormData) {
  const db = await userClient();
  const url = callback();
  if (!db || !url) redirect("/register?notice=config");
  const email = emailField.safeParse(form.get("email"));
  const password = passwordField.safeParse(form.get("password"));
  if (!email.success || !password.success) redirect("/register?notice=input");
  if (!(await verifyChallenge(form.get("cf-turnstile-response"), "register")))
    redirect("/register?notice=challenge");
  const { error } = await db.auth.signUp({
    email: email.data,
    password: password.data,
    options: { emailRedirectTo: url },
  });
  if (error) redirect("/register?notice=signup_error");
  redirect("/login?notice=verify");
}
export async function resetRequest(form: FormData) {
  const db = await userClient();
  const url = callback(true);
  if (!db || !url) redirect("/auth/forgot?notice=config");
  const email = emailField.safeParse(form.get("email"));
  if (!email.success) redirect("/auth/forgot?notice=input");
  if (!(await verifyChallenge(form.get("cf-turnstile-response"), "recover")))
    redirect("/auth/forgot?notice=challenge");
  await db.auth.resetPasswordForEmail(email.data, { redirectTo: url });
  redirect("/auth/forgot?notice=sent");
}
export async function changePassword(form: FormData) {
  await requireUser();
  const db = await userClient();
  const password = passwordField.safeParse(form.get("password"));
  if (!password.success) redirect("/auth/reset?notice=input");
  const { error } = await db!.auth.updateUser({ password: password.data });
  if (error) redirect("/auth/reset?notice=change_failed");
  await db!.auth.signOut();
  redirect("/login?notice=updated");
}
export async function googleSignIn() {
  const db = await userClient();
  const url = callback();
  if (!db || !url || process.env.GOOGLE_OAUTH_ENABLED !== "true")
    redirect("/login?notice=config");
  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: url },
  });
  if (error || !data.url) redirect("/login?notice=unavailable");
  redirect(data.url);
}
export async function signOut() {
  const db = await userClient();
  await db?.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
export async function saveProfile(form: FormData) {
  const user = await requireUser();
  const name = z.string().trim().min(1).max(80).safeParse(form.get("name"));
  if (!name.success) redirect("/dashboard/settings?notice=input");
  const db = await userClient();
  const { error } = await db!
    .from("profiles")
    .update({ display_name: name.data })
    .eq("id", user.id);
  if (error) redirect("/dashboard/settings?notice=unavailable");
  revalidatePath("/dashboard", "layout");
  redirect("/dashboard/settings?notice=saved");
}
export async function deleteAccount(form: FormData) {
  const user = await requireUser();
  if (form.get("confirm") !== "DELETE")
    redirect("/dashboard/settings?notice=confirm");
  const db = await userClient();
  const { data } = await db!.auth.getClaims();
  const recent = data?.claims.amr?.some(
    (method) =>
      typeof method !== "string" &&
      typeof method.timestamp === "number" &&
      method.timestamp >= Date.now() / 1000 - 600,
  );
  if (!recent) redirect("/dashboard/settings?notice=reauth");
  try {
    await (
      await import("@/lib/billing/server")
    ).prepareBillingDeletion(user.id);
  } catch {
    redirect("/dashboard/settings?notice=delete_failed");
  }
  const { error } = await serviceClient().auth.admin.deleteUser(user.id);
  if (error) redirect("/dashboard/settings?notice=delete_failed");
  await db!.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/login?notice=deleted");
}

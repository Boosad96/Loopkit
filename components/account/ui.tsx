import Link from 'next/link'
import type { ReactNode } from 'react'
import styles from './account.module.css'

export { styles }
export type Query = Promise<Record<string, string | string[] | undefined>>
export const one = (value: string | string[] | undefined) => typeof value === 'string' ? value : ''
export const privateMetadata = { robots: { index: false, follow: false } }
const notices: Record<string, string> = {
  config: 'The site owner needs to configure this service before it can accept requests.',
  challenge: 'Complete the verification and submit the form again.', invalid: 'Check your email, password and email verification status.',
  signup_error: 'Registration could not be completed. Try again later or use password recovery.',
  verify: 'Check your inbox for the verification link. If you already have an account, sign in below.',
  input: 'Check each field and try again.', unavailable: 'The request could not be completed. Try again later.',
  sent: 'If your email is registered, you will receive a recovery link.', expired: 'This sign-in link has expired. Request a new one.',
  updated: 'Your password was updated. Sign in with your new password.', change_failed: 'Request a fresh recovery email, then try again.',
  saved: 'Your changes were saved.', submitted: 'Your listing is in the moderation queue.', voted: 'Your vote was recorded.',
  vote_failed: 'Vote unavailable. Each account can vote once per community and cannot vote for its own listing.',
  reported: 'Your report was sent to the moderation team.', confirm: 'Type DELETE to confirm account deletion.',
  reauth: 'For your security, sign out and sign in again before deleting your account.', deleted: 'Your account has been deleted.',
  delete_failed: 'Account deletion could not be completed. Contact support before retrying.',
  reviewed: 'The moderation decision was saved.', limit: 'Your request exceeded a limit or is already recorded.',
}
export function Notice({ code }: { code?: string }) {
  if (!code || !notices[code]) return null
  return <p role="status" className={styles.notice}>{notices[code]}</p>
}
export function Page({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return <section className={styles.page}><header className={styles.title}><h1>{title}</h1>{intro && <p>{intro}</p>}</header>{children}</section>
}
export function AccountNav() {
  return <nav className={styles.nav} aria-label="Workspace">{[['Overview','/dashboard'],['Projects','/dashboard/projects'],['Listings','/dashboard/listings'],['Analytics','/dashboard/analytics'],['Billing','/dashboard/billing'],['Settings','/dashboard/settings']].map(([name,href]) => <Link key={href} href={href}>{name}</Link>)}</nav>
}

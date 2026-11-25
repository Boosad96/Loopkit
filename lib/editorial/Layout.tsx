import Link from 'next/link'
import type { ReactNode } from 'react'
import { brand } from '../brand'
import styles from './editorial.module.css'

export const draftMetadata = { robots: { index: false, follow: false } }

export function Article({title, intro, children, section, draft = false}: {
  title: string, intro?: string, children: ReactNode, section?: string, draft?: boolean,
}) {
  return <main className={styles.article}>
    <nav aria-label="Breadcrumb"><Link href="/">Home</Link>{section && <> / <Link href="/blog">{section}</Link></>}</nav>
    <h1>{title}</h1>
    {intro && <p className={styles.intro}>{intro}</p>}
    {draft && <aside>Policy draft for founder review before public launch.</aside>}
    {children}
  </main>
}

export function ContactLink() {
  const email = brand.contact?.trim()
  if (!email || !/^[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/.test(email)) return <p>The support address will appear here when the operator configures it.</p>
  return <p><a href={'mailto:' + email}>{email}</a></p>
}

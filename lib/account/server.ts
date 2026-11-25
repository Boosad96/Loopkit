import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

export async function userClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  const jar = await cookies()
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          for (const { name, value, options } of values) jar.set(name, value, options)
        } catch {
          // Server components cannot write cookies. The auth proxy refreshes them.
        }
      },
    },
  })
}

export function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Server database configuration is required.')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export const currentUser = cache(async () => {
  const db = await userClient()
  if (!db) return null
  const { data, error } = await db.auth.getUser()
  if (error || !data.user) return null
  const { data: profile, error: profileError } = await db.from('profiles').select('suspended_at').eq('id', data.user.id).maybeSingle()
  return !profileError && profile && !profile.suspended_at ? data.user : null
})

export async function requireUser() {
  const user = await currentUser()
  if (!user) redirect('/login')
  return user
}

export async function requireRole(roles: string[]) {
  const user = await requireUser()
  const db = await userClient()
  const { data } = await db!.from('profiles').select('role, suspended_at').eq('id', user.id).maybeSingle()
  if (!data || data.suspended_at || !roles.includes(data.role)) notFound()
  return user
}

export async function requireAdmin() {
  return requireRole(['admin'])
}

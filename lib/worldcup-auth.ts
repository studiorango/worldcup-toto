export interface WCUser {
  id: string
  username: string
  displayName: string
  color: string
  isAdmin: boolean
  group: string
}

const SESSION_KEY = 'wc2026_session'

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function saveSession(user: WCUser) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function getSession(): WCUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as WCUser) : null
  } catch {
    return null
  }
}

export function clearSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(SESSION_KEY)
}

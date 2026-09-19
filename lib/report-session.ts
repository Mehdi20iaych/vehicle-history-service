import { createHmac, timingSafeEqual } from 'node:crypto'

export type ReportSession = { orderId: string; vin: string; price?: string; purpose: 'checkout' | 'report'; expires: number }
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 86400 }
function signature(value: string) {
  const secret = process.env.PAYPAL_CLIENT_SECRET
  if (!secret) throw new Error('Checkout is not configured')
  return createHmac('sha256', secret).update(`autoscope-session-v1:${value}`).digest('base64url')
}
export function signSession(session: ReportSession) {
  const value = Buffer.from(JSON.stringify(session)).toString('base64url')
  return `${value}.${signature(value)}`
}
export function readSession(token: string | undefined, purpose: ReportSession['purpose']): ReportSession | null {
  try {
    if (!token || token.length > 2048) return null
    const [value, mac, extra] = token.split('.')
    if (!value || !mac || extra) return null
    const expected = Buffer.from(signature(value))
    const actual = Buffer.from(mac)
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
    const session = JSON.parse(Buffer.from(value, 'base64url').toString())
    if (session.purpose !== purpose || !Number.isFinite(session.expires) || session.expires <= Date.now() || !/^[A-HJ-NPR-Z0-9]{17}$/.test(session.vin) || typeof session.orderId !== 'string') return null
    return session
  } catch { return null }
}

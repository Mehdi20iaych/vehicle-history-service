import { NextResponse } from 'next/server'
import { PAYPAL_CURRENCY } from '@/lib/paypal'

export const runtime = 'nodejs'

export async function GET() {
  if (process.env.PAYPAL_MODE !== 'live') {
    return NextResponse.json({ message: 'Live payments are not configured yet.' }, { status: 503 })
  }
  const clientId = process.env.PAYPAL_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ message: 'PayPal is not configured.' }, { status: 503 })
  }

  return NextResponse.json(
    { clientId, currency: PAYPAL_CURRENCY },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}

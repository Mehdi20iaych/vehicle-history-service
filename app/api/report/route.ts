import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { readSession } from '@/lib/report-session'
import { availableRecords } from '@/lib/vehicle-records'
import { getReportQuote } from '@/lib/site-analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  const session = readSession((await cookies()).get('autoscope_report')?.value, 'report')
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' }
  if (!session) return NextResponse.json({ message: 'No active report session. Open this page in the browser used for checkout. Earlier sessions cannot be recovered here; do not pay again.' }, { status: 401, headers })
  const savedQuote = session.quoteId ? await getReportQuote(session.quoteId, session.vin, 1440) : null
  const sections = savedQuote?.sections || (await availableRecords(session.vin)).sections
  return NextResponse.json({ vin: session.vin, orderId: session.orderId, sections }, { headers })
}

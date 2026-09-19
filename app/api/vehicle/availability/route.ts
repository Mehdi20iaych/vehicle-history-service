import { NextResponse } from 'next/server'
import { availableRecords } from '@/lib/vehicle-records'
import { analyticsCookie, recordEvent, visitorIdFromRequest } from '@/lib/site-analytics'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const vin = typeof body?.vin === 'string' ? body.vin.toUpperCase().trim() : ''
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return NextResponse.json({ message: 'Enter a valid 17-character VIN.' }, { status: 400 })
  const { available, sections, quote } = await availableRecords(vin)
  const visitorId = visitorIdFromRequest(request)
  await recordEvent(request, available ? 'preview_available' : 'preview_unavailable', { visitorId, amount: available ? quote.price : null, currency: 'USD', metadata: { recordCount: quote.recordCount, sourceCount: quote.sourceCount } })
  const response = NextResponse.json({ available, price: available ? quote.price : null, currency: 'USD', sections: sections.map(({ title, status, records }) => ({ title, status, count: records.length })) }, { headers: { 'Cache-Control': 'no-store' } })
  const cookie = analyticsCookie(visitorId)
  response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}

import { NextResponse } from 'next/server'
import { analyticsCookie, recordEvent, visitorIdFromRequest, type AnalyticsEvent } from '@/lib/site-analytics'

const clientEvents = new Set<AnalyticsEvent>(['page_view', 'time_spent'])

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const event = body?.event as AnalyticsEvent
  if (!clientEvents.has(event)) return NextResponse.json({ message: 'Invalid event.' }, { status: 400 })
  const visitorId = visitorIdFromRequest(request)
  await recordEvent(request, event, {
    visitorId,
    path: typeof body?.path === 'string' ? body.path.slice(0, 300) : null,
    referrer: typeof body?.referrer === 'string' ? body.referrer.slice(0, 1000) : null,
    durationSeconds: Number.isFinite(body?.durationSeconds) ? Math.min(3600, Math.max(1, Math.round(body.durationSeconds))) : null,
  })
  const response = NextResponse.json({ ok: true })
  const cookie = analyticsCookie(visitorId)
  response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}

import { after, NextResponse } from 'next/server'
import { PAYPAL_CURRENCY, paypalRequest } from '@/lib/paypal'
import { cookies } from 'next/headers'
import { readSession, signSession, cookieOptions } from '@/lib/report-session'
import { isReportPrice } from '@/lib/vehicle-records'
import { getReportQuote, recordEvent, visitorIdFromRequest } from '@/lib/site-analytics'

export const runtime = 'nodejs'

type PayPalOrder = {
  id?: string
  status?: string
  purchase_units?: Array<{
    reference_id?: string
    custom_id?: string
    amount?: { currency_code?: string; value?: string }
    payments?: {
      captures?: Array<{
        id?: string
        status?: string
        amount?: { currency_code?: string; value?: string }
      }>
    }
  }>
}

function hasExpectedAmount(order: PayPalOrder, expectedPrice: string) {
  const purchaseUnit = order.purchase_units?.[0]
  const amount = purchaseUnit?.payments?.captures?.[0]?.amount || purchaseUnit?.amount
  return amount?.currency_code === PAYPAL_CURRENCY && amount?.value === expectedPrice
}

function redirect(origin: string, payment: 'success' | 'failed', orderId?: string) {
  const target = new URL('/', origin)
  target.searchParams.set('payment', payment)
  if (orderId) target.searchParams.set('order', orderId)
  target.hash = 'start'
  return NextResponse.redirect(target)
}

async function captureOrder(orderId: string) {
  const session = readSession((await cookies()).get('autoscope_checkout')?.value, 'checkout')
  if (!session || session.orderId !== orderId) throw new Error('Checkout session missing or expired. Return to the original checkout browser.')
  if (!isReportPrice(session.price)) throw new Error('The signed checkout price is invalid. Please start checkout again.')
  const expectedPrice = session.price
  if (!session.quoteId || !(await getReportQuote(session.quoteId, session.vin, 60))) {
    throw new Error('The verified report data expired. Payment has not been captured. Check the VIN again.')
  }
  let order: PayPalOrder
  try {
    order = await paypalRequest<PayPalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
      {
        method: 'POST',
        headers: { 'PayPal-Request-Id': `capture-${orderId}`.slice(0, 38) },
        body: '{}',
      },
    )
  } catch (captureError) {
    const latestOrder = await paypalRequest<PayPalOrder>(
      `/v2/checkout/orders/${encodeURIComponent(orderId)}`,
    )
    if (latestOrder.status !== 'COMPLETED') throw captureError
    order = latestOrder
  }

  if (order.id !== orderId || order.purchase_units?.length !== 1 || order.purchase_units[0].reference_id !== session.vin || order.purchase_units[0].payments?.captures?.[0]?.status !== 'COMPLETED' || order.status !== 'COMPLETED' || !hasExpectedAmount(order, expectedPrice)) {
    throw new Error('PayPal payment was not completed.')
  }

  const purchaseUnit = order.purchase_units?.[0]
  const capture = purchaseUnit?.payments?.captures?.[0]
  console.info('[paypal] payment captured', {
    orderId,
    captureId: capture?.id || null,
    referenceId: purchaseUnit?.reference_id || null,
    status: order.status,
  })
  return { order, captureId: capture?.id || null, session }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const redirectOrigin = (process.env.NEXT_PUBLIC_SITE_URL || url.origin).replace(/\/$/, '')
  const orderId = url.searchParams.get('token')
  if (!orderId) return redirect(redirectOrigin, 'failed')

  try {
    const { session } = await captureOrder(orderId)
    after(() => recordEvent(request, 'purchase', { visitorId: visitorIdFromRequest(request), orderId, amount: session.price, currency: PAYPAL_CURRENCY }))
    const response = NextResponse.redirect(new URL('/report', request.url))
    response.cookies.set('autoscope_report', signSession({ ...session, purpose: 'report', expires: Date.now() + 86400000 }), cookieOptions)
    return response
  } catch (error) {
    console.error('[paypal] capture failed', error)
    return redirect(redirectOrigin, 'failed')
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  try {
    const body = await request.json()
    const orderId = typeof body?.orderId === 'string' ? body.orderId : ''
    if (!orderId) {
      return NextResponse.json({ message: 'PayPal order ID is required.' }, { status: 400 })
    }

    const { captureId, session } = await captureOrder(orderId)
    after(() => recordEvent(request, 'purchase', { visitorId: visitorIdFromRequest(request), orderId, amount: session.price, currency: PAYPAL_CURRENCY }))
    console.info('[paypal] checkout completed', { orderId, durationMs: Date.now() - startedAt })
    const response = NextResponse.json({ success: true, orderId, captureId, reportUrl: '/report' })
    response.cookies.set('autoscope_report', signSession({ ...session, purpose: 'report', expires: Date.now() + 86400000 }), cookieOptions)
    return response
  } catch (error) {
    console.error('[paypal] card capture failed', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'PayPal could not complete the payment.' },
      { status: 503 },
    )
  }
}

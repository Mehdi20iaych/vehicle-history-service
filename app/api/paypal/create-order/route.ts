import { randomUUID } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import { PAYPAL_CURRENCY, paypalRequest } from '@/lib/paypal'
import { signSession, cookieOptions } from '@/lib/report-session'
import { isReportPrice } from '@/lib/vehicle-records'
import { getReportQuote, recordEvent, visitorIdFromRequest } from '@/lib/site-analytics'

export const runtime = 'nodejs'

type PayPalOrder = {
  id?: string
  links?: Array<{ href?: string; rel?: string }>
}

function isVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value)
}

function isEmail(value: string) {
  return /^\S+@\S+\.\S+$/.test(value)
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  try {
    if (process.env.PAYPAL_MODE !== 'live') return NextResponse.json({ message: 'Live payments are not configured yet.' }, { status: 503 })
    const body = await request.json()
    const vin = typeof body?.vin === 'string' ? body.vin.replace(/\s/g, '').toUpperCase() : ''
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const expectedPrice = typeof body?.expectedPrice === 'string' ? body.expectedPrice : ''
    const quoteId = typeof body?.quoteId === 'string' ? body.quoteId : ''
    const useButtons = body?.flow === 'buttons'

    if (!isVin(vin)) {
      return NextResponse.json({ message: 'Please enter a valid VIN.' }, { status: 400 })
    }
    if (email && !isEmail(email)) {
      return NextResponse.json({ message: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (!isReportPrice(expectedPrice)) return NextResponse.json({ message: 'Please check the VIN again to get the current report price.' }, { status: 400 })

    const quote = await getReportQuote(quoteId, vin, 30)
    if (!quote) return NextResponse.json({ message: 'Your secure quote expired. Check the VIN again before payment.' }, { status: 409 })
    const price = Number(quote.price).toFixed(2)
    if (price !== expectedPrice) return NextResponse.json({ message: 'Available records changed. Check the VIN again to confirm the updated price before payment.' }, { status: 409 })
    const requestOrigin = new URL(request.url).origin
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestOrigin).replace(/\/$/, '')
    const orderPayload = {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: vin,
        custom_id: JSON.stringify({ vin, email }),
        description: `Available vehicle records for VIN ${vin}`,
        amount: { currency_code: PAYPAL_CURRENCY, value: price },
      }],
      application_context: { brand_name: 'Autoscope', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING' },
      ...(useButtons ? {} : {
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'Autoscope',
              user_action: 'PAY_NOW',
              return_url: `${siteUrl}/api/paypal/capture-order`,
              cancel_url: `${siteUrl}/?payment=cancelled#start`,
            },
          },
        },
      }),
    }
    const order = await paypalRequest<PayPalOrder>('/v2/checkout/orders', {
      method: 'POST',
      headers: {
        Prefer: 'return=representation',
        'PayPal-Request-Id': randomUUID(),
      },
      body: JSON.stringify(orderPayload),
    })

    const approvalUrl = order.links?.find(
      (link) => link.rel === 'payer-action' || link.rel === 'approve',
    )?.href

    if (!order.id) {
      throw new Error('PayPal did not return an order ID.')
    }
    after(() => recordEvent(request, 'checkout_started', { visitorId: visitorIdFromRequest(request), orderId: order.id, amount: price, currency: PAYPAL_CURRENCY, metadata: { recordCount: quote.record_count, sourceCount: quote.source_count } }))
    console.info('[paypal] order created', { orderId: order.id, durationMs: Date.now() - startedAt })
    if (useButtons) {
      const response = NextResponse.json({ orderId: order.id })
      response.cookies.set('autoscope_checkout', signSession({ orderId: order.id, vin, price, quoteId, purpose: 'checkout', expires: Date.now() + 86400000 }), cookieOptions)
      return response
    }
    if (!approvalUrl) {
      throw new Error('PayPal did not return a checkout link.')
    }

    const response = NextResponse.json({ orderId: order.id, approvalUrl })
    response.cookies.set('autoscope_checkout', signSession({ orderId: order.id, vin, price, quoteId, purpose: 'checkout', expires: Date.now() + 86400000 }), cookieOptions)
    return response
  } catch (error) {
    console.error('[paypal] create order failed', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'PayPal checkout is unavailable.' },
      { status: 503 },
    )
  }
}

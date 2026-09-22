import { randomUUID } from 'node:crypto'
import { after, NextResponse } from 'next/server'
import { COUPON_DISCOUNT_PERCENT, couponHash, isKnownCouponHash, normalizeCoupon } from '@/lib/coupons'
import { cookieOptions, signSession } from '@/lib/report-session'
import { getReportQuote, recordEvent, redeemCouponOnce, visitorIdFromRequest } from '@/lib/site-analytics'

export const runtime = 'nodejs'

function isVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const vin = typeof body?.vin === 'string' ? body.vin.replace(/\s/g, '').toUpperCase() : ''
    const quoteId = typeof body?.quoteId === 'string' ? body.quoteId : ''
    const code = typeof body?.coupon === 'string' ? normalizeCoupon(body.coupon) : ''

    if (!isVin(vin)) return NextResponse.json({ message: 'Please enter a valid VIN first.' }, { status: 400 })
    if (!code) return NextResponse.json({ message: 'Enter a coupon code.' }, { status: 400 })

    const hash = couponHash(code)
    if (!isKnownCouponHash(hash)) return NextResponse.json({ message: 'This coupon code is not valid.' }, { status: 404 })

    const quote = await getReportQuote(quoteId, vin, 30)
    if (!quote) return NextResponse.json({ message: 'Your report quote expired. Check the VIN again before using the coupon.' }, { status: 409 })

    const redeemed = await redeemCouponOnce(request, { couponHash: hash, vin, quoteId })
    if (!redeemed) return NextResponse.json({ message: 'This coupon has already been used.' }, { status: 409 })

    const orderId = `COUPON-${randomUUID()}`
    after(() => recordEvent(request, 'coupon_redeemed', {
      visitorId: visitorIdFromRequest(request),
      orderId,
      amount: 0,
      currency: 'USD',
      metadata: {
        discountPercent: COUPON_DISCOUNT_PERCENT,
        originalPrice: quote.price,
        quoteId,
      },
    }))

    const response = NextResponse.json({ success: true, reportUrl: '/report' })
    response.cookies.set('autoscope_report', signSession({
      orderId,
      vin,
      price: '0.00',
      quoteId,
      purpose: 'report',
      expires: Date.now() + 86400000,
    }), cookieOptions)
    return response
  } catch (error) {
    console.error('[coupon] redemption failed', error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Coupon could not be applied.' },
      { status: 503 },
    )
  }
}

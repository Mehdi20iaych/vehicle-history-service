import { NextResponse } from 'next/server'

function isVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value)
}

function decodePassthrough(value: string) {
  try {
    const decoded = Buffer.from(value, 'base64url').toString('utf8')
    const parsed = JSON.parse(decoded)
    return {
      vin: typeof parsed?.vin === 'string' ? parsed.vin.toUpperCase() : '',
      email: typeof parsed?.email === 'string' ? parsed.email : '',
    }
  } catch {
    return { vin: '', email: '' }
  }
}

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const expectedSecret = process.env.GUMROAD_WEBHOOK_SECRET
  const providedSecret = new URL(request.url).searchParams.get('secret')
  if (expectedSecret && providedSecret !== expectedSecret) {
    return NextResponse.json({ received: false, message: 'Unauthorized webhook.' }, { status: 401 })
  }

  try {
    const contentType = request.headers.get('content-type') || ''
    const payload = contentType.includes('application/json')
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries())
    const passthrough = typeof payload?.passthrough === 'string' ? decodePassthrough(payload.passthrough) : { vin: '', email: '' }
    const email = typeof payload?.email === 'string' ? payload.email : passthrough.email
    const vin = passthrough.vin

    if (!isVin(vin)) {
      // Gumroad's Ping test intentionally contains no sale or passthrough VIN.
      // A 2xx response confirms the endpoint is reachable without treating the
      // connectivity check as a paid order.
      return NextResponse.json({ received: true, ping: true })
    }

    console.log('[v0] Gumroad sale received:', {
      saleId: payload.sale_id || payload.id || null,
      email,
      vin,
      product: payload.product_permalink || payload.short_product_id || null,
    })

    return NextResponse.json({ received: true, vin, email })
  } catch {
    return NextResponse.json({ received: false, message: 'Invalid webhook payload.' }, { status: 400 })
  }
}

export function GET() {
  return NextResponse.json({ ok: true, webhook: 'gumroad' })
}

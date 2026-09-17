import { NextResponse } from 'next/server'

const PRICE = '24.99'

function paypalBaseUrl() {
  return process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
}

function isVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value)
}

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('PayPal is not configured.')

  const response = await fetch(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)
  if (!response.ok || typeof data?.access_token !== 'string') throw new Error('Unable to authenticate with PayPal.')
  return data.access_token
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const vin = typeof body?.vin === 'string' ? body.vin.replace(/\s/g, '').toUpperCase() : ''
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    if (!isVin(vin)) return NextResponse.json({ message: 'Please enter a valid VIN.' }, { status: 400 })

    const accessToken = await getAccessToken()
    const origin = new URL(request.url).origin
    const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: vin,
          custom_id: JSON.stringify({ vin, email }),
          description: `Vehicle history report for VIN ${vin}`,
          amount: { currency_code: 'USD', value: PRICE },
        }],
        application_context: {
          brand_name: 'Autoscope',
          user_action: 'PAY_NOW',
          return_url: `${origin}/api/paypal/capture-order`,
          cancel_url: `${origin}/?payment=cancelled#start`,
        },
      }),
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    const approvalUrl = data?.links?.find((link: { rel?: string }) => link.rel === 'approve')?.href
    if (!response.ok || !approvalUrl) return NextResponse.json({ message: 'PayPal could not create the checkout.' }, { status: 502 })
    return NextResponse.json({ orderId: data.id, approvalUrl })
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'PayPal checkout is unavailable.' }, { status: 503 })
  }
}

export { getAccessToken, paypalBaseUrl }

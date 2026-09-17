import { NextResponse } from 'next/server'
import { getAccessToken, paypalBaseUrl } from '../create-order/route'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const orderId = url.searchParams.get('token')
  if (!orderId) return NextResponse.redirect(new URL('/?payment=failed#start', url.origin))

  try {
    const accessToken = await getAccessToken()
    const response = await fetch(`${paypalBaseUrl()}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    if (!response.ok || data?.status !== 'COMPLETED') return NextResponse.redirect(new URL('/?payment=failed#start', url.origin))

    const purchaseUnit = data.purchase_units?.[0]
    console.log('[v0] PayPal payment captured:', {
      orderId,
      captureId: purchaseUnit?.payments?.captures?.[0]?.id || null,
      referenceId: purchaseUnit?.reference_id || null,
      status: data.status,
    })
    return NextResponse.redirect(new URL(`/?payment=success&order=${encodeURIComponent(orderId)}#start`, url.origin))
  } catch {
    return NextResponse.redirect(new URL('/?payment=failed#start', url.origin))
  }
}

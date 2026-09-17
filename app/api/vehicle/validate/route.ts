import { NextResponse } from 'next/server'

function isVin(value: string) {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(value)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const vin = typeof body?.vin === 'string' ? body.vin.replace(/\s/g, '').toUpperCase() : ''
    if (!isVin(vin)) return NextResponse.json({ valid: false, message: 'Please enter a valid 17-character VIN.' }, { status: 400 })

    const apiKey = process.env.VEHICLE_DATABASES_API_KEY
    const endpoint = process.env.VEHICLE_DATABASES_VALIDATE_URL || `https://api.vehicledatabases.com/vin-decode/${vin}`
    if (!apiKey || !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return NextResponse.json({ valid: false, message: 'Vehicle validation is not configured yet.' }, { status: 503 })

    const providerResponse = await fetch(endpoint.includes('{vin}') ? endpoint.replace('{vin}', vin) : endpoint, {
      method: 'GET',
      headers: { 'x-authkey': apiKey, Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      cache: 'no-store',
    })
    const providerData = await providerResponse.json().catch(() => null)
    if (!providerResponse.ok || providerData?.error === true || providerData?.success === false) {
      return NextResponse.json({ valid: false, message: 'We could not verify that VIN right now. Please try again.' }, { status: 502 })
    }
    return NextResponse.json({ valid: true })
  } catch {
    return NextResponse.json({ valid: false, message: 'We could not verify that VIN right now. Please try again.' }, { status: 500 })
  }
}

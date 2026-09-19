export const PAYPAL_PRICE = '9.99'
export const PAYPAL_CURRENCY = 'USD'
let cachedAccessToken: { value: string; expiresAt: number } | null = null

export function paypalBaseUrl() {
  return process.env.PAYPAL_MODE === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

async function getAccessToken() {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) return cachedAccessToken.value
  const clientId = process.env.PAYPAL_CLIENT_ID
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('PayPal credentials are not configured.')
  }

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

  if (!response.ok || typeof data?.access_token !== 'string') {
    throw new Error('PayPal rejected the configured credentials.')
  }
  const expiresIn = Number(data.expires_in) || 300
  cachedAccessToken = { value: data.access_token, expiresAt: Date.now() + expiresIn * 1000 }
  return cachedAccessToken.value
}

export async function paypalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const accessToken = await getAccessToken()
  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${accessToken}`)
  headers.set('Content-Type', 'application/json')

  const response = await fetch(`${paypalBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  })
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const detail = data?.details?.[0]?.description || data?.message
    throw new Error(detail || 'PayPal request failed.')
  }

  return data as T
}

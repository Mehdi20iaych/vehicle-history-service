'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Props = {
  vin: string
  email: string
  price: string
  quoteId: string
  onError: (message: string) => void
}

export function PayPalCardCheckout({ vin, email, price, quoteId, onError }: Props) {
  const startedRef = useRef(false)
  const [status, setStatus] = useState('Opening secure PayPal checkout…')
  const [failed, setFailed] = useState(false)

  const startCheckout = useCallback(async () => {
    if (startedRef.current) return
    startedRef.current = true
    setFailed(false)
    setStatus('Opening secure PayPal checkout…')
    try {
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin, email, expectedPrice: price, quoteId, flow: 'redirect' }),
      })
      const data = await response.json()
      if (!response.ok || !data.approvalUrl) throw new Error(data.message || 'PayPal could not start checkout.')
      window.location.assign(data.approvalUrl)
    } catch (error) {
      startedRef.current = false
      setFailed(true)
      const message = error instanceof Error ? error.message : 'PayPal could not start checkout.'
      setStatus(message)
      onError(message)
    }
  }, [email, onError, price, quoteId, vin])

  useEffect(() => { void startCheckout() }, [startCheckout])

  return (
    <div className="paypal-methods" role="status">
      <p className="payment-choice">{status}</p>
      {failed && <button type="button" className="button button-dark form-button" onClick={startCheckout}>Try payment again</button>}
    </div>
  )
}

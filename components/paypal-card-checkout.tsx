'use client'

import { useEffect, useRef, useState } from 'react'
import { trackMeta } from '@/components/meta-pixel'

type PayPalActions = {
  order: { create: () => Promise<string> }
}

type PayPalButton = {
  render: (element: HTMLElement) => Promise<void>
  isEligible: () => boolean
}

type PayPalSdk = {
  FUNDING: { PAYPAL: string; CARD: string }
  Buttons: (options: {
    fundingSource?: string
    style?: object
    createOrder: (_data: unknown, actions: PayPalActions) => Promise<string>
    onApprove: (data: { orderID?: string }) => Promise<void>
    onCancel: () => void
    onError: () => void
  }) => PayPalButton
}

declare global {
  interface Window { paypal?: PayPalSdk }
}

type Props = {
  vin: string
  email: string
  price: string
  onComplete: (orderId: string) => void
  onError: (message: string) => void
}

export function PayPalCardCheckout({ vin, email, price, onComplete, onError }: Props) {
  const walletRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState('Loading PayPal payment options…')

  useEffect(() => {
    let cancelled = false

    const createOrder = async () => {
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vin, email, expectedPrice: price, flow: 'buttons' }),
      })
      const data = await response.json()
      if (!response.ok || !data.orderId) throw new Error(data.message || 'PayPal could not start the order.')
      return data.orderId as string
    }

    const captureOrder = async (orderId: string) => {
      const response = await fetch('/api/paypal/capture-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.message || 'PayPal could not complete the payment.')
      trackMeta('Purchase', { value: Number(price), currency: 'USD', content_name: 'Vehicle report' })
      onComplete(orderId)
    }

    async function loadSdk() {
      const configResponse = await fetch('/api/paypal/config')
      const config = await configResponse.json()
      if (!configResponse.ok || !config.clientId) throw new Error(config.message || 'PayPal is unavailable.')

      if (!window.paypal) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>('script[data-autoscope-paypal-sdk]')
          if (existing) {
            existing.addEventListener('load', () => resolve(), { once: true })
            existing.addEventListener('error', () => reject(new Error('PayPal could not load.')), { once: true })
            return
          }
          const script = document.createElement('script')
          script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(config.clientId)}&currency=${encodeURIComponent(config.currency || 'USD')}&intent=capture&enable-funding=card`
          script.async = true
          script.dataset.autoscopePaypalSdk = 'true'
          script.onload = () => resolve()
          script.onerror = () => reject(new Error('PayPal could not load.'))
          document.head.appendChild(script)
        })
      }

      if (cancelled || !window.paypal || !walletRef.current || !cardRef.current) return
      const sharedOptions = {
        createOrder: async () => {
          setStatus('Creating your secure PayPal order…')
          return createOrder()
        },
        onApprove: async (data: { orderID?: string }) => {
          if (!data.orderID) throw new Error('PayPal did not return an order ID.')
          setStatus('Completing your payment…')
          await captureOrder(data.orderID)
        },
        onCancel: () => setStatus('Payment cancelled. You have not been charged.'),
        onError: () => onError('PayPal could not complete the payment. Please try again.'),
      }

      walletRef.current.innerHTML = ''
      cardRef.current.innerHTML = ''
      await window.paypal.Buttons({ ...sharedOptions, fundingSource: window.paypal.FUNDING.PAYPAL, style: { layout: 'vertical', label: 'paypal', shape: 'rect' } }).render(walletRef.current)

      const cardButton = window.paypal.Buttons({ ...sharedOptions, fundingSource: window.paypal.FUNDING.CARD, style: { layout: 'vertical', label: 'pay', shape: 'rect' } })
      if (cardButton.isEligible()) {
        await cardButton.render(cardRef.current)
        setStatus('Choose PayPal or debit/credit card below.')
      } else {
        setStatus('Card payment is not available for this buyer. You can still pay securely with PayPal.')
      }
    }

    loadSdk().catch((error) => onError(error instanceof Error ? error.message : 'PayPal could not load.'))
    return () => { cancelled = true }
  }, [email, onComplete, onError, price, vin])

  return <div className="paypal-methods"><p className="payment-choice">{status}</p><div ref={walletRef} /><div ref={cardRef} /></div>
}

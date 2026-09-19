import { NextResponse } from 'next/server'
import { saveContactMessage } from '@/lib/site-analytics'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
    const message = typeof body?.message === 'string' ? body.message.trim() : ''
    const website = typeof body?.website === 'string' ? body.website.trim() : ''

    if (website) return NextResponse.json({ success: true })
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
      return NextResponse.json({ message: 'Please enter a valid email address.' }, { status: 400 })
    }
    if (message.length < 10 || message.length > 2000) {
      return NextResponse.json({ message: 'Your message must be between 10 and 2,000 characters.' }, { status: 400 })
    }
    const saved = await saveContactMessage(request, email, message)
    if (!saved) throw new Error('Contact storage is unavailable.')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[contact] message failed', error)
    return NextResponse.json({ message: 'Your message could not be sent. Please try again.' }, { status: 503 })
  }
}

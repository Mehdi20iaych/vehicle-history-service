import { NextResponse } from 'next/server'
import { adminToken } from '@/lib/site-analytics'

export async function POST(request: Request) {
  const form = await request.formData()
  const password = String(form.get('password') || '')
  if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) return NextResponse.redirect(new URL('/admin?error=1', request.url), 303)
  const response = NextResponse.redirect(new URL('/admin', request.url), 303)
  response.cookies.set('autoscope_admin', adminToken(password), { httpOnly: true, secure: true, sameSite: 'strict', path: '/admin', maxAge: 86400 })
  return response
}

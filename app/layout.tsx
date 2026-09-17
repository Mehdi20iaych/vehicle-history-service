import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Autoscope — Know before you buy',
  description: 'Clear, independent vehicle history reports for more confident car buying decisions.',
  generator: 'v0.app',
  openGraph: { title: 'Autoscope — Know before you buy', description: 'A clearer vehicle history report for the next decision.', type: 'website' },
}

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f7f6f2', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}

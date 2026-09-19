import { Analytics } from '@vercel/analytics/next'
import { AnalyticsTracker } from '@/components/analytics-tracker'
import { MetaPixel } from '@/components/meta-pixel'
import type { Metadata, Viewport } from 'next'
import './globals.css'

const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://vehicle-history-service.vercel.app')

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: { default: 'Free VIN Check & Vehicle History Preview | Autoscope', template: '%s | Autoscope' },
  description: 'Check a 17-character VIN free. Preview the vehicle, then unlock available title, salvage, odometer, recall, sale, auction and value records.',
  applicationName: 'Autoscope',
  creator: 'Autoscope',
  publisher: 'Autoscope',
  category: 'Automotive',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 } },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: { title: 'Free VIN Check & Vehicle History Preview | Autoscope', description: 'Enter a VIN for a free vehicle preview, then choose whether to unlock the records available for that vehicle.', type: 'website', url: '/', siteName: 'Autoscope', locale: 'en_US' },
  twitter: { card: 'summary_large_image', title: 'Free VIN Check & Vehicle History Preview | Autoscope', description: 'Preview a vehicle free by VIN before deciding whether to unlock its available history records.' },
}

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f7f6f2', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className="antialiased">{children}<AnalyticsTracker />{process.env.NODE_ENV === 'production' && <><Analytics /><MetaPixel /></>}</body></html>
}

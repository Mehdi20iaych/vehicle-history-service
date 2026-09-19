import type { MetadataRoute } from 'next'

const origin = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vehicle-history-service.vercel.app').replace(/\/$/, '')

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/report', '/api/'] },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}

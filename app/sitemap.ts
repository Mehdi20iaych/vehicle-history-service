import type { MetadataRoute } from 'next'

const origin = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vehicle-history-service.vercel.app').replace(/\/$/, '')

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: origin, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }]
}

import { MetadataRoute } from 'next'
import siteMetadata from '@/data/siteMetadata'
import { getSitemapEntries } from 'lib/cms/payload-adapter.mjs'

export const dynamic = 'force-static'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = siteMetadata.siteUrl

  const entries = await getSitemapEntries()
  const blogRoutes = entries.map((post) => ({
    url: `${siteUrl}/${post.path}`,
    lastModified: post.lastModified,
  }))

  const routes = ['', 'blog', 'projects', 'tags'].map((route) => ({
    url: `${siteUrl}/${route}`,
    lastModified: new Date().toISOString().split('T')[0],
  }))

  return [...routes, ...blogRoutes]
}

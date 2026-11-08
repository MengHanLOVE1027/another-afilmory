import { readFileSync } from 'node:fs'

import type { PhotoManifestItem } from '@afilmory/builder'
import { tsImport } from 'tsx/esm/api'
import type { Connect, Plugin } from 'vite'

import type { SiteConfig } from '../../../../site.config'
import { MANIFEST_PATH } from './__internal__/constants'

const { generateRSSFeed } = await tsImport('@afilmory/utils', import.meta.url)

export function createFeedSitemapPlugin(siteConfig: SiteConfig): Plugin {
  return {
    name: 'feed-sitemap-generator',
    configureServer(server) {
      const feedHandler: Connect.NextHandleFunction = (req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0]
        if (pathname !== '/feed.xml' && pathname !== '/sitemap.xml') {
          next()
          return
        }

        try {
          const photosData: PhotoManifestItem[] = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')).data
          const sortedPhotos = photosData.sort(
            (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime(),
          )
          const body = pathname === '/feed.xml'
            ? generateRSSFeed(sortedPhotos, siteConfig)
            : generateSitemap(sortedPhotos, siteConfig)

          res.statusCode = 200
          res.setHeader(
            'Content-Type',
            pathname === '/feed.xml' ? 'application/rss+xml; charset=utf-8' : 'application/xml; charset=utf-8',
          )
          res.end(body)
        }
        catch (error) {
          res.statusCode = 500
          res.end(`Failed to generate ${pathname}: ${String(error)}`)
        }
      }

      server.middlewares.use(feedHandler)
      // Vite's SPA fallback answers text/html requests before later middlewares,
      // so move this handler to the front of the Connect stack.
      const stack = server.middlewares.stack
      const layer = stack.pop()
      if (layer) {
        stack.unshift(layer)
      }
    },
    generateBundle() {
      try {
        const photosData: PhotoManifestItem[] = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')).data

        // Sort photos by date taken (newest first)
        const sortedPhotos = photosData.sort(
          (a, b) => new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime(),
        )

        // Generate RSS feed
        const rssXml = generateRSSFeed(sortedPhotos, siteConfig)

        // Generate sitemap
        const sitemapXml = generateSitemap(sortedPhotos, siteConfig)

        // Emit RSS feed
        this.emitFile({
          type: 'asset',
          fileName: 'feed.xml',
          source: rssXml,
        })

        // Emit sitemap
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: sitemapXml,
        })

        console.info(`Generated RSS feed with ${sortedPhotos.length} photos`)
        console.info(`Generated sitemap with ${sortedPhotos.length + 1} URLs`)
      } catch (error) {
        console.error('Error generating RSS feed and sitemap:', error)
      }
    },
  }
}

function generateSitemap(photos: PhotoManifestItem[], config: SiteConfig): string {
  const now = new Date().toISOString()

  // Main page
  const mainPageXml = `  <url>
    <loc>${config.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`

  // Photo pages
  const photoUrls = photos
    .map((photo) => {
      const lastmod = new Date(photo.lastModified || photo.dateTaken).toISOString()
      return `  <url>
    <loc>${config.url}/photos/${encodeURIComponent(photo.id)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${mainPageXml}
${photoUrls}
</urlset>`
}

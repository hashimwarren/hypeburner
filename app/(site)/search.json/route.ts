import { buildSearchDocuments } from 'lib/cms/artifacts'
import { getAllPosts } from 'lib/cms'

export const runtime = 'nodejs'
export const dynamic = 'force-static'
export const revalidate = 3600

export async function GET() {
  const posts = await getAllPosts()
  const body = JSON.stringify(buildSearchDocuments(posts))

  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

import { buildRssXml, buildTagData, getTagSlug } from 'lib/cms/artifacts'
import { getAllPosts } from 'lib/cms'

export const runtime = 'nodejs'
export const dynamic = 'force-static'
export const revalidate = 3600

export async function generateStaticParams() {
  const posts = await getAllPosts()
  return Object.keys(buildTagData(posts)).map((tag) => ({ tag }))
}

export async function GET(_: Request, props: { params: Promise<{ tag: string }> }) {
  const params = await props.params
  const tag = decodeURIComponent(params.tag)
  const posts = await getAllPosts()
  const taggedPosts = posts.filter((post) =>
    post.tags.some((postTag) => getTagSlug(postTag) === tag)
  )
  const body = buildRssXml(taggedPosts, `tags/${tag}/feed.xml`)

  return new Response(body, {
    headers: {
      'content-type': 'application/rss+xml; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400',
    },
  })
}

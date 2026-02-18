import Main from './Main'
import { getHomePageData } from 'lib/cms/payload-adapter.mjs'

export default async function Page() {
  const { posts, defaultAuthor } = await getHomePageData()
  return <Main posts={posts} defaultAuthor={defaultAuthor} />
}

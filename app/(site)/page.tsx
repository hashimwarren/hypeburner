import Main from './Main'
import { getDefaultAuthor, getHomePosts } from 'lib/cms'

export const dynamic = 'force-static'

export default async function Page() {
  const [posts, defaultAuthor] = await Promise.all([getHomePosts(1000), getDefaultAuthor()])
  return <Main posts={posts} defaultAuthor={defaultAuthor} />
}

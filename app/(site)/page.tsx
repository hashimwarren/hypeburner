import Main from './Main'
import { getDefaultAuthor, getHomePosts } from 'src/payload/queries'

export default async function Page() {
  const [posts, defaultAuthor] = await Promise.all([getHomePosts(1000), getDefaultAuthor()])
  return <Main posts={posts} defaultAuthor={defaultAuthor} />
}

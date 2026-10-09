import { genPageMetadata } from 'app/seo'
import ListLayout from '@/layouts/ListLayoutWithTags'
import { getAllPosts, getTagCounts } from 'lib/cms'
import { toPostSummary } from 'lib/cms/post-summary'

const POSTS_PER_PAGE = 5

export const dynamic = 'force-static'
export const revalidate = 86400
export const metadata = genPageMetadata({ title: 'Blog' })

export default async function BlogPage(props: { searchParams: Promise<{ page: string }> }) {
  const [posts, tagCounts] = await Promise.all([getAllPosts(), getTagCounts()])
  const pageNumber = 1
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)
  const displayPosts = posts.slice(0, POSTS_PER_PAGE * pageNumber).map(toPostSummary)
  const pagination = {
    currentPage: pageNumber,
    totalPages: totalPages,
  }

  return (
    <ListLayout
      posts={displayPosts}
      pagination={pagination}
      tagCounts={tagCounts}
      title="All Posts"
    />
  )
}

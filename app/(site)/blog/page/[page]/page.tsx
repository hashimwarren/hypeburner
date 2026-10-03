import ListLayout from '@/layouts/ListLayoutWithTags'
import { notFound } from 'next/navigation'
import { getAllPosts, getTagCounts } from 'lib/cms'
import { toPostSummary } from 'lib/cms/post-summary'

const POSTS_PER_PAGE = 5

export const dynamic = 'force-static'
export const revalidate = 3600

export const generateStaticParams = async () => {
  const posts = await getAllPosts()
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)
  const paths = Array.from({ length: totalPages }, (_, i) => ({ page: (i + 1).toString() }))

  return paths
}

export default async function Page(props: { params: Promise<{ page: string }> }) {
  const params = await props.params
  const [posts, tagCounts] = await Promise.all([getAllPosts(), getTagCounts()])
  const pageNumber = parseInt(params.page as string)
  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE)

  // Return 404 for invalid page numbers or empty pages
  if (pageNumber <= 0 || pageNumber > totalPages || isNaN(pageNumber)) {
    return notFound()
  }
  const displayPosts = posts
    .slice(POSTS_PER_PAGE * (pageNumber - 1), POSTS_PER_PAGE * pageNumber)
    .map(toPostSummary)
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

import Link from '@/components/Link'
import NewsletterForm from '@/components/NewsletterForm'
import Tag from '@/components/Tag'
import siteMetadata from '@/data/siteMetadata'
import type { SiteAuthor, SitePost } from 'src/payload/types'

const MAX_DISPLAY = 5

type HomeProps = {
  posts: SitePost[]
  defaultAuthor: SiteAuthor | null
}

export default function Home({ posts, defaultAuthor }: HomeProps) {
  return (
    <>
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        <div className="space-y-2 pt-6 pb-8 md:space-y-5">
          <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 md:text-6xl md:leading-14 dark:text-gray-100">
            The{' '}
            <span className="text-primary-500 dark:text-primary-400 font-serif font-medium italic">
              business
            </span>{' '}
            of developer tools
          </h1>
          <p className="text-lg leading-7 text-gray-500 dark:text-gray-400">
            Edited by{' '}
            <Link
              href="/about"
              className="hover:text-primary-500 dark:hover:text-primary-400 text-gray-600 underline-offset-4 hover:underline dark:text-gray-300"
            >
              {defaultAuthor?.name}
            </Link>
          </p>
          {siteMetadata.newsletter?.provider && (
            <div className="pt-4">
              <NewsletterForm inputId="home-newsletter-email-top" />
            </div>
          )}
        </div>
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {!posts.length && 'No posts found.'}
          {posts.slice(0, MAX_DISPLAY).map((post) => {
            const { slug, title, summary, tags } = post
            return (
              <li key={slug} className="py-12">
                <article className="max-w-3xl space-y-5">
                  <div className="space-y-6">
                    <div>
                      <h2 className="text-2xl leading-8 font-bold tracking-tight">
                        <Link href={`/blog/${slug}`} className="text-gray-900 dark:text-gray-100">
                          {title}
                        </Link>
                      </h2>
                      <div className="flex flex-wrap">
                        {(tags || []).map((tag) => (
                          <Tag key={tag} text={tag} />
                        ))}
                      </div>
                    </div>
                    <div className="prose max-w-none text-gray-500 dark:text-gray-400">
                      {summary}
                    </div>
                  </div>
                  <div className="text-base leading-6 font-medium">
                    <Link
                      href={`/blog/${slug}`}
                      className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
                      aria-label={`Read more: "${title}"`}
                    >
                      Read more &rarr;
                    </Link>
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      </div>
      {posts.length > MAX_DISPLAY && (
        <div className="flex justify-end text-base leading-6 font-medium">
          <Link
            href="/blog"
            className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
            aria-label="All posts"
          >
            All Posts &rarr;
          </Link>
        </div>
      )}
      {siteMetadata.newsletter?.provider && (
        <div className="flex items-center justify-center pt-4">
          <NewsletterForm inputId="home-newsletter-email-bottom" />
        </div>
      )}
    </>
  )
}

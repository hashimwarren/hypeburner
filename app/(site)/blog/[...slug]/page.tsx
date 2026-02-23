import 'css/prism.css'
import 'katex/dist/katex.css'

import PostSimple from '@/layouts/PostSimple'
import PostLayout from '@/layouts/PostLayout'
import PostBanner from '@/layouts/PostBanner'
import { Metadata } from 'next'
import type { ComponentProps } from 'react'
import siteMetadata from '@/data/siteMetadata'
import { notFound } from 'next/navigation'
import { RichText } from '@payloadcms/richtext-lexical/react'
import { getAllPostSlugs, getAllPosts, getPostBySlug } from 'src/payload/queries'
import type { SiteAuthor } from 'src/payload/types'

const defaultLayout = 'PostLayout'
type LexicalRichTextData = ComponentProps<typeof RichText>['data']

function getLayoutName(layout?: string): 'PostLayout' | 'PostSimple' | 'PostBanner' {
  if (layout === 'PostSimple' || layout === 'PostBanner' || layout === 'PostLayout') return layout
  return defaultLayout
}

function getAuthorDetails(authors: SiteAuthor[]): SiteAuthor[] {
  if (authors.length > 0) return authors
  return [
    {
      slug: 'default',
      name: siteMetadata.author,
    },
  ]
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata | undefined> {
  const params = await props.params
  const slug = decodeURI(params.slug.join('/'))
  const post = await getPostBySlug(slug)
  if (!post) return

  const authorDetails = getAuthorDetails(post.authors || [])
  const publishedAt = new Date(post.date).toISOString()
  const modifiedAt = new Date(post.lastmod || post.date).toISOString()
  const authors = authorDetails.map((author) => author.name)
  const imageList = post.images?.length ? post.images : [siteMetadata.socialBanner]
  const ogImages = imageList.map((img) => ({
    url: img.includes('http') ? img : `${siteMetadata.siteUrl}${img}`,
  }))

  return {
    title: post.title,
    description: post.summary,
    openGraph: {
      title: post.title,
      description: post.summary,
      siteName: siteMetadata.title,
      locale: 'en_US',
      type: 'article',
      publishedTime: publishedAt,
      modifiedTime: modifiedAt,
      url: './',
      images: ogImages,
      authors: authors.length > 0 ? authors : [siteMetadata.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.summary,
      images: imageList,
    },
  }
}

export const generateStaticParams = async () => {
  const slugs = await getAllPostSlugs()
  return slugs.map((value) => ({ slug: value.split('/').map((segment) => decodeURI(segment)) }))
}

export default async function Page(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const slug = decodeURI(params.slug.join('/'))
  const posts = await getAllPosts()
  const postIndex = posts.findIndex((entry) => entry.slug === slug)
  if (postIndex === -1) return notFound()

  const prev = posts[postIndex + 1]
  const next = posts[postIndex - 1]
  const post = posts[postIndex]
  const authorDetails = getAuthorDetails(post.authors || [])

  const jsonLd = {
    ...(post.structuredData || {}),
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    datePublished: post.date,
    dateModified: post.lastmod || post.date,
    author: authorDetails.map((author) => ({
      '@type': 'Person',
      name: author.name,
    })),
  }

  const layoutName = getLayoutName(post.layout)
  const renderedContent = (
    <>
      {process.env.NODE_ENV !== 'production' && (
        <div className="my-4">
          <a
            className="text-primary text-sm underline"
            href={`/editor?slug=${encodeURIComponent(slug)}`}
            rel="nofollow noopener noreferrer"
          >
            Edit this post
          </a>
        </div>
      )}
      {post.content ? (
        <RichText data={post.content as LexicalRichTextData} />
      ) : (
        <p className="text-muted-foreground">{post.summary}</p>
      )}
    </>
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {layoutName === 'PostLayout' ? (
        <PostLayout
          content={post}
          authorDetails={authorDetails}
          next={next ? { path: next.path, title: next.title } : undefined}
          prev={prev ? { path: prev.path, title: prev.title } : undefined}
        >
          {renderedContent}
        </PostLayout>
      ) : layoutName === 'PostSimple' ? (
        <PostSimple
          content={post}
          next={next ? { path: next.path, title: next.title } : undefined}
          prev={prev ? { path: prev.path, title: prev.title } : undefined}
        >
          {renderedContent}
        </PostSimple>
      ) : (
        <PostBanner
          content={post}
          next={next ? { path: next.path, title: next.title } : undefined}
          prev={prev ? { path: prev.path, title: prev.title } : undefined}
        >
          {renderedContent}
        </PostBanner>
      )}
    </>
  )
}

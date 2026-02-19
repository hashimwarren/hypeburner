import 'css/prism.css'
import 'katex/dist/katex.css'

import PostSimple from '@/layouts/PostSimple'
import PostLayout from '@/layouts/PostLayout'
import PostBanner from '@/layouts/PostBanner'
import LexicalContent from '@/components/payload/LexicalContent'
import { Metadata } from 'next'
import siteMetadata from '@/data/siteMetadata'
import { notFound, redirect } from 'next/navigation'
import {
  getAllPostSlugs,
  getAllPosts,
  getDefaultAuthor,
  getPostBySlug,
  isNewsOrNewsletterPost,
} from 'lib/cms/payload-adapter.mjs'

const defaultLayout = 'PostLayout'
const layouts = {
  PostSimple,
  PostLayout,
  PostBanner,
}

async function newsletterCheckoutAction(formData: FormData) {
  'use server'

  const slug = String(formData.get('slug') || '').trim()
  const checkoutEndpoint = new URL(
    '/api/polar/checkout',
    process.env.NEXT_PUBLIC_SITE_URL || siteMetadata.siteUrl
  ).toString()

  const response = await fetch(checkoutEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interval: 'monthly',
      metadata: {
        source: 'post-cta',
        slug,
      },
    }),
  })

  if (!response.ok) return

  const payload = await response.json().catch(() => null)
  if (payload?.checkoutUrl) {
    redirect(payload.checkoutUrl)
  }
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata | undefined> {
  const params = await props.params
  const slug = decodeURI(params.slug.join('/'))
  const post = await getPostBySlug(slug, { includeDrafts: true })
  const defaultAuthor = await getDefaultAuthor()
  const authorDetails =
    post?.authorDetails && post.authorDetails.length > 0
      ? post.authorDetails
      : defaultAuthor
        ? [defaultAuthor]
        : []

  if (!post) {
    return
  }

  const publishedAt = new Date(post.date).toISOString()
  const modifiedAt = new Date(post.lastmod || post.date).toISOString()
  const authors = authorDetails.map((author) => author.name)
  let imageList = [siteMetadata.socialBanner]
  if (post.images) {
    imageList = typeof post.images === 'string' ? [post.images] : post.images
  }
  const ogImages = imageList.map((img) => {
    return {
      url: img && img.includes('http') ? img : siteMetadata.siteUrl + img,
    }
  })

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
  const slugs = await getAllPostSlugs({ includeDrafts: true })
  return slugs.map((postSlug) => ({ slug: postSlug.split('/').map((name) => decodeURI(name)) }))
}

export const dynamic = 'force-dynamic'

export default async function Page(props: { params: Promise<{ slug: string[] }> }) {
  const params = await props.params
  const slug = decodeURI(params.slug.join('/'))
  const includeDrafts = process.env.NODE_ENV !== 'production'
  const sortedCoreContents = await getAllPosts({ includeDrafts })
  const postIndex = sortedCoreContents.findIndex((p) => p.slug === slug)
  if (postIndex === -1) {
    return notFound()
  }

  const prev = sortedCoreContents[postIndex + 1]
  const next = sortedCoreContents[postIndex - 1]
  const post = await getPostBySlug(slug, { includeDrafts })
  if (!post) return notFound()

  const defaultAuthor = await getDefaultAuthor()
  const authorDetails =
    post.authorDetails && post.authorDetails.length > 0
      ? post.authorDetails
      : defaultAuthor
        ? [defaultAuthor]
        : []

  const mainContent = post
  const jsonLd =
    post.structuredData && typeof post.structuredData === 'object'
      ? { ...post.structuredData }
      : {
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: post.title,
          datePublished: post.date,
          dateModified: post.lastmod || post.date,
          description: post.summary,
          url: `${siteMetadata.siteUrl}/blog/${post.slug}`,
        }

  jsonLd['author'] = authorDetails.map((author) => {
    return {
      '@type': 'Person',
      name: author.name,
    }
  })

  const layoutKey = post.layout && layouts[post.layout] ? post.layout : defaultLayout
  const Layout = layouts[layoutKey]

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Layout content={mainContent} authorDetails={authorDetails} next={next} prev={prev}>
        {isNewsOrNewsletterPost(post) && (
          <form action={newsletterCheckoutAction} className="my-4">
            <input type="hidden" name="slug" value={post.slug} />
            <button
              type="submit"
              className="text-primary-500 hover:text-primary-600 dark:hover:text-primary-400 text-sm font-medium"
            >
              Subscribe for updates &rarr;
            </button>
          </form>
        )}
        {post.body?.lexical ? (
          <LexicalContent content={post.body.lexical} />
        ) : post.body?.html ? (
          <div dangerouslySetInnerHTML={{ __html: post.body.html }} />
        ) : (
          post.body?.raw || null
        )}
      </Layout>
    </>
  )
}

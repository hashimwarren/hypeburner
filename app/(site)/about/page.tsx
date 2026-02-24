import { RichText } from '@payloadcms/richtext-lexical/react'
import type { ComponentProps } from 'react'
import AuthorLayout from '@/layouts/AuthorLayout'
import { genPageMetadata } from 'app/seo'
import { getDefaultAuthor } from 'lib/cms'

type LexicalRichTextData = ComponentProps<typeof RichText>['data']

export const dynamic = 'force-static'
export const metadata = genPageMetadata({ title: 'About' })

export default async function Page() {
  const author = await getDefaultAuthor()
  if (!author) {
    return (
      <section className="pt-6 pb-8 md:space-y-5">
        <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 md:text-6xl md:leading-14 dark:text-gray-100">
          About
        </h1>
        <p className="text-lg leading-7 text-gray-500 dark:text-gray-400">
          Author profile is temporarily unavailable. Please check back soon.
        </p>
      </section>
    )
  }

  return (
    <AuthorLayout content={author}>
      {author.bioRichText ? (
        <RichText data={author.bioRichText as LexicalRichTextData} />
      ) : (
        <p>Author profile is coming soon.</p>
      )}
    </AuthorLayout>
  )
}

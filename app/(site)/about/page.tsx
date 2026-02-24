import { RichText } from '@payloadcms/richtext-lexical/react'
import type { ComponentProps } from 'react'
import { notFound } from 'next/navigation'
import AuthorLayout from '@/layouts/AuthorLayout'
import { genPageMetadata } from 'app/seo'
import { getDefaultAuthor } from 'lib/cms'

type LexicalRichTextData = ComponentProps<typeof RichText>['data']

export const dynamic = 'force-static'
export const metadata = genPageMetadata({ title: 'About' })

export default async function Page() {
  const author = await getDefaultAuthor()
  if (!author) return notFound()

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

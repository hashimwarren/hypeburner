import { RichText } from '@payloadcms/richtext-lexical/react'
import AuthorLayout from '@/layouts/AuthorLayout'
import { genPageMetadata } from 'app/seo'
import { getDefaultAuthor } from 'src/payload/queries'

export const metadata = genPageMetadata({ title: 'About' })

export default async function Page() {
  const author = await getDefaultAuthor()
  if (!author) return null

  return (
    <AuthorLayout content={author}>
      {author.bioRichText ? (
        <RichText data={author.bioRichText as never} />
      ) : (
        <p>Author profile is coming soon.</p>
      )}
    </AuthorLayout>
  )
}

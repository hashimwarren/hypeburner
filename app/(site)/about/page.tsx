import AuthorLayout from '@/layouts/AuthorLayout'
import LexicalContent from '@/components/payload/LexicalContent'
import { genPageMetadata } from 'app/seo'
import { getAboutAuthor } from 'lib/cms/payload-adapter.mjs'

export const metadata = genPageMetadata({ title: 'About' })

export default async function Page() {
  const author = await getAboutAuthor()
  if (!author) return null
  const { body, ...mainContent } = author

  return (
    <>
      <AuthorLayout content={mainContent}>
        {body?.code ? (
          body.raw || null
        ) : body?.lexical ? (
          <LexicalContent content={body.lexical} />
        ) : body?.html ? (
          <div dangerouslySetInnerHTML={{ __html: body.html }} />
        ) : (
          body?.raw || null
        )}
      </AuthorLayout>
    </>
  )
}

import NewsletterForm from './NewsletterForm'
import siteMetadata from '@/data/siteMetadata'

export default function PostSubscribeBox() {
  if (!siteMetadata.newsletter?.provider) return null

  return (
    <div className="mt-8">
      <NewsletterForm
        title="Developer Tool News"
        description=""
        inputId="post-newsletter-email"
        buttonLabel="Send me the next issue"
        className="mx-auto max-w-3xl rounded-xl border-gray-200 bg-white p-5 text-left sm:p-6 dark:border-gray-800 dark:bg-gray-950"
        titleClassName="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl dark:text-white"
        formClassName="mt-4 gap-3"
        inputClassName="h-12 min-w-0 rounded-lg border-gray-300 text-base text-gray-950 md:text-base dark:border-gray-600 dark:text-gray-50"
        buttonClassName="h-auto min-h-12 shrink-0 rounded-lg bg-gray-950 px-4 py-3 text-sm font-semibold whitespace-normal text-white hover:bg-gray-900 sm:px-5 sm:text-base dark:bg-gray-50 dark:text-gray-950 dark:hover:bg-gray-200"
      />
    </div>
  )
}

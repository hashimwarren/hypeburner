import NewsletterForm from './NewsletterForm'

export default function BlogNewsletterForm() {
  return (
    <div className="my-8">
      <NewsletterForm
        compact
        title="Get the next issue"
        description="One concise email when new newsletter coverage is published."
      />
    </div>
  )
}

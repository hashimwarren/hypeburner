import ContactForm from '@/components/ContactForm'
import { genPageMetadata } from 'app/seo'

export const metadata = genPageMetadata({ title: 'Contact' })

export default function ContactPage() {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      <div className="space-y-2 pt-6 pb-8 md:space-y-5">
        <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 md:text-6xl md:leading-14 dark:text-gray-100">
          Contact
        </h1>
        <p className="text-lg leading-7 text-gray-500 dark:text-gray-400">
          Have a question or comment? Send a message below.
        </p>
      </div>
      <div className="prose max-w-none pt-8">
        <ContactForm />
      </div>
    </div>
  )
}

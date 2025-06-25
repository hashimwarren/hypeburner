import { Metadata } from 'next'
import SectionContainer from '@/components/SectionContainer'
import ContactForm from '@/components/ContactForm'
import { genPageMetadata } from 'app/seo'

export const metadata: Metadata = genPageMetadata({ title: 'Contact' })

export default function ContactPage() {
  return (
    <SectionContainer>
      <div className="space-y-8">
        <div className="space-y-4">
          <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 md:text-5xl md:leading-14 dark:text-gray-100">
            Contact Us
          </h1>
          <p className="max-w-2xl text-lg text-gray-600 dark:text-gray-400">
            Have a question or want to get in touch? We'd love to hear from you. Send us a message
            and we'll respond as soon as possible.
          </p>
        </div>
        <ContactForm />
      </div>
    </SectionContainer>
  )
}

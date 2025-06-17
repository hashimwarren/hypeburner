import { Metadata } from 'next'
import SectionContainer from '@/components/SectionContainer'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { genPageMetadata } from 'app/seo'

export const metadata: Metadata = genPageMetadata({ title: 'Contact' })

export default function ContactPage() {
  return (
    <SectionContainer>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl leading-9 font-extrabold tracking-tight text-gray-900 sm:text-4xl sm:leading-10 md:text-5xl md:leading-14 dark:text-gray-100">
            Contact Us
          </h1>
        </div>
        <form className="space-y-6">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Name
            </label>
            <Input id="name" type="text" className="mt-1 block w-full" />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Email
            </label>
            <Input id="email" type="email" className="mt-1 block w-full" />
          </div>
          <div>
            <label
              htmlFor="message"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Message
            </label>
            <Textarea id="message" rows={4} className="mt-1 block w-full" />
          </div>
          <div>
            <Button type="submit">Submit</Button>
          </div>
        </form>
      </div>
    </SectionContainer>
  )
}

import ContactForm from '@/components/ContactForm'
import SectionContainer from '@/components/SectionContainer'
import { genPageMetadata } from 'app/seo'

export const dynamic = 'force-static'
export const metadata = genPageMetadata({
  title: 'Services',
  description:
    'Fractional product marketing, launch strategy, messaging, and trust assets for developer tool startups.',
})

const engagements = [
  {
    team: 'Developer infrastructure startup',
    work: 'Use case strategy, case study development, launch messaging, and sales narrative',
    result: 'Turned technical wins into trust assets for sales conversations',
  },
  {
    team: 'AI framework company',
    work: 'Founder-led LinkedIn, Reddit strategy, technical thought leadership, and SEO content',
    result: 'Built category credibility with developers and AI builders',
  },
  {
    team: 'Product notification platform',
    work: 'Case studies, G2 review motion, technical launch content, and enterprise-readiness assets',
    result: 'Helped position the company as a vendor of choice in competitive deals',
  },
]

const services = [
  {
    title: 'Fractional Product Marketing Leadership',
    body: 'Embedded, part-time product marketing leadership for developer tool startups that need senior judgment without hiring a full-time GTM leader. I help clarify positioning, shape launches, manage vendors, build trust assets, and create a product-first marketing rhythm.',
  },
  {
    title: 'Enterprise-Ready Messaging Sprint',
    body: 'A focused sprint that turns your product, customer proof, and founder vision into messaging enterprise buyers can trust. You leave with a practical system your team, salespeople, agencies, and freelancers can actually use.',
  },
  {
    title: 'Trust Asset Program',
    body: 'Case studies, testimonials, use cases, implementation stories, comparison pages, and thought leadership built around the real reasons customers choose you. I run the process end to end, from interviews through narrative and approval.',
  },
  {
    title: 'Vendor and Freelancer Management',
    body: 'I help source, brief, and manage outside talent so agencies, consultants, and freelancers move faster and produce work that matches your product strategy.',
  },
  {
    title: 'Product Launches',
    body: 'Launch strategy and execution for developer tool startups that need product announcements to do more than ship news. I turn new features, integrations, funding moments, and major product updates into credible launch narratives and sales assets.',
  },
]

const comparison = [
  [
    'Enterprise-ready strategy',
    'Executes a defined brief',
    'Owns strategy over time',
    'Sets strategy quickly and aligns everyone around it',
  ],
  [
    'Technical product fluency',
    'Varies widely',
    'Hard to find and expensive',
    'Brings product marketing judgment for technical buyers',
  ],
  [
    'Speed',
    'Can move fast once scoped',
    'Slower during hiring and ramping',
    'Starts with diagnosis, prioritization, and clear briefs',
  ],
  [
    'Customer proof',
    'Needs strong direction',
    'Builds the function over time',
    'Runs interviews, story development, review, and approval',
  ],
  [
    'Cost and commitment',
    'Often requires retainers',
    'Highest long-term commitment',
    'Flexible senior help without early GTM bloat',
  ],
]

export default function ServicesPage() {
  return (
    <SectionContainer>
      <div className="py-10 md:py-14">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <main className="min-w-0 space-y-14">
            <section className="space-y-6">
              <h1 className="text-4xl leading-tight font-extrabold tracking-tight text-gray-900 sm:text-5xl dark:text-gray-100">
                I help you cross the chasm and win enterprise customers.
              </h1>
              <div className="space-y-5 text-lg leading-8 text-gray-600 dark:text-gray-300">
                <p>
                  Hi, I am Hashim Warren. I am a fractional product marketing leader for developer
                  tool startups. My specialty is turning early technical traction into
                  enterprise-ready marketing.
                </p>
                <p>
                  You already did the hard part: you built a product early adopters love and reached
                  product-market fit. The next challenge is winning complex enterprise deals without
                  overhiring GTM talent or losing product focus.
                </p>
                <p>
                  I turn early wins into the case studies, use cases, launch narratives, thought
                  leadership, and sales collateral that help serious buyers trust you.
                </p>
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  Recent Engagements
                </h2>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  Practical product marketing work for technical teams moving from founder-led GTM
                  toward enterprise-ready sales.
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
                <div className="divide-y divide-gray-200 dark:divide-gray-800">
                  {engagements.map((engagement) => (
                    <div
                      key={engagement.team}
                      className="grid gap-4 bg-white p-5 sm:grid-cols-3 dark:bg-gray-950"
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                        {engagement.team}
                      </h3>
                      <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
                        {engagement.work}
                      </p>
                      <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
                        {engagement.result}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                How We Can Work Together
              </h2>
              <div className="space-y-8">
                {services.map((service) => (
                  <article key={service.title} className="space-y-2">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {service.title}
                    </h3>
                    <p className="leading-7 text-gray-600 dark:text-gray-400">{service.body}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                  Fractional vs. Agency vs. In-House
                </h2>
                <p className="mt-2 leading-7 text-gray-600 dark:text-gray-400">
                  The common mistake is hiring the wrong way too early. A developer tool startup may
                  need more marketing capacity, but it first needs the right GTM shape: strategy,
                  proof, priorities, and clear ownership.
                </p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="min-w-[760px] divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
                  <thead className="bg-gray-50 text-gray-900 dark:bg-gray-900 dark:text-gray-100">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        What you need
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Agency
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        In-house hire
                      </th>
                      <th scope="col" className="px-4 py-3 font-semibold">
                        Fractional product marketing leader
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-800 dark:bg-gray-950">
                    {comparison.map(([need, agency, inHouse, fractional]) => (
                      <tr key={need}>
                        <th
                          scope="row"
                          className="px-4 py-4 font-semibold text-gray-900 dark:text-gray-100"
                        >
                          {need}
                        </th>
                        <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{agency}</td>
                        <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{inHouse}</td>
                        <td className="px-4 py-4 text-gray-600 dark:text-gray-400">{fractional}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/40">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Something else in mind?
              </h2>
              <p className="mt-3 leading-7 text-gray-600 dark:text-gray-400">
                If you are building a technical product and trying to win a more serious customer
                than the one you started with, I can help turn what you already have into the GTM
                assets buyers need to believe you.
              </p>
            </section>
          </main>

          <aside className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm lg:sticky lg:top-24 dark:border-gray-800 dark:bg-gray-950">
            <div className="mb-6 space-y-2">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
                Talk About Services
              </h2>
              <p className="text-sm leading-6 text-gray-600 dark:text-gray-400">
                Tell me what you are building, what kind of buyer you need to win, and what proof or
                launch work is missing.
              </p>
            </div>
            <ContactForm />
          </aside>
        </div>
      </div>
    </SectionContainer>
  )
}

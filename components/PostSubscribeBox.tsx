import NewsletterForm from './NewsletterForm'
import siteMetadata from '@/data/siteMetadata'

const promisePoints = [
  'One sharp email per issue',
  'Launch analysis, not noise',
  'Easy unsubscribe',
]

function PromiseRow() {
  return (
    <div className="mt-6 grid gap-3 border-t border-gray-950/10 pt-4 text-sm text-gray-600 sm:grid-cols-3 dark:border-white/10 dark:text-gray-300">
      {promisePoints.map((point) => (
        <p key={point} className="text-pretty">
          {point}
        </p>
      ))}
    </div>
  )
}

export default function PostSubscribeBox() {
  if (!siteMetadata.newsletter?.provider) return null

  return (
    <div className="mt-8">
      <div data-uidotsh-pick="Post subscribe box" className="contents">
        <div data-uidotsh-option="Editorial split" className="contents">
          <section className="mx-auto max-w-3xl rounded-[1.75rem] border border-gray-950/10 bg-linear-to-br from-white via-white to-gray-50/80 p-6 text-left sm:p-8 dark:border-white/10 dark:from-gray-950 dark:via-gray-950 dark:to-gray-900/80">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)] lg:items-end">
              <div className="space-y-4">
                <p className="font-mono text-sm tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  Weekly devtools signal
                </p>
                <div className="space-y-3">
                  <h2 className="max-w-[20ch] text-2xl font-semibold tracking-tight text-balance text-gray-950 sm:text-3xl dark:text-white">
                    Get the next issue before the next launch cycle starts.
                  </h2>
                  <p className="max-w-[48ch] text-base text-pretty text-gray-600 dark:text-gray-300">
                    Subscribe for concise breakdowns of product launches, positioning moves, and
                    what smart teams can steal from them.
                  </p>
                </div>
              </div>
              <NewsletterForm
                compact
                title=""
                description=""
                inputId="post-newsletter-editorial"
                className="max-w-none rounded-[1.5rem] border-gray-950/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5"
                formClassName="mt-0 flex-col gap-2 sm:flex-col sm:items-stretch"
                inputClassName="border-0 bg-white text-base ring-1 ring-black/10 dark:bg-gray-950 dark:ring-white/10"
                buttonClassName="w-full"
              />
            </div>
            <PromiseRow />
          </section>
        </div>

        <div data-uidotsh-option="Briefing rail" className="contents" hidden>
          <section className="mx-auto max-w-3xl overflow-hidden rounded-[1.75rem] border border-gray-950/10 bg-white dark:border-white/10 dark:bg-gray-950">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
              <div className="border-b border-gray-950/10 p-6 sm:p-8 lg:border-r lg:border-b-0 dark:border-white/10">
                <p className="font-mono text-sm tracking-wide text-gray-500 uppercase dark:text-gray-400">
                  Editor&apos;s briefing
                </p>
                <h2 className="mt-4 max-w-[18ch] text-2xl font-semibold tracking-tight text-balance text-gray-950 sm:text-3xl dark:text-white">
                  Stay on the short list for every new issue.
                </h2>
                <p className="mt-3 max-w-[46ch] text-base text-pretty text-gray-600 dark:text-gray-300">
                  One email each time a new post or newsletter drops, with the best lessons pulled
                  forward for busy founders and marketers.
                </p>
                <div className="mt-6 grid gap-4 border-t border-gray-950/10 pt-4 sm:grid-cols-3 dark:border-white/10">
                  <div className="sm:pr-4 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-gray-950/10 sm:[&:not(:first-child)]:pl-4 dark:sm:[&:not(:first-child)]:border-white/10">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Cadence</p>
                    <p className="mt-1 text-base font-medium text-gray-950 dark:text-white">
                      Weekly
                    </p>
                  </div>
                  <div className="sm:pr-4 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-gray-950/10 sm:[&:not(:first-child)]:pl-4 dark:sm:[&:not(:first-child)]:border-white/10">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Angle</p>
                    <p className="mt-1 text-base font-medium text-gray-950 dark:text-white">
                      GTM analysis
                    </p>
                  </div>
                  <div className="sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:border-gray-950/10 sm:[&:not(:first-child)]:pl-4 dark:sm:[&:not(:first-child)]:border-white/10">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Noise</p>
                    <p className="mt-1 text-base font-medium text-gray-950 dark:text-white">
                      Very low
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50/80 p-6 sm:p-8 dark:bg-white/5">
                <NewsletterForm
                  compact
                  title="Join the readers who want the signal, not the scroll."
                  description="Drop your email below and the next issue lands in your inbox."
                  inputId="post-newsletter-briefing"
                  className="max-w-none border-0 bg-transparent p-0"
                  titleClassName="max-w-[22ch] text-xl tracking-tight text-balance"
                  descriptionClassName="max-w-[42ch] text-base text-pretty text-gray-600 dark:text-gray-300"
                  inputClassName="border-0 bg-white text-base ring-1 ring-black/10 dark:bg-gray-950 dark:ring-white/10"
                  buttonClassName="w-full sm:w-auto"
                  buttonSize="sm"
                />
              </div>
            </div>
          </section>
        </div>

        <div data-uidotsh-option="Founder's note" className="contents" hidden>
          <section className="mx-auto max-w-3xl rounded-[1.75rem] border border-gray-950/10 bg-linear-to-r from-gray-50 to-white p-6 text-center sm:p-8 dark:border-white/10 dark:from-white/5 dark:to-gray-950">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-gray-950/10 bg-white text-sm font-medium text-gray-700 dark:border-white/10 dark:bg-gray-950 dark:text-gray-200">
              HW
            </div>
            <div className="mx-auto mt-5 max-w-2xl space-y-3">
              <p className="font-mono text-sm tracking-wide text-gray-500 uppercase dark:text-gray-400">
                A quick note from the editor
              </p>
              <h2 className="text-2xl font-semibold tracking-tight text-balance text-gray-950 sm:text-3xl dark:text-white">
                If this post helped, the newsletter will be even more useful.
              </h2>
              <p className="text-base text-pretty text-gray-600 dark:text-gray-300">
                I send one concise email when there&apos;s a new breakdown worth your time. No drip
                sequence. No filler. Just the next sharp idea.
              </p>
            </div>
            <NewsletterForm
              compact
              title=""
              description=""
              inputId="post-newsletter-founder"
              className="mx-auto mt-6 max-w-xl border-0 bg-transparent p-0"
              formClassName="mt-0 flex-col gap-3 sm:flex-row sm:items-center"
              inputClassName="border-0 bg-white text-base ring-1 ring-black/10 dark:bg-gray-950 dark:ring-white/10"
              buttonClassName="sm:min-w-32"
            />
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Subscribe once. Read when there&apos;s something worth reading.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}

import PageTitle from '@/components/PageTitle'
import { genPageMetadata } from 'app/seo'
import NewsletterForm from 'pliny/ui/NewsletterForm'
import siteMetadata from '@/data/siteMetadata'

export const metadata = genPageMetadata({
  title: 'Make Your SaaS AGENT Native',
  description:
    'A roadmap for developer tool product and engineering teams to prepare their tools for AI agents as users.',
})

const AgentChecklistItem = ({ letter, title, children }) => (
  <div className="flex flex-col items-center space-y-4 py-8 md:flex-row md:items-start md:space-y-0 md:space-x-8">
    <div className="border-primary-500 bg-primary-50 text-primary-600 dark:border-primary-400 dark:text-primary-400 mb-4 flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-lg border-2 text-5xl font-bold md:mb-0 dark:bg-gray-800">
      {letter}
    </div>
    <div className="max-w-2xl text-center md:text-left">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400">{children}</p>
    </div>
  </div>
)

const agentChecklistData = [
  {
    letter: 'A',
    title: 'Accessible',
    description:
      'APIs and UIs designed for seamless agent interaction. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Donec vel neque in neque porta venenatis. Integer at justo sit amet massa ultricies tristique et ac neque.',
  },
  {
    letter: 'G',
    title: 'Guardrails',
    description:
      'Implementing robust safety measures, rate limiting, and permission controls. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Curabitur sit amet mauris non magna aliquam tristique. Phasellus vehicula justo et sem convallis, sit amet vulputate massa imperdiet. Nulla facilisi. Cras nec tortor nec elit fermentum egestas. Nam euismod, massa vitae vestibulum finibus, dui tellus pretium purus, in porta orci erat et eros. Sed sit amet purus ac justo tincidunt convallis. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Vivamus quis ex nec justo dictum auctor.',
  },
  {
    letter: 'E',
    title: 'Evals',
    description:
      'Providing comprehensive logs, traces, and metrics for agent behavior analysis. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent vitae eros eget tellus tristique bibendum. Donec rutrum sed sem quis venenatis. Proin viverra risus a eros volutpat tempor. In quis arcu et eros porta lobortis sit amet at magna. Donec feugiat dolor sit amet diam aliquet, sed egestas nisl vehicula. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Integer sit amet ligula a nisl consequat fermentum. Etiam vel risus ipsum. Mauris rhoncus orci sed orci ultricies, non venenatis purus vestibulum.',
  },
  {
    letter: 'N',
    title: 'Notifications',
    description:
      'Facilitating efficient handoffs and notifications between agents and humans. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce vehicula justo nec orci consequat, nec tincidunt nulla hendrerit. Donec aliquam urna eu neque fermentum aliquet. Sed dignissim odio ut purus volutpat, nec scelerisque purus pretium. Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Integer ac tincidunt justo. Ut vel nibh sed lacus condimentum auctor. Duis sit amet metus at ex porta imperdiet non sed sapien.',
  },
  {
    letter: 'T',
    title: 'Testable',
    description:
      'Supporting local development, sandboxes, and staged deployments for thorough testing. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus lacinia velit vitae pretium tristique. Sed ornare, magna sed ultricies cursus, orci erat ultrices lorem, vitae imperdiet ligula urna sit amet elit. Nulla facilisi. Aenean gravida nisl in felis cursus, ut pretium elit bibendum. Vestibulum at purus nec neque efficitur vulputate. Cras tincidunt, mauris non fermentum pulvinar, tellus tortor egestas eros, sed condimentum metus urna id libero. Integer vulputate ante nec dolor luctus, sed placerat lorem semper.',
  },
]

export default function AgentNativePage() {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      <header className="space-y-2 pt-6 pb-8 md:space-y-5">
        <PageTitle>Make Your SaaS AGENT Native</PageTitle>
        <p className="text-lg leading-7 text-gray-500 dark:text-gray-400">
          This page will help product and engineering teams on developer tools actually have a road
          map for what kind of features they need to add into their tools so it could be ready for
          AI agents to be users of the tool.
        </p>
      </header>

      {siteMetadata.newsletter?.provider && (
        <div className="flex items-center justify-center pt-4 pb-8">
          <NewsletterForm />
        </div>
      )}

      <div className="pt-8">
        {agentChecklistData.map((item) => (
          <AgentChecklistItem key={item.letter} letter={item.letter} title={item.title}>
            {item.description}
          </AgentChecklistItem>
        ))}
      </div>

      {siteMetadata.newsletter?.provider && (
        <div className="flex items-center justify-center pt-4">
          <NewsletterForm />
        </div>
      )}
    </div>
  )
}

import Link from './Link'
import siteMetadata from '@/data/siteMetadata'
import SocialIcon from './social-icons'

/**
 * Renders the site footer with author information, copyright notice, site link, and RSS feed link.
 * @returns The footer component
 */
export default function Footer() {
  return (
    <footer role="contentinfo">
      <div className="mt-16 flex flex-col items-center">
        {/* TODO: Add social media links when profiles are ready */}
        {/*
        <div className="mb-3 flex space-x-4">
          {siteMetadata.twitter && (
            <SocialIcon kind="twitter" href={siteMetadata.twitter} size={6} />
          )}
          {siteMetadata.linkedin && (
            <SocialIcon kind="linkedin" href={siteMetadata.linkedin} size={6} />
          )}
        </div>
        */}
        <div className="mb-2 flex flex-wrap justify-center gap-x-2 text-sm text-gray-500 dark:text-gray-400">
          <div>{siteMetadata.author}</div>
          <div className="flex gap-x-2 whitespace-nowrap">
            <span aria-hidden="true">•</span>
            <span>{`© ${new Date().getFullYear()}`}</span>
          </div>
          <div className="flex gap-x-2 whitespace-nowrap">
            <span aria-hidden="true">•</span>
            <Link href="/">{siteMetadata.title}</Link>
          </div>
        </div>
        <div className="mb-2 text-sm text-gray-500 dark:text-gray-400">
          <a
            href={`${process.env.BASE_PATH || ''}/feed.xml`}
            className="underline underline-offset-4 focus-visible:outline-offset-4"
          >
            RSS
          </a>
        </div>
        <div className="mb-8 text-center text-sm text-gray-500 dark:text-gray-400">
          Built with Codex and coffee in North Carolina
        </div>
      </div>
    </footer>
  )
}

import 'css/tailwind.css'
import 'pliny/search/algolia.css'
import 'remark-github-blockquote-alert/alert.css'

import { Space_Grotesk } from 'next/font/google'
import siteMetadata from '@/data/siteMetadata'

const space_grotesk = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-space-grotesk',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={siteMetadata.language} className={space_grotesk.variable} suppressHydrationWarning>
      <body className="bg-white text-black antialiased dark:bg-gray-950 dark:text-white">
        {children}
      </body>
    </html>
  )
}

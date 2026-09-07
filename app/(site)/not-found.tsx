import Link from '@/components/Link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-start justify-start md:mt-24 md:flex-row md:items-center md:justify-center md:space-x-6">
      <div className="space-x-2 pt-6 pb-8 md:space-y-5">
        <h1 className="text-6xl leading-9 font-extrabold tracking-tight text-gray-900 md:border-r-2 md:px-6 md:text-8xl md:leading-14 dark:text-gray-100">
          404
        </h1>
      </div>
      <div className="max-w-md">
        <p className="mb-8 text-xl leading-normal font-bold md:text-2xl">
          This page could not be found. Browse the blog or return home.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/blog"
            className="inline-flex min-h-11 items-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm leading-5 font-medium text-white shadow-xs transition-colors duration-150 hover:bg-blue-700 dark:hover:bg-blue-500"
          >
            Browse blog
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 px-4 py-2 text-sm leading-5 font-medium text-gray-900 transition-colors duration-150 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}

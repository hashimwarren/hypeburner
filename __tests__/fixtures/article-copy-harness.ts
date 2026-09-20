import { build, type Plugin } from 'esbuild'
import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export type FixtureLayout = 'PostSimple' | 'PostBanner'
export const fixtureArticlePath = `blog/日本語/${'nested-segment/'.repeat(16)}article%2Fpart`

// Only unrelated routing, media, newsletter and external comments are replaced.
// Both actual layouts, canonical URL helper, CopyArticleLink and scroll controls are bundled intact.
const adapters: Record<string, string> = {
  '@/components/Comments':
    'export default function Comments(){return <button>Load Comments</button>}',
  '@/components/PostSubscribeBox':
    'export default function Subscribe(){return <button>Subscribe</button>}',
  '@/components/Link':
    'export default function Link({children,...props}){return <a {...props}>{children}</a>}',
  '@/components/Image':
    'export default function Image({alt,className}){return <div role="img" aria-label={alt} className={className} style={{position:"absolute",inset:0}}/>}',
  'pliny/ui/Bleed': 'export default function Bleed({children}){return <div>{children}</div>}',
}
const fixtureAdapters: Plugin = {
  name: 'copy-layout-fixture-adapters',
  setup(builder) {
    builder.onResolve({ filter: /^(@\/components\/|pliny\/ui\/Bleed)/ }, (args) =>
      adapters[args.path] ? { path: args.path, namespace: 'copy-fixture' } : undefined
    )
    builder.onLoad({ filter: /.*/, namespace: 'copy-fixture' }, (args) => ({
      contents: adapters[args.path],
      loader: 'tsx',
      resolveDir: process.cwd(),
    }))
  },
}

export async function createCopyLayoutHarness() {
  const directory = mkdtempSync(join(tmpdir(), 'hypeburner-copy-layouts-'))
  const source = `
    import {useEffect} from 'react';
    import PostSimple from ${JSON.stringify(join(process.cwd(), 'layouts/PostSimple.tsx'))};
    import PostBanner from ${JSON.stringify(join(process.cwd(), 'layouts/PostBanner.tsx'))};
    const post = {
      id: 'copy-fixture', slug: 'copy-fixture', path: ${JSON.stringify(fixtureArticlePath)},
      title: 'Article copy layout fixture', summary: 'Fixture summary', filePath: '',
      date: '2026-05-25T12:00:00.000Z', tags: [], authors: [], images: [], draft: false,
      readingTimeMinutes: 4
    };
    function Fixture({layout}) {
      useEffect(() => { document.body.dataset.hydrated = 'true'; }, []);
      const Layout = layout === 'PostSimple' ? PostSimple : PostBanner;
      return <Layout content={post} prev={{path:'blog/previous',title:'Previous article'}} next={{path:'blog/next',title:'Next article'}}>
        <p>Known fixture prose for the actual alternate article layout.</p>
        <div style={{height:900}} aria-hidden="true" />
      </Layout>;
    }
  `
  const options = {
    bundle: true,
    jsx: 'automatic' as const,
    plugins: [fixtureAdapters],
    define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
    logLevel: 'silent' as const,
  }
  const serverFile = join(directory, 'server.cjs')
  try {
    const [, client] = await Promise.all([
      build({
        ...options,
        stdin: {
          contents: `${source}\nimport {renderToString} from 'react-dom/server'; export const render = (layout) => renderToString(<Fixture layout={layout}/>);`,
          loader: 'tsx',
          resolveDir: process.cwd(),
        },
        platform: 'node',
        format: 'cjs',
        outfile: serverFile,
      }),
      build({
        ...options,
        stdin: {
          contents: `${source}\nimport {hydrateRoot} from 'react-dom/client'; hydrateRoot(document.getElementById('fixture-root'), <Fixture layout={document.body.dataset.layout}/>);`,
          loader: 'tsx',
          resolveDir: process.cwd(),
        },
        platform: 'browser',
        format: 'iife',
        write: false,
      }),
    ])
    const require = createRequire(join(process.cwd(), 'package.json'))
    const server: { render: (layout: FixtureLayout) => string } = require(serverFile)
    return {
      html(layout: FixtureLayout, theme: 'light' | 'dark', stylesheetUrls: string[]) {
        const styles = stylesheetUrls
          .map(
            (url) =>
              `<link rel="stylesheet" href="${url.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}">`
          )
          .join('')
        return `<!doctype html><html class="${theme}"><head><meta name="viewport" content="width=device-width, initial-scale=1">${styles}</head><body data-layout="${layout}" class="bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100"><main id="fixture-root">${server.render(layout)}</main><script>${client.outputFiles[0].text.replace(/<\/script/gi, '<\\/script')}</script></body></html>`
      },
      dispose() {
        rmSync(directory, { recursive: true, force: true })
      },
    }
  } catch (error) {
    rmSync(directory, { recursive: true, force: true })
    throw error
  }
}

/** @jest-environment node */
import { execFileSync } from 'node:child_process'
import { getPayload } from 'payload'
import { getAllPosts, getPostBySlug } from '../lib/cms'
import { buildSearchDocuments } from '../lib/cms/artifacts'

const mockPayload = {
  find: jest.fn(),
} satisfies Pick<Awaited<ReturnType<typeof getPayload>>, 'find'>

jest.mock('react', () => ({ cache: (fn: unknown) => fn }))
jest.mock('github-slugger', () => ({ slug: (value: string) => value.toLowerCase() }))
jest.mock('payload', () => ({ getPayload: jest.fn(async () => mockPayload) }))
jest.mock('../payload.config', () => ({ __esModule: true, default: {} }))
jest.mock('../lib/env', () => ({
  env: {
    hasCmsEnv: true,
    includeDrafts: false,
    PAYLOAD_QUERY_LIMIT: 100,
    PAYLOAD_POSTS_COLLECTION: 'posts',
  },
}))

const cases: [unknown, string][] = [
  [undefined, ''],
  [null, ''],
  ['', ''],
  ['   ', ''],
  [42, ''],
  [['blog/post.mdx'], ''],
  ['blog/post.mdx', 'blog/post.mdx'],
  ['data/blog/post.md', 'blog/post.md'],
  [' data/blog/news/日本語 post.mdx ', 'blog/news/日本語 post.mdx'],
  ['blog/../post.mdx', ''],
  ['blog/./post.mdx', ''],
  ['blog//post.mdx', ''],
  ['blog/%2e%2e/post.mdx', ''],
  ['blog/%252e%252e/post.mdx', ''],
  ['/blog/post.mdx', ''],
  ['https://host/blog/post.mdx', ''],
  ['C:/blog/post.mdx', ''],
  ['blog/name\\post.mdx', ''],
  ['blog/post.mdx?raw=1', ''],
  ['blog/post.mdx#heading', ''],
  ['blog/post.mdx\n', ''],
  ['blog/\ud800.mdx', ''],
  ['blog/.mdx', ''],
  ['blog/post.txt', ''],
]

function document(legacySourcePath: unknown) {
  return {
    id: 'post',
    slug: 'news/post',
    title: 'Post',
    publishedAt: '2026-05-25T12:00:00.000Z',
    status: 'published',
    legacySourcePath,
    filePath: 'blog/stale-fabricated.mdx',
    sourceMarkdown: 'Existing Markdown is not source provenance.',
  }
}

describe('CMS source-path producers', () => {
  const { find } = mockPayload

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it.each(cases)(
    'uses only explicit safe metadata %p in runtime and search',
    async (input, expected) => {
      find.mockResolvedValue({ docs: [document(input)] })
      const all = await getAllPosts()
      const single = await getPostBySlug('news/post')

      expect(all).toHaveLength(1)
      expect(single).toEqual(all[0])
      expect(single).toMatchObject({
        slug: 'news/post',
        path: 'blog/news/post',
        filePath: expected,
        legacySourcePath: expected || undefined,
      })
      // Deliberately reintroduce stale filePath: search must still use explicit metadata only.
      const search = buildSearchDocuments([{ ...all[0], filePath: 'blog/stale-fabricated.mdx' }])
      expect(search[0]).toMatchObject({
        slug: 'news/post',
        path: 'blog/news/post',
        filePath: expected,
      })
      expect(JSON.parse(JSON.stringify(search))[0].filePath).toBe(expected)
      expect(find).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { slug: { equals: 'news/post' } } })
      )
    }
  )

  it('does not coerce object metadata into a source path', async () => {
    find.mockResolvedValue({ docs: [document({ toString: () => 'blog/post.mdx' })] })
    expect(await getPostBySlug('news/post')).toMatchObject({
      filePath: '',
      legacySourcePath: undefined,
    })
  })

  it('runs the real ESM generator mapper with the same cases without querying CMS or generating files', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { readFileSync } from 'node:fs';
         import { normalizePost } from './scripts/generate-cms-artifacts.mjs';
         const docs = JSON.parse(readFileSync(0, 'utf8'));
         console.log(JSON.stringify(docs.map(normalizePost)));`,
      ],
      {
        cwd: process.cwd(),
        input: JSON.stringify(cases.map(([input]) => document(input))),
        encoding: 'utf8',
      }
    )
    const results = JSON.parse(output)
    expect(results).toHaveLength(cases.length)
    results.forEach((result: { filePath: string; path: string; slug: string }, index: number) => {
      expect(result).toMatchObject({
        slug: 'news/post',
        path: 'blog/news/post',
        filePath: cases[index][1],
      })
    })
    expect(getPayload).not.toHaveBeenCalled()
  })
})

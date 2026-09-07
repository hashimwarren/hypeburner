/** @jest-environment node */
import { getPayload } from 'payload'
import { getAllPosts, getPostBySlug } from '../lib/cms'

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

const words = (count: number) => Array(count).fill('word').join(' ')
const text = (value: string) => ({ type: 'text', text: value })
const element = (type: string, children: unknown[]) => ({ type, children })
const richText = (...children: unknown[]) => ({ root: element('root', children) })
const post = {
  id: 'post',
  slug: 'news/post',
  title: 'Title is not the article body',
  publishedAt: '2026-05-25T12:00:00.000Z',
  status: 'published',
  legacySourcePath: 'data/blog/news/post.mdx',
}

const cases: [string, Record<string, unknown>, number | undefined][] = [
  ['short summary', { summary: 'word' }, 1],
  ['200-word summary', { summary: words(200) }, 1],
  ['201-word summary', { summary: words(201) }, 2],
  ['601-word summary', { summary: words(601) }, 4],
  [
    'null body uses summary, not Markdown',
    { content: null, summary: 'word', sourceMarkdown: words(601) },
    1,
  ],
  ['missing body with Markdown only', { sourceMarkdown: words(601) }, undefined],
  ['title only', {}, undefined],
  ['whitespace summary', { summary: ' \n\t ' }, undefined],
  [
    'empty rich text wins over stale fallback text',
    { content: richText(), summary: words(601), sourceMarkdown: words(601) },
    undefined,
  ],
  [
    'whitespace rich text wins over stale fallback text',
    {
      content: richText(element('paragraph', [text(' \n\t ')])),
      summary: words(601),
      sourceMarkdown: words(601),
    },
    undefined,
  ],
  [
    'malformed truthy body does not use fallback text',
    { content: {}, summary: 'word', sourceMarkdown: words(601) },
    undefined,
  ],
  [
    'nested body uses every block, not summary or Markdown',
    {
      content: richText(
        element('heading', [text(words(200))]),
        element('quote', [element('list', [element('listitem', [text(words(401))])])])
      ),
      summary: 'word',
      sourceMarkdown: words(1200),
    },
    4,
  ],
  [
    'inline split word stays joined at boundary',
    {
      content: richText(
        element('paragraph', [text(words(199) + ' read'), element('link', [text('ing')])])
      ),
    },
    1,
  ],
  [
    'adjacent blocks have a word boundary',
    {
      content: richText(
        element('paragraph', [text(words(200))]),
        element('paragraph', [text('word')])
      ),
    },
    2,
  ],
]

beforeEach(() => jest.clearAllMocks())

describe('reading time through public CMS normalization paths', () => {
  it.each(cases)('%s', async (_name, body, expected) => {
    const input = { ...post, ...body }
    const snapshot = JSON.stringify(input)
    mockPayload.find.mockResolvedValue({ docs: [input] })
    const all = await getAllPosts()
    const single = await getPostBySlug(post.slug)

    expect(all).toHaveLength(1)
    expect(single).toEqual(all[0])
    expect(single?.readingTimeMinutes).toBe(expected)
    expect(single).toMatchObject({
      slug: post.slug,
      title: post.title,
      path: 'blog/news/post',
      filePath: 'blog/news/post.mdx',
      legacySourcePath: 'blog/news/post.mdx',
      date: post.publishedAt,
      draft: false,
    })
    expect(single?.content).toBe(body.content)
    expect(single?.sourceMarkdown).toBe(body.sourceMarkdown)
    const serialized = JSON.parse(JSON.stringify(single))
    if (expected === undefined) {
      expect(serialized).not.toHaveProperty('readingTimeMinutes')
    } else {
      expect(serialized.readingTimeMinutes).toBe(expected)
      expect(Number.isInteger(serialized.readingTimeMinutes)).toBe(true)
      expect(serialized.readingTimeMinutes).toBeGreaterThan(0)
    }
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(mockPayload.find).toHaveBeenNthCalledWith(1, {
      collection: 'posts',
      draft: false,
      overrideAccess: true,
      depth: 2,
      limit: 100,
      sort: '-publishedAt',
    })
    expect(mockPayload.find).toHaveBeenNthCalledWith(2, {
      collection: 'posts',
      draft: false,
      overrideAccess: true,
      depth: 2,
      limit: 1,
      where: { slug: { equals: post.slug } },
    })
  })

  it('preserves published-only filtering, order, missing posts and draft exclusion', async () => {
    mockPayload.find.mockResolvedValueOnce({
      docs: [
        { ...post, slug: 'older', summary: 'word' },
        { ...post, slug: 'draft', status: 'draft', summary: words(601) },
        { ...post, slug: 'newer', publishedAt: '2026-06-01T12:00:00.000Z', summary: words(201) },
      ],
    })
    const all = await getAllPosts()
    expect(all.map(({ slug, readingTimeMinutes }) => ({ slug, readingTimeMinutes }))).toEqual([
      { slug: 'newer', readingTimeMinutes: 2 },
      { slug: 'older', readingTimeMinutes: 1 },
    ])
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ ...post, status: 'draft', summary: 'word' }],
    })
    expect(await getPostBySlug(post.slug)).toBeNull()
    mockPayload.find.mockResolvedValueOnce({ docs: [] })
    expect(await getPostBySlug('missing')).toBeNull()
  })
})

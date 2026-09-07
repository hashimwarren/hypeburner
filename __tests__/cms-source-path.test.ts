import normalizeSourcePath from '../lib/cms/source-path'

describe('explicit legacy source paths', () => {
  it.each([
    ['blog/post.mdx', 'blog/post.mdx'],
    ['data/blog/post.md', 'blog/post.md'],
    [' data/blog/news/nested.mdx ', 'blog/news/nested.mdx'],
    ['blog/日本語/hello world.mdx', 'blog/日本語/hello world.mdx'],
  ])('normalizes %p to %p', (input, expected) => {
    expect(normalizeSourcePath(input)).toBe(expected)
  })

  it.each([
    undefined,
    null,
    '',
    '   ',
    false,
    123,
    ['blog/post.mdx'],
    { toString: () => 'blog/post.mdx' },
    'post.mdx',
    'blog/post.txt',
    'blog/.mdx',
    'blog/.md',
    'blog/post.mdx/',
    '/blog/post.mdx',
    '//host/blog/post.mdx',
    'https://host/blog/post.mdx',
    'C:/blog/post.mdx',
    'data/data/blog/post.mdx',
    'blog//post.mdx',
    'blog/./post.mdx',
    'blog/../post.mdx',
    'blog/nested/../../post.mdx',
    'blog/..\\post.mdx',
    'blog/%2e%2e/post.mdx',
    'blog/%252e%252e/post.mdx',
    'blog/hello%20world.mdx',
    'blog/post.mdx?raw=1',
    'blog/post.mdx#heading',
    'blog/name:post.mdx',
    '\nblog/post.mdx',
    'blog/post.mdx\t',
    'blog/po\u0000st.mdx',
    'blog/po\u007fst.mdx',
    'blog/po\u0085st.mdx',
    'blog/\ud800.mdx',
  ])('rejects absent or unsafe metadata %p', (input) => {
    expect(normalizeSourcePath(input)).toBe('')
  })
})

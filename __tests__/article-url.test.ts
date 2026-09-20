import { articleUrl } from '../lib/articleUrl'

const publicOrigin = 'https://hypeburner.com'

describe('articleUrl', () => {
  const originalBasePath = process.env.BASE_PATH
  const originalLocation = window.location.href

  afterEach(() => {
    if (originalBasePath === undefined) delete process.env.BASE_PATH
    else process.env.BASE_PATH = originalBasePath
    window.history.replaceState(null, '', originalLocation)
  })

  it.each([
    [publicOrigin, 'blog/2026-05-25'],
    [publicOrigin, '/blog/2026-05-25'],
    [publicOrigin, '///blog/2026-05-25'],
    [`${publicOrigin}/`, 'blog/2026-05-25'],
    [`${publicOrigin}/`, '/blog/2026-05-25'],
    [`${publicOrigin}///`, '///blog/2026-05-25'],
  ])('joins %s and %s with exactly one boundary slash', (origin, path) => {
    expect(articleUrl(origin, path)).toBe(`${publicOrigin}/blog/2026-05-25`)
  })

  it.each([
    ['/blog/nested/article', '/blog/nested/article'],
    ['/blog/日本語/café', '/blog/日本語/café'],
    ['/blog/%E6%97%A5/caf%C3%A9', '/blog/%E6%97%A5/caf%C3%A9'],
    ['/blog/a%2Fb/%3Fquery%23hash%2520', '/blog/a%2Fb/%3Fquery%23hash%2520'],
    ['/blog/a%2fb/%e6%97%a5', '/blog/a%2fb/%e6%97%a5'],
    ['/blog/nested//article/', '/blog/nested//article/'],
    ['/blog/2026-05-25?utm_source=share#section', '/blog/2026-05-25'],
    ['/blog/2026-05-25#section?utm_source=share', '/blog/2026-05-25'],
    ['/blog/2026-05-25?utm_source=share', '/blog/2026-05-25'],
    ['/blog/2026-05-25#section', '/blog/2026-05-25'],
    ['/blog/a%3Fb%23c?tracking=1#section', '/blog/a%3Fb%23c'],
    ['', '/'],
    ['/', '/'],
  ])('preserves path characters and removes only literal suffixes: %s', (path, expected) => {
    expect(articleUrl(publicOrigin, path)).toBe(`${publicOrigin}${expected}`)
  })

  it.each([
    ['https://hypeburner.com/base/?tracking=1#section', publicOrigin],
    ['https://hypeburner.com:8443/', 'https://hypeburner.com:8443'],
    ['http://hypeburner.com/', 'http://hypeburner.com'],
  ])('uses only the explicitly configured origin of %s', (configuredSite, expectedOrigin) => {
    expect(articleUrl(configuredSite, '/blog/2026-05-25')).toBe(`${expectedOrigin}/blog/2026-05-25`)
  })

  it('ignores the browsing origin, query, fragment, and extra BASE_PATH', () => {
    window.history.replaceState(null, '', '/preview?utm_source=preview#section')
    process.env.BASE_PATH = '/already-in-path'
    expect(window.location.origin).not.toBe(publicOrigin)
    expect(articleUrl(publicOrigin, '/already-in-path/blog/2026-05-25')).toBe(
      `${publicOrigin}/already-in-path/blog/2026-05-25`
    )
    expect(articleUrl(publicOrigin, '/blog/2026-05-25')).toBe(
      'https://hypeburner.com/blog/2026-05-25'
    )
  })
})

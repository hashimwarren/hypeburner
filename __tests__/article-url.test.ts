import { articleUrl } from '../lib/articleUrl'

const publicOrigin = 'https://hypeburner.com'

describe('articleUrl for raw CMS paths', () => {
  it.each([
    [publicOrigin, 'blog/2026-05-25'],
    [publicOrigin, '/blog/2026-05-25'],
    [publicOrigin, '///blog/2026-05-25'],
    [`${publicOrigin}/`, 'blog/2026-05-25'],
    [`${publicOrigin}/`, '/blog/2026-05-25'],
    [`${publicOrigin}///`, '///blog/2026-05-25'],
  ])('joins %s and %s with exactly one boundary slash', (siteUrl, path) => {
    expect(articleUrl(siteUrl, path)).toBe(`${publicOrigin}/blog/2026-05-25`)
  })

  it.each([
    ['blog/nested/article', '/blog/nested/article'],
    ['blog/日本語/café', '/blog/%E6%97%A5%E6%9C%AC%E8%AA%9E/caf%C3%A9'],
    ['blog/question?part', '/blog/question%3Fpart'],
    ['blog/hash#part', '/blog/hash%23part'],
    ['blog/100%complete', '/blog/100%25complete'],
    ['blog/a?b#c%d', '/blog/a%3Fb%23c%25d'],
    ['blog/literal%2Fescape', '/blog/literal%252Fescape'],
    ['blog/a%3Fb%23c', '/blog/a%253Fb%2523c'],
    ['blog/space here', '/blog/space%20here'],
    ['blog/nested//article/', '/blog/nested//article/'],
    ['', '/'],
    ['/', '/'],
  ])(
    'encodes raw path data without treating reserved characters as URL suffixes: %s',
    (path, expected) => {
      const result = articleUrl(publicOrigin, path)
      expect(result).toBe(`${publicOrigin}${expected}`)
      expect(new URL(result).search).toBe('')
      expect(new URL(result).hash).toBe('')
    }
  )

  it.each([
    [publicOrigin, '/notes', '/notes/blog/article'],
    [publicOrigin, 'notes/', '/notes/blog/article'],
    [publicOrigin, '///notes///', '/notes/blog/article'],
    [`${publicOrigin}/notes/`, undefined, '/notes/blog/article'],
    [`${publicOrigin}/notes/`, '', '/notes/blog/article'],
    [`${publicOrigin}/notes/`, '/notes', '/notes/blog/article'],
    [`${publicOrigin}/notes/`, '/other', '/other/blog/article'],
    [`${publicOrigin}/notes/`, '/', '/blog/article'],
    [`${publicOrigin}/reader%20notes/`, undefined, '/reader%20notes/blog/article'],
    [publicOrigin, '/blog', '/blog/blog/article'],
  ])('uses one configured deployment prefix for %s and %s', (siteUrl, basePath, expected) => {
    expect(articleUrl(siteUrl, 'blog/article', basePath)).toBe(`${publicOrigin}${expected}`)
  })

  it.each([
    [
      'https://hypeburner.com/notes/?tracking=1#section',
      'https://hypeburner.com/notes/blog/article',
    ],
    ['https://hypeburner.com:8443/', 'https://hypeburner.com:8443/blog/article'],
    ['http://hypeburner.com/', 'http://hypeburner.com/blog/article'],
  ])('uses the public site configuration of %s', (siteUrl, expected) => {
    expect(articleUrl(siteUrl, 'blog/article')).toBe(expected)
  })

  it('never uses the browsing origin, query or fragment', () => {
    const originalLocation = window.location.href
    try {
      window.history.replaceState(null, '', '/preview?utm_source=preview#section')
      expect(window.location.origin).not.toBe(publicOrigin)
      expect(articleUrl(publicOrigin, 'blog/article?question#heading%percent', '/notes')).toBe(
        `${publicOrigin}/notes/blog/article%3Fquestion%23heading%25percent`
      )
    } finally {
      window.history.replaceState(null, '', originalLocation)
    }
  })
})

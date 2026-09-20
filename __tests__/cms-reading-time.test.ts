import readingTime from 'reading-time'
import { extractLexicalText, getReadingTimeMinutes } from '../lib/cms/reading-time'

function text(value: unknown) {
  return { type: 'text', text: value }
}

function element(type: string, children: unknown[]) {
  return { type, children }
}

function document(...children: unknown[]) {
  return { root: element('root', children) }
}

function words(count: number) {
  return Array(count).fill('word').join(' ')
}

describe('extractLexicalText', () => {
  it('reads the complete nested body in document order', () => {
    const content = document(
      element('heading', [text('Heading')]),
      element('paragraph', [text('A '), element('link', [text('linked')]), text(' paragraph')]),
      element('quote', [
        element('paragraph', [text('Quoted')]),
        element('list', [
          element('listitem', [text('First')]),
          element('listitem', [
            text('Second'),
            element('list', [element('listitem', [text('Nested')])]),
          ]),
        ]),
      ]),
      element('paragraph', [text('Last')])
    )

    expect(extractLexicalText(content)).toBe(
      'Heading A linked paragraph Quoted First Second Nested Last'
    )
  })

  it('concatenates inline formatting and links without inventing word boundaries', () => {
    const content = document(
      element('paragraph', [
        text('read'),
        { ...text('ing'), format: 1 },
        element('link', [text('-time')]),
        text(' esti'),
        element('autolink', [{ ...text('mate'), format: 2 }]),
      ])
    )

    expect(extractLexicalText(content)).toBe('reading-time estimate')
  })

  it.each([
    'paragraph',
    'heading',
    'quote',
    'list',
    'listitem',
    'code',
    'table',
    'tablerow',
    'tablecell',
    'block',
  ])('separates %s blocks from surrounding text', (type) => {
    expect(
      extractLexicalText(document(text('before'), element(type, [text('inside')]), text('after')))
    ).toBe('before inside after')
  })

  it('separates line breaks, tabs and horizontal rules', () => {
    expect(
      extractLexicalText(
        document(
          element('paragraph', [
            text('one'),
            { type: 'linebreak' },
            text('two'),
            { type: 'tab' },
            text('three'),
          ]),
          { type: 'horizontalrule' },
          element('paragraph', [text('four')])
        )
      )
    ).toBe('one two three four')
  })

  it('preserves inline code-highlight text and traverses nested wrapper children', () => {
    let nested = element('custom-wrapper', [text('deep')])
    for (let depth = 0; depth < 100; depth++) {
      nested = element('custom-wrapper', [nested])
    }

    expect(
      extractLexicalText(
        document(nested, element('code', [{ type: 'code-highlight', text: 'con' }, text('st')]))
      )
    ).toBe('deep const')
  })

  it('ignores metadata, URLs, media fields and text on non-text nodes', () => {
    const content = {
      ...document(
        {
          ...element('paragraph', [
            text('Visible '),
            {
              ...element('link', [text('label')]),
              fields: { url: 'hidden-url', text: 'hidden fields' },
              url: 'hidden-url',
              text: 'hidden link text',
            },
          ]),
          text: 'hidden paragraph text',
          metadata: document(text('hidden metadata')),
        },
        {
          type: 'upload',
          text: 'hidden upload text',
          value: {
            id: 123,
            title: 'hidden title',
            alt: 'hidden alt',
            children: [text('hidden media')],
          },
        },
        { type: 'relationship', value: { title: 'hidden relationship' } }
      ),
      text: 'hidden document text',
      metadata: document(text('hidden document metadata')),
    }

    expect(extractLexicalText(content)).toBe('Visible label')
  })

  it.each([
    undefined,
    null,
    false,
    0,
    'plain text',
    [],
    {},
    { root: null },
    { root: 'text' },
    { root: [] },
  ])('omits absent or malformed documents: %p', (content) => {
    expect(extractLexicalText(content)).toBe('')
  })

  it('skips malformed nodes and non-string text without losing valid siblings', () => {
    const content = document(
      null,
      false,
      42,
      'hidden string',
      [text('hidden array')],
      { children: 'hidden children' },
      { type: 'paragraph', children: { text: 'hidden object' } },
      element('paragraph', [
        text('kept'),
        text(null),
        text(123),
        text({ text: 'hidden' }),
        text(['hidden']),
      ]),
      element('paragraph', [text('also kept')])
    )

    expect(extractLexicalText(content)).toBe('kept also kept')
  })

  it('normalizes whitespace without splitting adjacent inline text', () => {
    expect(
      extractLexicalText(document(element('paragraph', [text(' \t a\u00a0b\n'), text('c ')])))
    ).toBe('a b c')
    expect(extractLexicalText(document(element('paragraph', [text('\t\n\u00a0 ')])))).toBe('')
  })
})

describe('getReadingTimeMinutes', () => {
  it.each([
    [1, 1],
    [200, 1],
    [201, 2],
    [601, 4],
  ])('estimates %i words as %i minutes using the installed package', (count, expected) => {
    const body = words(count)

    expect(readingTime(body).minutes).toBe(count / 200)
    expect(getReadingTimeMinutes({ summary: body })).toBe(expected)
    expect(getReadingTimeMinutes({ content: document(element('paragraph', [text(body)])) })).toBe(
      expected
    )
  })

  it('ceilings fractional minutes instead of using the package display text', () => {
    expect(readingTime(words(201)).text).toBe('1 min read')
    expect(getReadingTimeMinutes({ summary: words(201) })).toBe(2)
  })

  it('selects the full rich body only, ignoring differing summary and Markdown', () => {
    const content = document(
      element('paragraph', [text(words(200))]),
      element('quote', [element('list', [element('listitem', [text(words(401))])])])
    )

    expect(
      getReadingTimeMinutes({
        content,
        summary: words(201),
        sourceMarkdown: words(1200),
        title: 'Title',
      })
    ).toBe(4)
  })

  it('keeps inline split words together at the rounding boundary', () => {
    const content = document(
      element('paragraph', [text(`${words(199)} read`), { ...text('ing'), format: 1 }])
    )

    expect(getReadingTimeMinutes({ content })).toBe(1)
  })

  it.each(['paragraph', 'linebreak'])(
    'keeps %s-separated words apart at the rounding boundary',
    (type) => {
      const children =
        type === 'paragraph'
          ? [element('paragraph', [text(words(200))]), element('paragraph', [text('last')])]
          : [element('paragraph', [text(words(200)), { type: 'linebreak' }, text('last')])]

      expect(getReadingTimeMinutes({ content: document(...children) })).toBe(2)
    }
  )

  it.each([
    document(),
    document(element('paragraph', [])),
    document(element('paragraph', [text(' \t\n\u00a0 ')])),
    {},
    [],
    { root: null },
    { root: { children: 'malformed' } },
    'malformed rich text',
    true,
    1,
  ])('omits truthy empty or malformed content without falling back: %p', (content) => {
    expect(
      getReadingTimeMinutes({
        content,
        summary: words(201),
        sourceMarkdown: words(601),
        title: 'Title',
      })
    ).toBeUndefined()
  })

  it.each([undefined, null, false, 0, ''])(
    'selects summary alone for falsy content: %p',
    (content) => {
      expect(
        getReadingTimeMinutes({
          content,
          summary: words(201),
          sourceMarkdown: words(601),
          title: words(800),
        })
      ).toBe(2)
      expect(
        getReadingTimeMinutes({ content, sourceMarkdown: words(601), title: words(800) })
      ).toBeUndefined()
    }
  )

  it.each([undefined, null, '', ' \t\n\u00a0 ', 123, false, {}, ['not summary text']])(
    'omits missing or unusable summary despite Markdown/title: %p',
    (summary) => {
      expect(
        getReadingTimeMinutes({ summary, sourceMarkdown: words(601), title: words(800) })
      ).toBeUndefined()
    }
  )

  it.each([undefined, null, false, 42, 'not a post', [], {}])(
    'tolerates absent or malformed posts: %p',
    (post) => {
      expect(getReadingTimeMinutes(post)).toBeUndefined()
    }
  )

  it('handles Unicode whitespace in summary with the same word boundaries as rich text', () => {
    expect(getReadingTimeMinutes({ summary: words(201).replace(/ /g, '\u00a0') })).toBe(2)
  })

  it('does not mutate its input', () => {
    const post = {
      content: document(element('paragraph', [text('A short body')])),
      summary: 'Unused summary',
      sourceMarkdown: 'Unused Markdown',
    }
    const original = JSON.stringify(post)

    expect(getReadingTimeMinutes(post)).toBe(1)
    expect(JSON.stringify(post)).toBe(original)
  })
})

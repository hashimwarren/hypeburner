import readingTime from 'reading-time'

const blockTypes = new Set([
  'root',
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
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function extractNodeText(node: unknown): string {
  if (!isRecord(node)) return ''

  if (node.type === 'linebreak' || node.type === 'horizontalrule') return '\n'
  if (node.type === 'tab') return '\t'
  if (node.type === 'text' || node.type === 'code-highlight') {
    return typeof node.text === 'string' ? node.text : ''
  }

  const text = Array.isArray(node.children) ? node.children.map(extractNodeText).join('') : ''
  return typeof node.type === 'string' && blockTypes.has(node.type) ? `\n${text}\n` : text
}

export function extractLexicalText(content: unknown): string {
  if (!isRecord(content)) return ''

  return extractNodeText(content.root).replace(/\s+/g, ' ').trim()
}

export function getReadingTimeMinutes(post: unknown): number | undefined {
  if (!isRecord(post)) return undefined

  // Match the article renderer: an empty but truthy rich-text body still wins over summary.
  const text = post.content
    ? extractLexicalText(post.content)
    : typeof post.summary === 'string'
      ? post.summary.replace(/\s+/g, ' ').trim()
      : ''

  if (!text) return undefined

  return Math.max(1, Math.ceil(readingTime(text).minutes))
}

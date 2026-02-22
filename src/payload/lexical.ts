function textNode(text: string) {
  return {
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  }
}

function paragraphNode(text: string) {
  return {
    children: [textNode(text)],
    direction: null,
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
    textFormat: 0,
    textStyle: '',
  }
}

export function markdownToLexical(markdown: string) {
  const normalized = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .trim()
  const blocks = normalized ? normalized.split(/\n{2,}/) : ['']

  return {
    root: {
      children: blocks.map((block) => paragraphNode(block)),
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  }
}

export function lexicalToPlainText(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const root = (value as { root?: { children?: Array<{ children?: Array<{ text?: string }> }> } })
    .root
  const blocks = root?.children || []

  return blocks
    .map((node) =>
      Array.isArray(node.children) ? node.children.map((child) => child?.text || '').join('') : ''
    )
    .join('\n\n')
    .trim()
}

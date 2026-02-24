import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import type { SanitizedServerEditorConfig } from '@payloadcms/richtext-lexical'
import type { Payload, SanitizedConfig } from 'payload'

const editorConfigCache = new WeakMap<SanitizedConfig, Promise<SanitizedServerEditorConfig>>()

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

function markdownToLexicalFallback(markdown: string) {
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

async function getEditorConfig(payload: Payload): Promise<SanitizedServerEditorConfig | null> {
  const config = payload.config as SanitizedConfig
  let pending = editorConfigCache.get(config)

  if (!pending) {
    pending = editorConfigFactory.default({ config })
    editorConfigCache.set(config, pending)
  }

  try {
    return await pending
  } catch (error) {
    console.warn('[payload] failed to resolve lexical editor config', error)
    return null
  }
}

export async function markdownToLexical(markdown: string, payload?: Payload) {
  const normalized = String(markdown || '')
    .replace(/\r\n/g, '\n')
    .trim()

  if (!payload) {
    return markdownToLexicalFallback(normalized)
  }

  const editorConfig = await getEditorConfig(payload)
  if (!editorConfig) {
    return markdownToLexicalFallback(normalized)
  }

  try {
    return convertMarkdownToLexical({
      editorConfig,
      markdown: normalized,
    })
  } catch (error) {
    console.warn('[payload] failed to convert markdown to lexical', error)
    return markdownToLexicalFallback(normalized)
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

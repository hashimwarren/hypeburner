import { createElement, type ReactNode } from 'react'

type LexicalNode = {
  type?: string
  tag?: string
  text?: string
  children?: LexicalNode[]
}

type Props = {
  content: unknown
}

function renderChildren(children: LexicalNode[] | undefined, keyPrefix: string): ReactNode {
  if (!Array.isArray(children)) return null
  return children.map((child, i) => renderNode(child, `${keyPrefix}-${i}`))
}

function renderNode(node: LexicalNode, key: string): ReactNode {
  if (!node || typeof node !== 'object') return null

  if (node.type === 'text') return <span key={key}>{node.text || ''}</span>

  const children = renderChildren(node.children, key)

  if (node.type === 'paragraph') return <p key={key}>{children}</p>
  if (node.type === 'heading') {
    const validTags = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
    const tag = validTags.has(String(node.tag || '').toLowerCase()) ? String(node.tag).toLowerCase() : 'h2'
    return createElement(tag, { key }, children)
  }
  if (node.type === 'quote') return <blockquote key={key}>{children}</blockquote>
  if (node.type === 'list') return node.tag === 'ol' ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>
  if (node.type === 'listitem') return <li key={key}>{children}</li>
  if (node.type === 'code') return <pre key={key}><code>{children}</code></pre>
  if (node.type === 'link') return <a key={key}>{children}</a>

  return <>{children}</>
}

export default function LexicalContent({ content }: Props) {
  const root = (content as { root?: { children?: LexicalNode[] } })?.root
  if (!root?.children || !Array.isArray(root.children)) return null
  return <>{renderChildren(root.children, 'lex')}</>
}

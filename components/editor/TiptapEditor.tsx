'use client'

import React, { useEffect, useRef } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import type { Editor } from '@tiptap/react'
import LinkMark from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
// Lightweight JSON -> Markdown serializer for common nodes/marks

import { Button } from '@/components/ui/button'

export type TiptapEditorProps = {
  initialMarkdown?: string
  placeholder?: string
  onUpdateMarkdown?: (markdown: string) => void
}

// Simple toolbar actions
const ToolbarButton: React.FC<{ onClick: () => void; active?: boolean; label: string }> = ({
  onClick,
  active,
  label,
}) => (
  <Button
    type="button"
    variant={active ? 'default' : 'secondary'}
    className="h-8 px-2 text-xs"
    onClick={onClick}
  >
    {label}
  </Button>
)

type JSONMark = { type: string; attrs?: Record<string, unknown> }
type JSONNode = {
  type: string
  text?: string
  marks?: JSONMark[]
  content?: JSONNode[]
  attrs?: Record<string, unknown>
}

function renderText(node: JSONNode): string {
  let text = node.text ?? ''
  const marks = node.marks ?? []
  // Apply marks inner-most last
  if (marks.find((m) => m.type === 'code')) text = `\`${text}\``
  if (marks.find((m) => m.type === 'strike')) text = `~~${text}~~`
  if (marks.find((m) => m.type === 'italic')) text = `*${text}*`
  if (marks.find((m) => m.type === 'bold')) text = `**${text}**`
  const link = marks.find((m) => m.type === 'link')
  if (link?.attrs && typeof link.attrs['href'] === 'string') {
    const href = String(link.attrs['href'])
    text = `[${text}](${href})`
  }
  return text
}

function serializeNode(node: JSONNode, orderedIndex = 1): string {
  switch (node.type) {
    case 'text':
      return renderText(node)
    case 'paragraph':
      return (node.content ?? []).map((n) => serializeNode(n)).join('')
    case 'heading': {
      const level = (node.attrs?.level as number) || 1
      const hashes = '#'.repeat(Math.min(6, Math.max(1, level)))
      return `${hashes} ${(node.content ?? []).map((n) => serializeNode(n)).join('')}`
    }
    case 'bulletList':
      return (node.content ?? [])
        .map((li) => `- ${(li.content ?? []).map((n) => serializeNode(n)).join('')}`)
        .join('\n')
    case 'orderedList': {
      let idx = (node.attrs?.start as number) || 1
      return (node.content ?? [])
        .map((li) => `${idx++}. ${(li.content ?? []).map((n) => serializeNode(n)).join('')}`)
        .join('\n')
    }
    case 'listItem':
      return (node.content ?? []).map((n) => serializeNode(n)).join('')
    case 'blockquote': {
      const inner = (node.content ?? [])
        .map((n) => serializeNode(n))
        .join('\n')
        .split('\n')
        .map((l) => `> ${l}`)
        .join('\n')
      return inner
    }
    case 'codeBlock': {
      const code = (node.content ?? []).map((n) => (n.text ? n.text : serializeNode(n))).join('')
      return ['```', code, '```'].join('\n')
    }
    case 'horizontalRule':
      return '---'
    case 'hardBreak':
      return '\n'
    case 'image': {
      const src = String(node.attrs?.['src'] ?? '')
      const alt = String(node.attrs?.['alt'] ?? '')
      return `![${alt}](${src})`
    }
    default:
      return (node.content ?? []).map((n) => serializeNode(n)).join('')
  }
}

function toMarkdown(editor: Editor | null): string {
  if (!editor) return ''
  const json = editor.getJSON() as JSONNode
  const body = (json.content ?? []).map((n) => serializeNode(n)).join('\n\n')
  return body.trim()
}

// --- Minimal Markdown -> TipTap JSON parser ---
function parseInline(text: string): JSONNode[] {
  const nodes: JSONNode[] = []
  const i = 0
  // Helper to push plain text
  const pushText = (t: string, marks: JSONMark[] = []) => {
    if (!t) return
    nodes.push({ type: 'text', text: t, marks: marks.length ? marks : undefined })
  }
  // Simple tokenization for links/images first
  // We'll split by images and links and then process bold/italic/code inside remaining text
  const imgLinkRegex = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  for (const match of text.matchAll(imgLinkRegex)) {
    const m = match[0]
    const start = match.index ?? 0
    const before = text.slice(last, start)
    if (before) nodes.push(...processInlineMarks(before))
    if (m.startsWith('![')) {
      const alt = m.slice(2, m.indexOf(']'))
      const url = m.slice(m.indexOf('(') + 1, m.lastIndexOf(')'))
      nodes.push({ type: 'image', attrs: { src: url, alt } })
    } else {
      const label = m.slice(1, m.indexOf(']'))
      const url = m.slice(m.indexOf('(') + 1, m.lastIndexOf(')'))
      // link mark applied to label
      nodes.push(...processInlineMarks(label, [{ type: 'link', attrs: { href: url } }]))
    }
    last = start + m.length
  }
  const rest = text.slice(last)
  if (rest) nodes.push(...processInlineMarks(rest))
  return nodes
}

function processInlineMarks(input: string, prependMarks: JSONMark[] = []): JSONNode[] {
  // Handle code `code`
  const segments: { text: string; code?: boolean }[] = []
  let current = ''
  let inCode = false
  for (let i = 0; i < input.length; i++) {
    if (input[i] === '`') {
      segments.push({ text: current, code: inCode })
      current = ''
      inCode = !inCode
    } else {
      current += input[i]
    }
  }
  segments.push({ text: current, code: inCode })
  const out: JSONNode[] = []
  for (const seg of segments) {
    if (seg.code) {
      out.push({ type: 'text', text: seg.text, marks: [...prependMarks, { type: 'code' }] })
    } else {
      // bold **text**, italic *text*, strike ~~text~~
      // naive nested handling: replace tokens sequentially
      const pushMarked = (t: string, markType: string) => ({
        type: 'text',
        text: t,
        marks: [...prependMarks, { type: markType }],
      })
      let s = seg.text
      const boldRegex = /\*\*([^*]+)\*\*/g
      const strikeRegex = /~~([^~]+)~~/g
      const italicRegex = /\*([^*]+)\*/g
      // split by bold first
      let last = 0
      for (const m of s.matchAll(boldRegex)) {
        const start = m.index ?? 0
        const before = s.slice(last, start)
        if (before)
          out.push({
            type: 'text',
            text: before,
            marks: prependMarks.length ? [...prependMarks] : undefined,
          })
        out.push(pushMarked(m[1], 'bold'))
        last = start + m[0].length
      }
      s = s.slice(last)
      // then strike
      last = 0
      for (const m of s.matchAll(strikeRegex)) {
        const start = m.index ?? 0
        const before = s.slice(last, start)
        if (before)
          out.push({
            type: 'text',
            text: before,
            marks: prependMarks.length ? [...prependMarks] : undefined,
          })
        out.push(pushMarked(m[1], 'strike'))
        last = start + m[0].length
      }
      s = s.slice(last)
      // then italic
      last = 0
      for (const m of s.matchAll(italicRegex)) {
        const start = m.index ?? 0
        const before = s.slice(last, start)
        if (before)
          out.push({
            type: 'text',
            text: before,
            marks: prependMarks.length ? [...prependMarks] : undefined,
          })
        out.push(pushMarked(m[1], 'italic'))
        last = start + m[0].length
      }
      const tail = s.slice(last)
      if (tail)
        out.push({
          type: 'text',
          text: tail,
          marks: prependMarks.length ? [...prependMarks] : undefined,
        })
    }
  }
  return out
}

function parseMarkdown(md?: string): JSONNode[] | undefined {
  if (!md) return undefined
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: JSONNode[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // code fence
    if (/^```/.test(line)) {
      i++
      const codeLines: string[] = []
      while (i < lines.length && !/^```/.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      // skip closing ```
      if (i < lines.length && /^```/.test(lines[i])) i++
      blocks.push({ type: 'codeBlock', content: [{ type: 'text', text: codeLines.join('\n') }] })
      continue
    }
    // hr
    if (/^---$/.test(line.trim())) {
      blocks.push({ type: 'horizontalRule' })
      i++
      continue
    }
    // heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      blocks.push({ type: 'heading', attrs: { level: h[1].length }, content: parseInline(h[2]) })
      i++
      continue
    }
    // blockquote
    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''))
        i++
      }
      const inner = quote.join('\n')
      blocks.push({
        type: 'blockquote',
        content: [{ type: 'paragraph', content: parseInline(inner) }],
      })
      continue
    }
    // lists
    if (/^\s*[-*]\s+/.test(line)) {
      const items: JSONNode[] = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        const text = lines[i].replace(/^\s*[-*]\s+/, '')
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(text) }],
        })
        i++
      }
      blocks.push({ type: 'bulletList', content: items })
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: JSONNode[] = []
      let start = 1
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)(\d+)\.\s+(.*)$/)
        const text = m ? m[3] : lines[i].replace(/^\s*\d+\.\s+/, '')
        if (m) start = parseInt(m[2], 10)
        items.push({
          type: 'listItem',
          content: [{ type: 'paragraph', content: parseInline(text) }],
        })
        i++
      }
      blocks.push({ type: 'orderedList', attrs: { start }, content: items })
      continue
    }
    // blank lines -> paragraph break
    if (!line.trim()) {
      i++
      continue
    }
    // paragraph (gather until blank)
    const para: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim()) {
      para.push(lines[i])
      i++
    }
    blocks.push({ type: 'paragraph', content: parseInline(para.join(' ')) })
  }
  return blocks
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  initialMarkdown,
  placeholder = 'Start writing…',
  onUpdateMarkdown,
}) => {
  // For simplicity, ignore initialMarkdown parsing on first construct; we'll set content via effect.
  const content = undefined
  const skipUpdateRef = useRef(false)

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({}),
      Placeholder.configure({ placeholder }),
      LinkMark.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image,
    ],
    content,
    onUpdate: ({ editor }) => {
      if (skipUpdateRef.current) return
      const md = toMarkdown(editor)
      onUpdateMarkdown?.(md)
    },
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[240px]',
      },
    },
  })

  useEffect(() => {
    return () => {
      editor?.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Emit initial markdown once editor is ready
  useEffect(() => {
    if (editor && onUpdateMarkdown && !skipUpdateRef.current) {
      onUpdateMarkdown(toMarkdown(editor))
    }
  }, [editor, onUpdateMarkdown])

  // Update editor content when initialMarkdown changes
  useEffect(() => {
    if (!editor) return
    if (typeof initialMarkdown !== 'string') return
    const next = initialMarkdown.trim()
    const current = toMarkdown(editor)
    if (next === current) return
    const docContent = parseMarkdown(next)
    // Prevent echo via onUpdate
    skipUpdateRef.current = true
    if (docContent && docContent.length > 0) {
      editor.commands.setContent({ type: 'doc', content: docContent })
    } else {
      editor.commands.clearContent()
    }
    setTimeout(() => {
      skipUpdateRef.current = false
    }, 0)
  }, [initialMarkdown, editor])

  return (
    <div className="w-full">
      <div className="bg-background flex flex-wrap gap-2 rounded-md border p-2">
        {/* Toolbar Buttons */}
        <ToolbarButton
          label="Bold"
          active={editor?.isActive('bold')}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          active={editor?.isActive('italic')}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Strike"
          active={editor?.isActive('strike')}
          onClick={() => editor?.chain().focus().toggleStrike().run()}
        />
        <ToolbarButton
          label="Bullet List"
          active={editor?.isActive('bulletList')}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Ordered List"
          active={editor?.isActive('orderedList')}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Code Block"
          active={editor?.isActive('codeBlock')}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        />
        <ToolbarButton
          label="H1"
          active={editor?.isActive('heading', { level: 1 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarButton
          label="H2"
          active={editor?.isActive('heading', { level: 2 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarButton
          label="H3"
          active={editor?.isActive('heading', { level: 3 })}
          onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarButton
          label="HR"
          onClick={() => editor?.chain().focus().setHorizontalRule().run()}
        />
        <ToolbarButton
          label="Link"
          active={editor?.isActive('link')}
          onClick={() => {
            const url = window.prompt('Enter URL')
            if (!url || !editor) return
            if (editor.state.selection.empty) {
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'text',
                  text: url,
                  marks: [{ type: 'link', attrs: { href: url } }],
                })
                .run()
            } else {
              editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
            }
          }}
        />
        <ToolbarButton label="Unlink" onClick={() => editor?.chain().focus().unsetLink().run()} />
        <ToolbarButton
          label="Image"
          onClick={() => {
            const input = document.getElementById('tiptap-image-input') as HTMLInputElement | null
            input?.click()
          }}
        />
      </div>
      <div className="bg-background mt-2 rounded-md border p-3">
        <EditorContent editor={editor} data-testid="tiptap-editor" />
        <input
          id="tiptap-image-input"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file || !editor) return
            const alt = window.prompt('Alt text (optional)') || ''
            const form = new FormData()
            form.append('file', file)
            if (alt) form.append('alt', alt)
            try {
              const res = await fetch('/api/editor/upload', { method: 'POST', body: form })
              const data = (await res.json()) as { ok?: boolean; src?: string; error?: string }
              if (!res.ok || !data.ok || !data.src) throw new Error(data.error || 'Upload failed')
              editor.chain().focus().setImage({ src: data.src, alt }).run()
            } catch (err) {
              alert((err as Error).message)
            } finally {
              e.currentTarget.value = ''
            }
          }}
        />
      </div>
    </div>
  )
}

export default TiptapEditor

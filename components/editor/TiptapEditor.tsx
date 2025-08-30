'use client'

import React, { useEffect, useMemo } from 'react'
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

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  initialMarkdown,
  placeholder = 'Start writing…',
  onUpdateMarkdown,
}) => {
  // For simplicity, ignore initialMarkdown parsing; start empty.
  const content = undefined

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
    if (editor && onUpdateMarkdown) {
      onUpdateMarkdown(toMarkdown(editor))
    }
  }, [editor, onUpdateMarkdown])

  return (
    <div className="w-full">
      <div className="bg-background flex flex-wrap gap-2 rounded-md border p-2">
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

/** @jest-environment jsdom */
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import { getMarkdownFromEditor, setMarkdownContent } from '@/components/editor/markdown'

describe('markdown helpers', () => {
  test('sets markdown and reads it back (round-trip basics)', () => {
    const editor = new Editor({
      extensions: [StarterKit, Markdown.configure({})],
    })

    const md1 = `# Hello\n\nThis is **bold**.\n\n- a\n- b\n`
    setMarkdownContent(editor, md1)
    const out1 = getMarkdownFromEditor(editor)
    expect(out1).toContain('# Hello')
    expect(out1).toMatch(/This is \*\*bold\*\*/) // normalized markdown keeps bold
    expect(out1).toMatch(/- a/)
    expect(out1).toMatch(/- b/)

    const md2 = `## Title\n\n1. one\n2. two\n`
    setMarkdownContent(editor, md2)
    const out2 = getMarkdownFromEditor(editor)
    expect(out2).toContain('## Title')
    expect(out2).toMatch(/1\. one/)
    expect(out2).toMatch(/2\. two/)
  })

  test('handles empty and whitespace-only markdown', () => {
    const editor = new Editor({
      extensions: [StarterKit, Markdown.configure({})],
    })
    setMarkdownContent(editor, '')
    expect(getMarkdownFromEditor(editor)).toBe('')

    setMarkdownContent(editor, '   \n\n\t')
    // Normalized output should be empty (no content)
    expect(getMarkdownFromEditor(editor).trim()).toBe('')
  })

  test('preserves fenced code blocks content', () => {
    const editor = new Editor({
      extensions: [StarterKit, Markdown.configure({})],
    })
    const code = `function greet(name) {\n  return 'Hello ' + name;\n}`
    const md = ['```ts', code, '```', '', 'After code.', ''].join('\n')
    setMarkdownContent(editor, md)
    const out = getMarkdownFromEditor(editor)
    // Keep fence and content
    expect(out).toMatch(/```/)
    expect(out).toContain('function greet(name)')
    expect(out).toMatch(/After code\./)
  })
})

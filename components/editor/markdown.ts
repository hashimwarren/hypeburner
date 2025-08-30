import type { Editor } from '@tiptap/core'

export type MarkdownStorage = {
  getMarkdown: () => string
}

export function getMarkdownFromEditor(ed: Editor): string {
  const storage = (ed as Editor & { storage?: { markdown?: MarkdownStorage } }).storage
  return storage && storage.markdown ? storage.markdown.getMarkdown() : ''
}

export function setMarkdownContent(ed: Editor, md: string) {
  // tiptap-markdown supports setContent with markdown input
  ed.commands.setContent(md)
}

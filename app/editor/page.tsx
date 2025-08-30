'use client'
import React from 'react'
import TiptapEditor from '@/components/editor/TiptapEditor'
import { Button } from '@/components/ui/button'
import { toKebabCaseSlug } from '@/components/lib/slug'

export default function EditorPage() {
  // Avoid hydration mismatch (browser/extension may inject attributes before hydration)
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  const [markdown, setMarkdown] = React.useState<string>('')
  const [title, setTitle] = React.useState<string>('')
  const [summary, setSummary] = React.useState<string>('')
  const [tags, setTags] = React.useState<string>('')
  const [draft, setDraft] = React.useState<boolean>(false)
  const [slugInput, setSlugInput] = React.useState<string>('')
  const [folder, setFolder] = React.useState<'root' | 'news' | 'newsletter'>('root')
  const [saving, setSaving] = React.useState<boolean>(false)
  const [savedPath, setSavedPath] = React.useState<string | null>(null)
  const [savedSlug, setSavedSlug] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const fmDate = React.useMemo(() => new Date().toISOString().slice(0, 10), [])
  const fmTags = React.useMemo(() => {
    const arr = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    return `[${arr.map((t) => `"${t}"`).join(', ')}]`
  }, [tags])

  async function handleSave(overwrite = false) {
    setSaving(true)
    setError(null)
    setSavedPath(null)
    try {
      const tagsArr = tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      const res = await fetch('/api/editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          tags: tagsArr,
          draft,
          slug: toKebabCaseSlug(slugInput || title || 'untitled'),
          content: markdown,
          overwrite,
          folder,
        }),
      })
      const data = (await res.json()) as
        | { ok: true; slug: string; relativePath: string }
        | { error: string }
      if (!res.ok) throw new Error('error' in data ? data.error : 'Failed to save')
      if ('ok' in data) {
        setSavedPath(data.relativePath)
        setSavedSlug(data.slug)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const canSave = title.trim() && markdown.trim()

  if (!mounted) return null

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <h1 className="text-3xl font-bold">Local Markdown Editor</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">Title</span>
          <input
            id="editor-title"
            className="bg-background rounded-md border p-2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">Summary</span>
          <input
            id="editor-summary"
            className="bg-background rounded-md border p-2"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">Tags (comma-separated)</span>
          <input
            id="editor-tags"
            className="bg-background rounded-md border p-2"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">Folder</span>
          <select
            id="editor-folder"
            className="bg-background rounded-md border p-2"
            value={folder}
            onChange={(e) =>
              setFolder(
                (['root', 'news', 'newsletter'] as const).includes(
                  e.target.value as 'root' | 'news' | 'newsletter'
                )
                  ? (e.target.value as 'root' | 'news' | 'newsletter')
                  : 'root'
              )
            }
          >
            <option value="root">data/blog</option>
            <option value="news">data/blog/news</option>
            <option value="newsletter">data/blog/newsletter</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">Slug (optional)</span>
          <input
            id="editor-slug"
            className="bg-background rounded-md border p-2"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="auto from title"
          />
          <span className="text-muted-foreground text-xs">
            Filename: {toKebabCaseSlug(slugInput || title || 'untitled')}.mdx
          </span>
        </label>
        <label className="flex items-center gap-2">
          <input
            id="editor-draft"
            type="checkbox"
            className="h-4 w-4"
            checked={draft}
            onChange={(e) => setDraft(e.target.checked)}
          />
          <span className="text-muted-foreground text-sm">Draft</span>
        </label>
      </div>

      <TiptapEditor
        initialMarkdown={markdown}
        onUpdateMarkdown={setMarkdown}
        placeholder="Write your post in rich text. Content is kept locally."
      />

      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Markdown output</h2>
        <textarea
          id="markdown-output"
          className="bg-background h-48 w-full rounded-md border p-3 font-mono text-sm"
          value={`---\ntitle: ${title}\nsummary: TODO\ndate: ${fmDate}\ntags: ${fmTags}\ndraft: true\n---\n\n${markdown}`}
          readOnly
        />
        <div className="flex items-center gap-3">
          <Button type="button" disabled={!canSave || !!saving} onClick={() => handleSave(false)}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!canSave || !!saving}
            onClick={() => handleSave(true)}
            title="Overwrite if file exists"
          >
            {saving ? 'Saving…' : 'Save (overwrite)'}
          </Button>
          {savedPath && (
            <span className="text-sm text-green-700 dark:text-green-400">Saved: {savedPath}</span>
          )}
          {error && <span className="text-sm text-red-600">Error: {error}</span>}
        </div>
        {savedSlug && (
          <div className="mt-2 text-sm">
            <a
              className="text-primary underline"
              href={
                folder === 'news'
                  ? `/blog/news/${savedSlug}`
                  : folder === 'newsletter'
                    ? `/blog/newsletter/${savedSlug}`
                    : `/blog/${savedSlug}`
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              View post →
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

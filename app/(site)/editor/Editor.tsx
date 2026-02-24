'use client'
import React from 'react'
import { TiptapEditor } from '@/components/editor/TiptapEditor'
import { Button } from '@/components/ui/button'
import { toKebabCaseSlug } from '@/components/lib/slug'
import { useSearchParams } from 'next/navigation'
import { todayLocalYMD } from '@/components/lib/date'

export default function Editor() {
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
  const [loading, setLoading] = React.useState<boolean>(false)
  const [date, setDate] = React.useState<string>(todayLocalYMD())

  type PostListItem = {
    title: string
    slug: string
    summary: string
    draft: boolean
    folder: 'root' | 'news' | 'newsletter'
  }
  const [posts, setPosts] = React.useState<PostListItem[]>([])
  const searchParams = useSearchParams()
  const fmDate = date
  // Load list of posts (dev only)
  React.useEffect(() => {
    if (!mounted) return
    ;(async () => {
      try {
        const res = await fetch('/api/editor/list')
        if (!res.ok) return
        const data = (await res.json()) as { ok?: boolean; items?: PostListItem[] }
        if (data.ok && data.items) setPosts(data.items)
      } catch {
        // ignore
      }
    })()
  }, [mounted])

  // Shared loader
  async function loadBySlug(slug: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/editor/load?slug=${encodeURIComponent(slug)}`)
      const data = (await res.json()) as {
        ok?: boolean
        data?: {
          title: string
          summary: string
          tags: string[]
          draft: boolean
          slug: string
          date: string
          folder: 'root' | 'news' | 'newsletter'
          markdown: string
        }
        error?: string
      }
      if (!res.ok || !data.ok || !data.data) throw new Error(data.error || 'Failed to load')
      const d = data.data
      setTitle(d.title)
      setSummary(d.summary)
      setTags((d.tags || []).join(', '))
      setDraft(Boolean(d.draft))
      setSlugInput(d.slug)
      setDate(d.date)
      setFolder(d.folder)
      setMarkdown(d.markdown)
      setSavedSlug(d.slug)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // If slug is in query, load it
  React.useEffect(() => {
    if (!mounted) return
    const slug = searchParams.get('slug')
    if (!slug) return
    loadBySlug(slug)
  }, [mounted, searchParams])
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
          date,
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Local Markdown Editor</h1>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">Load existing</span>
          <select
            id="editor-load"
            className="bg-background rounded-md border p-2"
            value=""
            onChange={async (e) => {
              const slug = e.target.value
              if (!slug) return
              await loadBySlug(slug)
              setSavedPath(null)
              e.currentTarget.value = ''
            }}
          >
            <option value="">Select a post…</option>
            {posts.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.title} {p.draft ? '(draft)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">Date</span>
          <input
            id="editor-date"
            type="date"
            className="bg-background rounded-md border p-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
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
          value={`---\ntitle: ${title}\nsummary: ${summary}\ndate: ${fmDate}\ntags: ${fmTags}\ndraft: ${draft ? 'true' : 'false'}\n---\n\n${markdown}`}
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
          {loading && <span className="text-muted-foreground text-sm">Loading…</span>}
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

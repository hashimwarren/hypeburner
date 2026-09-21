'use client'

import { useEffect, useId, useRef, useState } from 'react'

export default function CopyArticleLink({ url }: { url: string }) {
  const fieldId = useId()
  const instructionsId = useId()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const inFlight = useRef(false)
  const successes = useRef(0)
  const failedAttempts = useRef(0)
  const [copying, setCopying] = useState(false)
  const [failures, setFailures] = useState(0)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (failures > 0) {
      textarea.current?.focus()
      textarea.current?.select()
    }
  }, [failures])

  async function copyLink() {
    if (inFlight.current) return
    inFlight.current = true
    setCopying(true)
    setStatus('')

    try {
      const clipboard = navigator.clipboard
      if (typeof clipboard?.writeText !== 'function') {
        throw new Error('Clipboard copying is unavailable')
      }
      await clipboard.writeText(url)
      successes.current += 1
      setStatus(
        successes.current === 1
          ? 'Article link copied.'
          : `Article link copied again (${successes.current}).`
      )
      setFailures(0)
    } catch {
      failedAttempts.current += 1
      setStatus(
        failedAttempts.current === 1
          ? 'Could not copy the article link. Copy it manually below, or try again.'
          : `Could not copy the article link again (${failedAttempts.current}). Copy it manually below, or try again.`
      )
      setFailures(failedAttempts.current)
    } finally {
      inFlight.current = false
      setCopying(false)
    }
  }

  return (
    <div className="flex max-w-full min-w-0 flex-col items-start gap-2 text-sm text-gray-900 dark:text-gray-100">
      <button
        type="button"
        onClick={copyLink}
        aria-disabled={copying}
        className="focus-visible:outline-primary-500 dark:focus-visible:outline-primary-400 min-h-[44px] max-w-full min-w-[44px] rounded border border-gray-400 bg-gray-100 px-3 py-2 break-words whitespace-normal hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 dark:border-gray-500 dark:bg-gray-800 dark:hover:bg-gray-700"
      >
        Copy article link
      </button>
      <p role="status" aria-atomic="true" className="max-w-full break-words">
        {status}
      </p>
      {failures > 0 && (
        <div className="flex w-full max-w-full min-w-0 flex-col gap-2">
          <label htmlFor={fieldId}>Article link</label>
          <p id={instructionsId} className="max-w-full break-words">
            Copy this link manually: press Ctrl+C or Command+C to copy the selected URL, or touch
            and hold it to select and copy. Shift+Tab returns to Copy article link to try again.
          </p>
          <textarea
            id={fieldId}
            ref={textarea}
            aria-describedby={instructionsId}
            readOnly
            value={url}
            rows={3}
            className="focus:outline-primary-500 dark:focus:outline-primary-400 block min-h-[44px] w-full max-w-full min-w-0 resize-y rounded border border-gray-400 bg-white p-2 break-all whitespace-pre-wrap focus:outline-2 focus:outline-offset-2 dark:border-gray-500 dark:bg-gray-900 dark:text-gray-100"
          />
        </div>
      )}
    </div>
  )
}

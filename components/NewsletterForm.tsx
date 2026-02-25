'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type NewsletterFormProps = {
  title?: string
  description?: string
  compact?: boolean
}

type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

type NewsletterApiResponse = {
  ok?: boolean
  message?: string
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function NewsletterForm({
  title = 'Subscribe to the newsletter',
  description = 'Get new posts and launch breakdowns in your inbox.',
  compact = false,
}: NewsletterFormProps) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<SubmitState>('idle')
  const [message, setMessage] = useState('')

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const normalizedEmail = email.trim().toLowerCase()

    if (!isValidEmail(normalizedEmail)) {
      setState('error')
      setMessage('Please enter a valid email address.')
      return
    }

    setState('submitting')
    setMessage('')

    try {
      const response = await fetch('/api/newsletter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: normalizedEmail }),
      })

      const body = (await response.json().catch(() => null)) as NewsletterApiResponse | null

      if (!response.ok || !body?.ok) {
        setState('error')
        setMessage(
          body?.message || "We couldn't subscribe you right now. Please try again shortly."
        )
        return
      }

      setState('success')
      setMessage(body.message || 'You are subscribed. Welcome to the newsletter.')
      setEmail('')
    } catch {
      setState('error')
      setMessage("We couldn't subscribe you right now. Please try again shortly.")
    }
  }

  return (
    <div className={`w-full ${compact ? 'max-w-lg' : 'max-w-2xl'} rounded-xl border p-6`}>
      <div className="space-y-1">
        <h2 className={`${compact ? 'text-lg' : 'text-xl'} font-semibold`}>{title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <Input
          id="newsletter-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          disabled={state === 'submitting'}
          aria-invalid={state === 'error'}
        />
        <Button type="submit" disabled={state === 'submitting'}>
          {state === 'submitting' ? 'Subscribing...' : 'Subscribe'}
        </Button>
      </form>

      {state !== 'idle' && (
        <p
          className={`mt-3 text-sm ${
            state === 'success'
              ? 'text-green-700 dark:text-green-400'
              : 'text-red-700 dark:text-red-400'
          }`}
        >
          {message}
        </p>
      )}
    </div>
  )
}

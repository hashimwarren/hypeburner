import React, { Suspense } from 'react'
import Editor from './Editor'

// Force dynamic rendering to avoid prerender errors with client hooks
export const dynamic = 'force-dynamic'

export default function EditorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Editor />
    </Suspense>
  )
}

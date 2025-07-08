'use client'

import { StagewiseToolbar } from '@stagewise/toolbar-next'

export default function StagewiseToolbarClient() {
  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return <StagewiseToolbar />
}

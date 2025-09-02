'use client'

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Editor } from '@tiptap/react'

export interface SlashCommandItem {
  title: string
  description: string
  icon: string
  command: (editor: Editor) => void
}

export interface SlashCommandProps {
  items: SlashCommandItem[]
  command: (item: SlashCommandItem) => void
  editor: Editor
}

export interface SlashCommandRef {
  onKeyDown: (event: KeyboardEvent) => boolean
}

const SlashCommandComponent = forwardRef<SlashCommandRef, SlashCommandProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  const selectItem = (index: number) => {
    const item = props.items[index]
    if (item) {
      props.command(item)
    }
  }

  const upHandler = () => {
    setSelectedIndex((prevIndex) => (prevIndex + props.items.length - 1) % props.items.length)
  }

  const downHandler = () => {
    setSelectedIndex((prevIndex) => (prevIndex + 1) % props.items.length)
  }

  const enterHandler = () => {
    selectItem(selectedIndex)
  }

  useEffect(() => {
    setSelectedIndex(0)
  }, [props.items])

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowUp':
          upHandler()
          return true

        case 'ArrowDown':
          downHandler()
          return true

        case 'Enter':
          enterHandler()
          return true

        default:
          return false
      }
    },
  }))

  return (
    <div className="relative z-50 w-80 rounded-lg border border-gray-200 bg-white p-1 shadow-xl dark:border-gray-700 dark:bg-gray-900">
      {props.items.map((item, index) => (
        <button
          key={index}
          className={`flex w-full items-center gap-3 rounded-md p-3 text-left transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
            index === selectedIndex
              ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
              : 'text-gray-900 dark:text-gray-100'
          }`}
          onClick={() => selectItem(index)}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-100 text-sm font-medium dark:bg-gray-800">
            {item.icon}
          </span>
          <div className="flex-1">
            <div className="leading-5 font-medium">{item.title}</div>
            <div
              className={`text-xs leading-4 ${
                index === selectedIndex
                  ? 'text-blue-700 dark:text-blue-300'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {item.description}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
})

SlashCommandComponent.displayName = 'SlashCommand'

export const SlashCommand = SlashCommandComponent

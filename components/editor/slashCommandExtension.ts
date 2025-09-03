import { Extension } from '@tiptap/core'
import Suggestion, { SuggestionOptions, SuggestionProps } from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { Editor, Range } from '@tiptap/react'
import tippy, { Instance as TippyInstance } from 'tippy.js'

import { SlashCommand, SlashCommandRef, SlashCommandItem } from './SlashCommand'

export const SlashCommandExtension = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor
          range: Range
          props: any // eslint-disable-line @typescript-eslint/no-explicit-any
        }) => {
          // Remove the trigger character and query text
          editor.chain().focus().deleteRange(range).run()

          // Execute the selected command
          if (props && typeof props.command === 'function') {
            props.command(editor)
          }
        },
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ]
  },
})

export const createSlashCommandSuggestion = () => {
  return {
    items: ({ query }: { query: string }) => {
      const items: SlashCommandItem[] = [
        {
          title: 'Text',
          description: 'Start writing with plain text',
          icon: '📝',
          command: (editor) => {
            // No additional action needed, just removes the slash
          },
        },
        {
          title: 'Heading 1',
          description: 'Big section heading',
          icon: 'H1',
          command: (editor) => {
            editor.chain().focus().setHeading({ level: 1 }).run()
          },
        },
        {
          title: 'Heading 2',
          description: 'Medium section heading',
          icon: 'H2',
          command: (editor) => {
            editor.chain().focus().setHeading({ level: 2 }).run()
          },
        },
        {
          title: 'Heading 3',
          description: 'Small section heading',
          icon: 'H3',
          command: (editor) => {
            editor.chain().focus().setHeading({ level: 3 }).run()
          },
        },
        {
          title: 'Bullet List',
          description: 'Create a simple bullet list',
          icon: '•',
          command: (editor) => {
            editor.chain().focus().toggleBulletList().run()
          },
        },
        {
          title: 'Numbered List',
          description: 'Create a numbered list',
          icon: '1.',
          command: (editor) => {
            editor.chain().focus().toggleOrderedList().run()
          },
        },
        {
          title: 'Quote',
          description: 'Create a quote block',
          icon: '💬',
          command: (editor) => {
            editor.chain().focus().setBlockquote().run()
          },
        },
        {
          title: 'Code Block',
          description: 'Create a code block',
          icon: '💻',
          command: (editor) => {
            editor.chain().focus().setCodeBlock().run()
          },
        },
        {
          title: 'Divider',
          description: 'Add a horizontal rule',
          icon: '—',
          command: (editor) => {
            editor.chain().focus().setHorizontalRule().run()
          },
        },
      ]

      return items.filter(
        (item) =>
          item.title.toLowerCase().startsWith(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase())
      )
    },

    render: () => {
      let component: ReactRenderer
      let popup: TippyInstance[]

      return {
        onStart: (props: SuggestionProps) => {
          component = new ReactRenderer(SlashCommand, {
            props: {
              ...props,
              editor: props.editor,
            },
            editor: props.editor,
          })

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect as () => DOMRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
            theme: 'light-border',
            maxWidth: 'none',
            offset: [0, 8],
            hideOnClick: true,
          })
        },

        onUpdate(props: SuggestionProps) {
          component.updateProps(props)

          popup[0].setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          })
        },

        onKeyDown(
          props: any // eslint-disable-line @typescript-eslint/no-explicit-any
        ) {
          if (props.event.key === 'Escape') {
            popup[0].hide()
            return true
          }

          const commandRef = component.ref as SlashCommandRef | null
          return commandRef?.onKeyDown(props.event) || false
        },

        onExit() {
          popup[0].destroy()
          component.destroy()
        },
      }
    },
  }
}

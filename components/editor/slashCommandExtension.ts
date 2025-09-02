import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import { Editor } from '@tiptap/react'
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
          range: any // eslint-disable-line @typescript-eslint/no-explicit-any
          props: any // eslint-disable-line @typescript-eslint/no-explicit-any
        }) => {
          // Command execution is handled in the SlashCommand component
          // This just closes the suggestion menu
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
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .run()
          },
        },
        {
          title: 'Heading 1',
          description: 'Big section heading',
          icon: 'H1',
          command: (editor) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .setHeading({ level: 1 })
              .run()
          },
        },
        {
          title: 'Heading 2',
          description: 'Medium section heading',
          icon: 'H2',
          command: (editor) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .setHeading({ level: 2 })
              .run()
          },
        },
        {
          title: 'Heading 3',
          description: 'Small section heading',
          icon: 'H3',
          command: (editor) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .setHeading({ level: 3 })
              .run()
          },
        },
        {
          title: 'Bullet List',
          description: 'Create a simple bullet list',
          icon: '•',
          command: (editor) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .toggleBulletList()
              .run()
          },
        },
        {
          title: 'Numbered List',
          description: 'Create a numbered list',
          icon: '1.',
          command: (editor) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .toggleOrderedList()
              .run()
          },
        },
        {
          title: 'Quote',
          description: 'Create a quote block',
          icon: '💬',
          command: (editor) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .setBlockquote()
              .run()
          },
        },
        {
          title: 'Code Block',
          description: 'Create a code block',
          icon: '💻',
          command: (editor) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .setCodeBlock()
              .run()
          },
        },
        {
          title: 'Divider',
          description: 'Add a horizontal rule',
          icon: '—',
          command: (editor) => {
            editor
              .chain()
              .focus()
              .deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.to })
              .setHorizontalRule()
              .run()
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
        onStart: (
          props: any // eslint-disable-line @typescript-eslint/no-explicit-any
        ) => {
          component = new ReactRenderer(SlashCommand, {
            props: {
              ...props,
              editor: props.editor,
            },
            editor: props.editor,
          })

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
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

        onUpdate(
          props: any // eslint-disable-line @typescript-eslint/no-explicit-any
        ) {
          component.updateProps(props)

          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
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

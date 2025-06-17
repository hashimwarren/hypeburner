import * as React from 'react'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>((props, ref) => (
  <textarea ref={ref} {...props} />
))
Textarea.displayName = 'Textarea'

export default Textarea

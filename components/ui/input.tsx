import * as React from 'react'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => (
  <input ref={ref} {...props} />
))
Input.displayName = 'Input'

export default Input

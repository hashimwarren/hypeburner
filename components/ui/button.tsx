import * as React from 'react'

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>((props, ref) => (
  <button ref={ref} {...props} />
))
Button.displayName = 'Button'

export default Button

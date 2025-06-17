/* eslint jsx-a11y/label-has-associated-control: off */
import * as React from 'react'
import { cn } from '@/lib/utils'

const Label = React.forwardRef<React.ElementRef<'label'>, React.ComponentPropsWithoutRef<'label'>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        'text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
        className
      )}
      {...props}
    />
  )
)
Label.displayName = 'Label'

export { Label }

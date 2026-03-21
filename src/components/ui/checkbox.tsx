'use client'

import * as React from 'react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { CheckIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  variant?: 'default' | 'booking'
}

function Checkbox({ className, variant = 'default', ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer size-4 shrink-0 rounded-[4px] border-2 border-zinc-500 bg-background shadow-xs outline-none transition-shadow',
        'dark:border-zinc-400 dark:data-[state=unchecked]:bg-zinc-950',
        variant === 'default' && [
          'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
          'dark:data-[state=checked]:border-primary dark:data-[state=checked]:bg-primary dark:data-[state=checked]:text-primary-foreground',
          'data-[state=unchecked]:focus-visible:border-zinc-500 data-[state=unchecked]:focus-visible:ring-[3px] data-[state=unchecked]:focus-visible:ring-zinc-400/45',
          'dark:data-[state=unchecked]:focus-visible:border-zinc-400 dark:data-[state=unchecked]:focus-visible:ring-[3px] dark:data-[state=unchecked]:focus-visible:ring-zinc-500/35',
          'data-[state=checked]:focus-visible:border-primary data-[state=checked]:focus-visible:ring-[3px] data-[state=checked]:focus-visible:ring-ring/50',
        ],
        variant === 'booking' && [
          'data-[state=checked]:border-[#2D5A27] data-[state=checked]:bg-[#2D5A27] data-[state=checked]:text-white',
          'dark:data-[state=checked]:border-emerald-600 dark:data-[state=checked]:bg-emerald-700 dark:data-[state=checked]:text-white',
          'data-[state=unchecked]:focus-visible:border-zinc-500 data-[state=unchecked]:focus-visible:ring-[3px] data-[state=unchecked]:focus-visible:ring-zinc-400/45',
          'dark:data-[state=unchecked]:focus-visible:border-zinc-400 dark:data-[state=unchecked]:focus-visible:ring-[3px] dark:data-[state=unchecked]:focus-visible:ring-zinc-500/35',
          'data-[state=checked]:focus-visible:border-[#2D5A27] data-[state=checked]:focus-visible:ring-[3px] data-[state=checked]:focus-visible:ring-[#2D5A27]/35',
          'dark:data-[state=checked]:focus-visible:border-emerald-600 dark:data-[state=checked]:focus-visible:ring-[3px] dark:data-[state=checked]:focus-visible:ring-emerald-500/40',
        ],
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }

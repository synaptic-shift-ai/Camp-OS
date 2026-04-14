'use client'

import type { ButtonHTMLAttributes } from 'react'
import { usePermissions } from '@/hooks/use-permissions'
import type { PermissionKey } from '@/lib/rbac'
import type { EffectiveRole } from '@/lib/rbac/roles'
import {
  Button,
  type ButtonProps,
} from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface PermissionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Specific permission key required. */
  permission?: PermissionKey
  /** Minimum effective role required. */
  minimumRole?: EffectiveRole
  /**
   * Display mode when permission is missing.
   * - 'hidden' (default): renders null — button is completely hidden.
   * - 'disabled': renders a disabled button with tooltip explaining why.
   */
  mode?: 'hidden' | 'disabled'
  /** Tooltip text shown when mode='disabled' and permission is missing. */
  tooltipText?: string
  /** shadcn Button variant, size, etc. */
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  children: React.ReactNode
}

/**
 * A Button that respects the current user's RBAC permissions.
 *
 * Default behavior: HIDDEN when permission check fails (same as PermissionGate).
 * Use `mode="disabled"` to show a disabled button with a tooltip instead.
 */
export function PermissionButton({
  permission,
  minimumRole,
  mode = 'hidden',
  tooltipText = "You don't have permission for this action",
  variant,
  size,
  children,
  ...buttonProps
}: PermissionButtonProps) {
  const { can, isAtLeastRole, isLoading } = usePermissions()

  if (isLoading) return null

  const hasAccess = (!permission || can(permission)) && (!minimumRole || isAtLeastRole(minimumRole))

  if (!hasAccess) {
    if (mode === 'disabled') {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button variant={variant} size={size} disabled {...buttonProps}>
                  {children}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tooltipText}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }
    return null
  }

  return (
    <Button variant={variant} size={size} {...buttonProps}>
      {children}
    </Button>
  )
}

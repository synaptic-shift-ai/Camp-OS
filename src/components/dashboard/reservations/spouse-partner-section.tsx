'use client'

/**
 * Spouse/Partner Information Section
 *
 * Collapsible section for capturing spouse/partner details during manual booking.
 * Includes toggle for marking as alternate contact.
 */

import { useFormContext, Controller } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronDown, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SpousePartnerSectionProps {
  /** Whether the section is expanded */
  isOpen: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Optional CSS class name */
  className?: string
}

export function SpousePartnerSection({
  isOpen,
  onOpenChange,
  className,
}: SpousePartnerSectionProps) {
  const { register, control, formState: { errors } } = useFormContext()

  // Type-safe access to nested spouse errors
  const spouseErrors = errors.spouse as Record<string, { message?: string }> | undefined

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={onOpenChange}
      className={cn('rounded-lg border', className)}
    >
      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Spouse/Partner Information</span>
          <span className="text-xs text-muted-foreground">(Optional)</span>
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="border-t p-4 space-y-4">
          {/* Name Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="spouse.first_name">First Name</Label>
              <Input
                id="spouse.first_name"
                placeholder="First name"
                {...register('spouse.first_name')}
              />
              {spouseErrors?.first_name && (
                <p className="text-sm text-destructive">
                  {spouseErrors.first_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="spouse.last_name">Last Name</Label>
              <Input
                id="spouse.last_name"
                placeholder="Last name"
                {...register('spouse.last_name')}
              />
              {spouseErrors?.last_name && (
                <p className="text-sm text-destructive">
                  {spouseErrors.last_name.message}
                </p>
              )}
            </div>
          </div>

          {/* Contact Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="spouse.phone">Phone (Optional)</Label>
              <Input
                id="spouse.phone"
                type="tel"
                placeholder="(555) 123-4567"
                {...register('spouse.phone')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spouse.email">Email (Optional)</Label>
              <Input
                id="spouse.email"
                type="email"
                placeholder="spouse@example.com"
                {...register('spouse.email')}
              />
              {spouseErrors?.email && (
                <p className="text-sm text-destructive">
                  {spouseErrors.email.message}
                </p>
              )}
            </div>
          </div>

          {/* Alternate Contact Toggle */}
          <div className="flex items-center space-x-2 pt-2">
            <Controller
              name="spouse.is_alternate_contact"
              control={control}
              defaultValue={false}
              render={({ field }) => (
                <Checkbox
                  id="spouse-alternate-contact"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label
              htmlFor="spouse-alternate-contact"
              className="cursor-pointer text-sm"
            >
              Mark as alternate contact for this reservation
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            If checked, we may contact the spouse/partner regarding this reservation.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { isAccessDeniedError } from '@/lib/utils/is-access-denied-error'

export type DeactivateStaffDialogTarget = {
  id: string
  name: string
  status: 'Active' | 'Pending' | 'Inactive'
}

type DeactivateStaffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  staff: DeactivateStaffDialogTarget | null
  onDeactivated?: () => void
}

export function DeactivateStaffDialog({
  open,
  onOpenChange,
  propertyId,
  staff,
  onDeactivated,
}: DeactivateStaffDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleConfirm = async () => {
    if (!staff || isSubmitting) return

    try {
      setIsSubmitting(true)
      const res = await fetch(
        `/api/v1/properties/${propertyId}/staff-management/staff/${staff.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'inactive' }),
        },
      )
      const json: { success?: boolean; error?: { message?: string } } = await res.json().catch(() => ({}))
      if (!res.ok || json.success !== true) {
        throw new Error(json.error?.message ?? 'Failed to deactivate staff member')
      }
      toast({
        title: 'Staff member deactivated',
        variant: "success",
      })
      onOpenChange(false)
      onDeactivated?.()
      router.refresh()
    } catch (err: unknown) {
      if (isAccessDeniedError(err)) {
        toast({
          title: 'Access denied',
          description: "You don't have permission for this action. Contact your property administrator if you believe this is an error.",
          variant: 'destructive',
        })
        return
      }
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Deactivation failed',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-y-auto bg-background p-6 text-foreground sm:rounded-lg">
        {staff ? (
          <>
            <DialogHeader className="space-y-3 pb-4 text-left">
              <div className="flex items-start gap-3 pr-8">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive dark:bg-red-950/70 dark:text-red-300">
                  <AlertTriangle className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 space-y-2">
                  <DialogTitle className="text-lg font-semibold leading-tight text-foreground">
                    Deactivate Staff Member
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
                    You are about to deactivate{' '}
                    <span className="font-semibold text-foreground">{staff.name}</span>.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-lg border border-red-200/90 bg-red-50 px-4 py-3 text-sm shadow-sm dark:border-red-900/70 dark:bg-red-950/45">
              <p className="font-semibold text-foreground">This action will:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-muted-foreground marker:text-muted-foreground">
                <li>
                  Remove all access to this property{' '}
                  <span className="font-semibold text-foreground">immediately</span>
                </li>
                <li>
                  Invalidate any active sessions{' '}
                  <span className="font-semibold text-foreground">immediately</span>
                </li>
                <li className="text-muted-foreground">
                  The staff member will be logged out on their next request
                </li>
              </ul>
            </div>

            <DialogFooter className="mt-8 flex w-full flex-row justify-end gap-2 border-t border-border pt-6 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-lg border-border bg-background text-foreground hover:bg-muted"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="rounded-lg px-4 font-semibold"
                onClick={() => void handleConfirm()}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Deactivating…' : 'Confirm Deactivation'}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

'use client'

/**
 * Delete Guest Dialog
 *
 * Confirmation dialog before soft-deleting a guest.
 * Calls DELETE /api/v1/guests/[id].
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import type { DashboardGuest } from '@/lib/dashboard/queries'

interface DeleteGuestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: DashboardGuest
}

export function DeleteGuestDialog({ open, onOpenChange, guest }: DeleteGuestDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/v1/guests/${guest.id}`, {
        method: 'DELETE',
      })

      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => ({}))
        const message =
          data?.error?.message ?? (typeof data?.error === 'string' ? data.error : 'Failed to delete guest')
        throw new Error(message)
      }

      toast({
        title: 'Guest deleted',
        description: `${guest.name} has been removed from your guest list.`,
      })
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete guest',
        variant: 'destructive',
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete guest?</AlertDialogTitle>
          <AlertDialogDescription>
            <strong>{guest.name}</strong> will be removed from your guest list. Their reservation
            history will be preserved. This action can be undone by contacting support.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              'Delete guest'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

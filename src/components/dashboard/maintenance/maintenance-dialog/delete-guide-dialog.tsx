"use client"

import { useState } from "react"
import { Loader2, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

type GuideDeleteTarget = {
  id: string
  name: string
}

type DeleteGuideConfirmationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  guide: GuideDeleteTarget | null
  onDeleted: (guideId: string) => void
}

export function DeleteGuideConfirmationDialog({
  open,
  onOpenChange,
  propertyId,
  guide,
  onDeleted,
}: DeleteGuideConfirmationDialogProps) {
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  if (!guide) {
    return null
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/guides/${guide.id}`,
        { method: "DELETE" },
      )
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to delete maintenance guide."
        throw new Error(message)
      }

      onDeleted(guide.id)
      onOpenChange(false)

      toast({
        title: "Guide deleted",
        description: `"${guide.name}" has been removed.`,
        variant: "success",
      })
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Failed to delete maintenance guide."
      toast({
        title: "Unable to delete guide",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete maintenance guide?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove{" "}
            <span className="font-medium text-foreground">{guide.name}</span>. This action cannot be
            undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void handleDelete()
            }}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting…
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete guide
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

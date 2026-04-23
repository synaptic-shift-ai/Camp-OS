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
import type { MaintenanceTaskRow } from "../wo-list/maintenance-table"

type DeleteTaskConfirmationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  task: Pick<MaintenanceTaskRow, "id" | "task" | "siteName"> | null
  onDeleted: (taskId: string) => void
}

export function DeleteTaskConfirmationDialog({
  open,
  onOpenChange,
  propertyId,
  task,
  onDeleted,
}: DeleteTaskConfirmationDialogProps) {
  const { toast } = useToast()
  const [isDeleting, setIsDeleting] = useState(false)

  if (!task) {
    return null
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/maintenance/${task.id}`,
        { method: "DELETE" },
      )
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to delete maintenance task."
        throw new Error(message)
      }

      onDeleted(task.id)
      onOpenChange(false)

      toast({
        title: "Task deleted",
        description: "The maintenance task was removed.",
      })
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Failed to delete maintenance task."
      toast({
        title: "Unable to delete task",
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
          <AlertDialogTitle>Delete maintenance task?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove{" "}
            <span className="font-medium text-foreground">{task.task}</span> for{" "}
            <span className="font-medium text-foreground">{task.siteName}</span>. This action cannot
            be undone.
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
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete task
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

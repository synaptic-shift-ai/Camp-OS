"use client"

import { useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
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
import type { HousekeepingTaskRow } from "../housekeeping-task/housekeeping-table"

type CompleteTaskConfirmationDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  task: Pick<HousekeepingTaskRow, "id" | "task" | "siteName"> | null
  onCompleted: (taskId: string) => void
}

export function CompleteTaskConfirmationDialog({
  open,
  onOpenChange,
  propertyId,
  task,
  onCompleted,
}: CompleteTaskConfirmationDialogProps) {
  const { toast } = useToast()
  const [isCompleting, setIsCompleting] = useState(false)

  if (!task) return null

  const handleComplete = async () => {
    setIsCompleting(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/housekeeping/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to complete housekeeping task."
        throw new Error(message)
      }

      onCompleted(task.id)
      onOpenChange(false)
      toast({
        title: "Task completed",
        description: "The housekeeping task is now marked as done.",
        variant: "success",
      })
    } catch (completeError) {
      const message =
        completeError instanceof Error ? completeError.message : "Failed to complete housekeeping task."
      toast({
        title: "Unable to complete task",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Complete housekeeping task?</AlertDialogTitle>
          <AlertDialogDescription>
            Mark <span className="font-medium text-foreground">{task.task}</span> for{" "}
            <span className="font-medium text-foreground">{task.siteName}</span> as completed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCompleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              void handleComplete()
            }}
            disabled={isCompleting}
          >
            {isCompleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Completing...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Complete task
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

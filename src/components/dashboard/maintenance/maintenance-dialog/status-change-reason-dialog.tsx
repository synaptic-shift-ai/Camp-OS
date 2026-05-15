"use client"

import { useEffect, useRef, useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type StatusChangeReasonDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onSubmit: (reason: string) => void
  isSubmitting?: boolean
}

export function StatusChangeReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
  isSubmitting = false,
}: StatusChangeReasonDialogProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | null>(null)
  const cleanFormRef = useRef<string>("")

  useEffect(() => {
    if (!open) return
    setReason("")
    cleanFormRef.current = JSON.stringify("")
    setError(null)
  }, [open])

  const isDirty = JSON.stringify(reason) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const handleSubmit = () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      setError("Please provide a reason")
      return
    }
    onSubmit(trimmed)
  }

  return (
    <AlertDialog open={open} onOpenChange={guardedOnOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>

        <div className="space-y-2">
          <Textarea
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              if (error) setError(null)
            }}
            placeholder="Enter the reason for this status change..."
            rows={3}
            disabled={isSubmitting}
          />
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
          <Button
            onClick={(event) => {
              event.preventDefault()
              handleSubmit()
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Submitting..." : "Confirm"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    {unsavedChangesDialog}
  )
}

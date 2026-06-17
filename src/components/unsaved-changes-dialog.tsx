"use client"

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface UnsavedChangesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  message?: string
  onDiscard: () => void
  onSaveAndLeave?: () => void
  isSaving?: boolean
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  message = "You have unsaved changes. Would you like to save before leaving?",
  onDiscard,
  onSaveAndLeave,
  isSaving,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onDiscard}
            className={buttonVariants({ variant: "destructive" })}
          >
            Discard
          </AlertDialogAction>
          {onSaveAndLeave && (
            <AlertDialogAction
              onClick={onSaveAndLeave}
              disabled={isSaving}
            >
              {isSaving ? "Saving…" : "Save & Leave"}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function UnsavedChangesSavingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      aria-busy="true"
      aria-live="polite"
      aria-label="Saving changes"
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-12 w-12 animate-spin stroke-[1] text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Saving changes…</p>
      </div>
    </div>
  )
}

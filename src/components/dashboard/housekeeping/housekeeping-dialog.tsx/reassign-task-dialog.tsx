"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ReassignTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  userOptions: Array<{ id: string; label: string }>
  currentUserId?: string | null
  isSubmitting?: boolean
  onSubmit: (userId: string) => Promise<void>
}

export function ReassignTaskDialog({
  open,
  onOpenChange,
  userOptions,
  currentUserId = null,
  isSubmitting = false,
  onSubmit,
}: ReassignTaskDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelectedUserId(currentUserId ?? "")
    setError(null)
  }, [open, currentUserId])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!selectedUserId) {
      setError("Please select a user.")
      return
    }

    try {
      await onSubmit(selectedUserId)
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to reassign task."
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign Task</DialogTitle>
          <DialogDescription>Select a user to reassign this task.</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="reassign-task-user">User</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger id="reassign-task-user">
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {userOptions.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Reassigning..." : "Reassign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

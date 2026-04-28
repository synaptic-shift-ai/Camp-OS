"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

type IssueType = "DAMAGE" | "MAINTENANCE"

type FlagIssueDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  housekeepingId: string
  onSubmit: (result: { issueType: IssueType; issueDescription: string; woNumber?: string | null }) => Promise<void>
}

export function FlagIssueDialog({
  open,
  onOpenChange,
  propertyId,
  housekeepingId,
  onSubmit,
}: FlagIssueDialogProps) {
  const [issueType, setIssueType] = useState<IssueType>("MAINTENANCE")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setIssueType("MAINTENANCE")
      setDescription("")
      setError(null)
    }
  }, [open])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const trimmedDescription = description.trim()
    if (trimmedDescription.length < 10) {
      setError("Description must be at least 10 characters.")
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/housekeeping/${housekeepingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueType,
            issueDescription: trimmedDescription,
          }),
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? "Failed to report issue."
        throw new Error(message)
      }

      const woNumber = payload?.data?.housekeepingTask?.linked_maintenance_task_id
        ? "Work order created"
        : null
      await onSubmit({ issueType, issueDescription: trimmedDescription, woNumber })
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to report issue."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="inline-flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report Issue
          </DialogTitle>
          <DialogDescription>
            Flag a damage or maintenance issue found during housekeeping. A maintenance work
            order will be created automatically.
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label>Issue Type</Label>
            <RadioGroup
              value={issueType}
              onValueChange={(value) => setIssueType(value as IssueType)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="DAMAGE" id="issue-damage" />
                <Label htmlFor="issue-damage" className="font-normal cursor-pointer">
                  Damage
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="MAINTENANCE" id="issue-maintenance" />
                <Label htmlFor="issue-maintenance" className="font-normal cursor-pointer">
                  Maintenance
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-description">Description</Label>
            <Textarea
              id="issue-description"
              placeholder="Describe the issue in detail (min 10 characters)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              {description.trim().length < 10
                ? `${10 - description.trim().length} more characters needed`
                : "✓ Minimum reached"}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || description.trim().length < 10}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              Report Issue
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

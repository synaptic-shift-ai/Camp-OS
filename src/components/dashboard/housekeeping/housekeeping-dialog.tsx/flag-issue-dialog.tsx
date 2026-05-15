'use client'

/**
 * FlagIssueDialog
 *
 * Allows staff to report an issue (DAMAGE or MAINTENANCE) on a housekeeping task.
 * Submits the issue type and description to the PATCH endpoint.
 */

import { useEffect, useRef, useState } from 'react'
import { Loader2, AlertTriangle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useToast } from '@/hooks/use-toast'
import { useDialogCloseGuard } from '@/hooks/use-dialog-close-guard'

type FlagIssueDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  taskId: string
  taskTitle: string
  onFlagged: () => void
}

type IssueType = 'DAMAGE' | 'MAINTENANCE'

export function FlagIssueDialog({
  open,
  onOpenChange,
  propertyId,
  taskId,
  taskTitle,
  onFlagged,
}: FlagIssueDialogProps) {
  const { toast } = useToast()
  const [issueType, setIssueType] = useState<IssueType | null>(null)
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const cleanFormRef = useRef("")

  useEffect(() => {
    if (open) {
      cleanFormRef.current = JSON.stringify({ issueType: null, description: '' })
    }
  }, [open])

  const isValid =
    issueType !== null && description.trim().length >= 10

  const handleSubmit = async () => {
    if (!isValid) return

    setIsSubmitting(true)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/housekeeping/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            issueType,
            issueDescription: description.trim(),
          }),
        },
      )

      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          'Failed to flag issue.'
        throw new Error(message)
      }

      toast({
        title: 'Issue reported',
        description: `A ${issueType} issue has been flagged. A maintenance work order will be created automatically.`,
        variant: 'success',
      })

      onFlagged()
      onOpenChange(false)
      setIssueType(null)
      setDescription('')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to flag issue.'
      toast({
        title: 'Unable to report issue',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setIssueType(null)
      setDescription('')
    }
    onOpenChange(nextOpen)
  }

  const isDirty = JSON.stringify({ issueType, description }) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange: handleOpenChange,
  })

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Report Issue
          </DialogTitle>
          <DialogDescription>
            Flag an issue for &ldquo;{taskTitle}&rdquo;. A maintenance work order will be created automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Issue Type</Label>
            <RadioGroup
              value={issueType ?? ''}
              onValueChange={(value) => setIssueType(value as IssueType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="DAMAGE" id="issue-damage" />
                <Label htmlFor="issue-damage" className="cursor-pointer font-normal">
                  Damage
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MAINTENANCE" id="issue-maintenance" />
                <Label htmlFor="issue-maintenance" className="cursor-pointer font-normal">
                  Maintenance
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="issue-description" className="text-sm font-medium">
              Description <span className="text-muted-foreground">(min 10 characters)</span>
            </Label>
            <Textarea
              id="issue-description"
              placeholder="Describe the issue in detail..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">
              {description.trim().length < 10
                ? `${10 - description.trim().length} more characters required`
                : `${description.trim().length}/5000`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!isValid || isSubmitting}
            onClick={() => void handleSubmit()}
            className="gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            Report Issue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {unsavedChangesDialog}
  )
}

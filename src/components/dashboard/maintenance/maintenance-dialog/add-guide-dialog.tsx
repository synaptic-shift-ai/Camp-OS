"use client"

import { useCallback, useEffect, useId, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { GripVertical, Plus, X } from "lucide-react"

export type AddGuideInput = {
  name: string
  description: string | null
  steps: Array<{ id: string; label: string; notes: string | null }>
}

type GuideStepRow = {
  id: string
  label: string
  notes: string
}

function newStepRow(): GuideStepRow {
  return { id: crypto.randomUUID(), label: "", notes: "" }
}

type AddGuideDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting?: boolean
  onSubmit: (input: AddGuideInput) => Promise<void>
}

export function AddGuideDialog({
  open,
  onOpenChange,
  isSubmitting = false,
  onSubmit,
}: AddGuideDialogProps) {
  const { toast } = useToast()
  const formId = useId()
  const nameId = `${formId}-name`
  const descId = `${formId}-description`

  const [guideName, setGuideName] = useState("")
  const [description, setDescription] = useState("")
  const [steps, setSteps] = useState<GuideStepRow[]>(() => [newStepRow()])
  const [error, setError] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setGuideName("")
    setDescription("")
    setSteps([newStepRow()])
    setError(null)
    setDraggedIndex(null)
  }, [open])

  const addStepRow = useCallback(() => {
    setSteps((prev) => [...prev, newStepRow()])
  }, [])

  const removeStepRow = useCallback((id: string) => {
    setSteps((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)))
  }, [])

  const moveRow = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return
    setSteps((prev) => {
      const next = [...prev]
      const [removed] = next.splice(from, 1)
      if (!removed) return prev
      next.splice(to, 0, removed)
      return next
    })
  }, [])

  const handleDragStart = (index: number) => (event: React.DragEvent) => {
    event.dataTransfer.setData("text/plain", String(index))
    event.dataTransfer.effectAllowed = "move"
    setDraggedIndex(index)
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (dropIndex: number) => (event: React.DragEvent) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData("text/plain")
    const from = Number.parseInt(raw, 10)
    if (!Number.isFinite(from)) return
    moveRow(from, dropIndex)
    setDraggedIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const name = guideName.trim()
    if (!name) {
      setError("Guide name is required.")
      return
    }

    const payloadSteps = steps
      .map((row) => ({
        id: row.id,
        label: row.label.trim(),
        notes: row.notes.trim() ? row.notes.trim() : null,
      }))
      .filter((row) => row.label.length > 0)

    if (payloadSteps.length === 0) {
      const message = "Add at least one step with a name."
      setError(message)
      toast({
        title: "Step required",
        description: message,
        variant: "destructive",
      })
      return
    }

    try {
      await onSubmit({
        name,
        description: description.trim() ? description.trim() : null,
        steps: payloadSteps,
      })
      onOpenChange(false)
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to save maintenance guide."
      setError(message)
      toast({
        title: "Unable to save guide",
        description: message,
        variant: "destructive",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Create maintenance guide</DialogTitle>
          <DialogDescription className="sr-only">
            Create a reusable maintenance guide with step-by-step instructions and optional notes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor={nameId} className="text-sm font-medium">
                Guide name <span className="text-foreground">*</span>
              </Label>
              <Input
                id={nameId}
                value={guideName}
                onChange={(e) => setGuideName(e.target.value)}
                placeholder="HVAC Filter Replacement"
                autoComplete="off"
                className={cn(
                  "rounded-md border-2 border-primary/70 bg-background",
                  "focus-visible:border-primary focus-visible:ring-primary/25",
                )}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={descId} className="text-sm font-medium">
                Description
              </Label>
              <Textarea
                id={descId}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder=""
                rows={4}
                className="min-h-[100px] resize-y rounded-md"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">Steps</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-md border-border font-medium"
                  onClick={addStepRow}
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add step
                </Button>
              </div>

              <div className="space-y-2">
                {steps.map((row, index) => (
                  <div
                    key={row.id}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop(index)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "flex items-center gap-2 rounded-md border border-transparent bg-background py-1 pr-1 transition-opacity",
                      draggedIndex === index && "opacity-60",
                    )}
                  >
                    <div
                      draggable={!isSubmitting}
                      onDragStart={handleDragStart(index)}
                      className="flex h-9 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted/80 active:cursor-grabbing [&:focus-visible]:outline-none [&:focus-visible]:ring-2 [&:focus-visible]:ring-ring"
                      aria-label={`Reorder step ${index + 1}`}
                      role="button"
                      tabIndex={0}
                    >
                      <GripVertical className="h-4 w-4 pointer-events-none" aria-hidden />
                    </div>
                    <Input
                      value={row.label}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                        )
                      }
                      placeholder={`Step ${index + 1}`}
                      className="flex-1 rounded-md"
                      disabled={isSubmitting}
                    />
                    <Input
                      value={row.notes}
                      onChange={(e) =>
                        setSteps((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, notes: e.target.value } : r)),
                        )
                      }
                      placeholder="Notes (optional)"
                      className="flex-1 rounded-md"
                      disabled={isSubmitting}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeStepRow(row.id)}
                      disabled={isSubmitting || steps.length <= 1}
                      aria-label={`Remove step ${index + 1}`}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter className="gap-2 border-t border-border px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              className="font-medium text-foreground"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="rounded-md bg-primary px-6 font-medium text-primary-foreground hover:bg-primary/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Save Guide"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

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
import { cn } from "@/lib/utils"
import { GripVertical, Plus, X } from "lucide-react"

export type AddChecklistTemplateInput = {
  name: string
  description: string | null
  items: Array<{ label: string; notes: string | null }>
}

type ChecklistItemRow = {
  id: string
  label: string
  notes: string
}

function newItemRow(): ChecklistItemRow {
  return { id: crypto.randomUUID(), label: "", notes: "" }
}

type AddChecklistDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting?: boolean
  onSubmit: (input: AddChecklistTemplateInput) => Promise<void>
}

export function AddChecklistDialog({
  open,
  onOpenChange,
  isSubmitting = false,
  onSubmit,
}: AddChecklistDialogProps) {
  const formId = useId()
  const nameId = `${formId}-name`
  const descId = `${formId}-description`

  const [templateName, setTemplateName] = useState("")
  const [description, setDescription] = useState("")
  const [items, setItems] = useState<ChecklistItemRow[]>(() => [newItemRow()])
  const [error, setError] = useState<string | null>(null)
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    setTemplateName("")
    setDescription("")
    setItems([newItemRow()])
    setError(null)
    setDraggedIndex(null)
  }, [open])

  const addItemRow = useCallback(() => {
    setItems((prev) => [...prev, newItemRow()])
  }, [])

  const removeItemRow = useCallback((id: string) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== id)))
  }, [])

  const moveRow = useCallback((from: number, to: number) => {
    if (from === to || from < 0 || to < 0) return
    setItems((prev) => {
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

    const name = templateName.trim()
    if (!name) {
      setError("Template name is required.")
      return
    }

    const payloadItems = items
      .map((row) => ({
        label: row.label.trim(),
        notes: row.notes.trim() ? row.notes.trim() : null,
      }))
      .filter((row) => row.label.length > 0)

    if (payloadItems.length === 0) {
      setError("Add at least one checklist item with a name.")
      return
    }

    try {
      await onSubmit({
        name,
        description: description.trim() ? description.trim() : null,
        items: payloadItems,
      })
      onOpenChange(false)
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Failed to save checklist template."
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Create checklist template</DialogTitle>
          <DialogDescription className="sr-only">
            Create a reusable checklist template with named items and optional notes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor={nameId} className="text-sm font-medium">
                Template name <span className="text-foreground">*</span>
              </Label>
              <Input
                id={nameId}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Standard Turnover Cleaning"
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
                <span className="text-sm font-medium">Checklist items</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-md border-border font-medium"
                  onClick={addItemRow}
                  disabled={isSubmitting}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Add item
                </Button>
              </div>

              <div className="space-y-2">
                {items.map((row, index) => (
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
                      aria-label={`Reorder item ${index + 1}`}
                      role="button"
                      tabIndex={0}
                    >
                      <GripVertical className="h-4 w-4 pointer-events-none" aria-hidden />
                    </div>
                    <Input
                      value={row.label}
                      onChange={(e) =>
                        setItems((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r)),
                        )
                      }
                      placeholder={`Item ${index + 1}`}
                      className="flex-1 rounded-md"
                      disabled={isSubmitting}
                    />
                    <Input
                      value={row.notes}
                      onChange={(e) =>
                        setItems((prev) =>
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
                      onClick={() => removeItemRow(row.id)}
                      disabled={isSubmitting || items.length <= 1}
                      aria-label={`Remove item ${index + 1}`}
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
              {isSubmitting ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

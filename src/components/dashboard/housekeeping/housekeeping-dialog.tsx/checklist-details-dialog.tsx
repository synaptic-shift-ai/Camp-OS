"use client"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  parseChecklistTemplateLines,
  type PropertyChecklistListItem,
} from "@/lib/dashboard/housekeeping/housekeeping-queries"

type ChecklistDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  checklist: PropertyChecklistListItem | null
}

export function ChecklistDetailsDialog({
  open,
  onOpenChange,
  checklist,
}: ChecklistDetailsDialogProps) {
  if (!checklist) return null

  const items = parseChecklistTemplateLines(checklist.item)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Checklist details</DialogTitle>
        </DialogHeader>

        <div className="max-h-[min(65vh,34rem)] overflow-y-auto pr-1">
          <div className="space-y-1 border-b border-border/60 pb-3">
            <p className="text-sm font-medium text-foreground">{checklist.name}</p>
            <p className="text-sm text-muted-foreground">
              {checklist.description?.trim() ? checklist.description.trim() : "No description"}
            </p>
          </div>

          <div className="pt-3">
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checklist items found.</p>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={`${item.id ?? "line"}-${index}`} className="rounded-md border border-border/60 px-3 py-2">
                    <p className="text-sm text-foreground">{item.label}</p>
                    {item.notes?.trim() ? (
                      <p className="mt-1 text-xs text-muted-foreground">{item.notes.trim()}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import type { MaintenanceGuideListItem } from "@/lib/dashboard/maintenance/maintenance-queries"

type GuideDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  guide: MaintenanceGuideListItem | null
}

export function GuideDetailsDialog({
  open,
  onOpenChange,
  guide,
}: GuideDetailsDialogProps) {
  if (!guide) return null

  const steps = Array.isArray(guide.steps) ? guide.steps : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Guide details</DialogTitle>
        </DialogHeader>

        <div className="max-h-[min(65vh,34rem)] overflow-y-auto pr-1">
          <div className="space-y-1 border-b border-border/60 pb-3">
            <p className="text-sm font-medium text-foreground">{guide.name}</p>
            <p className="text-sm text-muted-foreground">
              {guide.description?.trim() ? guide.description.trim() : "No description"}
            </p>
          </div>

          <div className="pt-3">
            {steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No guide steps found.</p>
            ) : (
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div
                    key={`${step.id ?? "step"}-${index}`}
                    className="rounded-md border border-border/60 px-3 py-2"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium tabular-nums text-muted-foreground">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">{step.label}</p>
                        {step.notes?.trim() ? (
                          <p className="mt-1 text-xs text-muted-foreground">{step.notes.trim()}</p>
                        ) : null}
                      </div>
                    </div>
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

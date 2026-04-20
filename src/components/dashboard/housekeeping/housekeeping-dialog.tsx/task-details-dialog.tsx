"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  HousekeepingQueries,
  parseChecklistTemplateLines,
} from "@/lib/dashboard/housekeeping/housekeeping-queries"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { HousekeepingTaskRow } from "../housekeeping-table"

type TaskDetailsDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: HousekeepingTaskRow | null
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-3 border-b border-border/60 py-2.5 text-sm last:border-0 sm:grid-cols-[8.5rem_1fr]">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 text-foreground whitespace-pre-wrap break-words">{value}</span>
    </div>
  )
}

function StatusDisplay({ status }: { status: HousekeepingTaskRow["status"] }) {
  const base =
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border w-fit"
  if (status === "Done") {
    return (
      <span className={`${base} border-emerald-200 bg-emerald-50 text-emerald-700`}>Done</span>
    )
  }
  if (status === "In Progress") {
    return (
      <span className={`${base} border-blue-200 bg-blue-50 text-blue-700`}>In Progress</span>
    )
  }
  return <span className={`${base} border-amber-200 bg-amber-50 text-amber-700`}>Pending</span>
}

function PriorityDisplay({ priority }: { priority: HousekeepingTaskRow["priority"] }) {
  if (priority === "High") {
    return (
      <Badge
        variant="secondary"
        className="rounded-full bg-red-50 text-red-700 font-medium normal-case border border-red-200 w-fit"
      >
        High
      </Badge>
    )
  }
  if (priority === "Medium") {
    return (
      <Badge
        variant="secondary"
        className="rounded-full bg-orange-50 text-orange-700 font-medium normal-case border border-orange-200 w-fit"
      >
        Medium
      </Badge>
    )
  }
  return (
    <Badge
      variant="secondary"
      className="rounded-full bg-muted/60 text-foreground font-medium normal-case border border-muted-foreground/10 w-fit"
    >
      Low
    </Badge>
  )
}

export function TaskDetailsDialog({ open, onOpenChange, task }: TaskDetailsDialogProps) {
  const [checklistName, setChecklistName] = useState<string | null>(null)
  const [checklistItems, setChecklistItems] = useState<Array<{ id: string; label: string; completed: boolean }>>(
    [],
  )
  const [isChecklistLoading, setIsChecklistLoading] = useState(false)

  useEffect(() => {
    if (!open || !task?.checklistId) {
      setChecklistName(null)
      setChecklistItems([])
      setIsChecklistLoading(false)
      return
    }

    let cancelled = false
    const completedIds = new Set(
      (task.checklistItemDone ?? [])
        .filter((item) => item.status === "completed")
        .map((item) => item.item_id),
    )

    const loadChecklist = async () => {
      setIsChecklistLoading(true)
      try {
        const supabase = createClient()
        const queries = new HousekeepingQueries(supabase as unknown as SupabaseClient)
        const template = await queries.getChecklistTemplateById(task.checklistId as string)
        if (cancelled) return

        if (!template) {
          setChecklistName("Checklist")
          setChecklistItems([])
          return
        }

        const parsed = parseChecklistTemplateLines(template.item)
        setChecklistName(template.name)
        setChecklistItems(
          parsed.map((line, index) => {
            const id = line.id ?? `${template.id}-${index + 1}`
            return {
              id,
              label: line.label,
              completed: completedIds.has(id),
            }
          }),
        )
      } finally {
        if (!cancelled) setIsChecklistLoading(false)
      }
    }

    void loadChecklist()
    return () => {
      cancelled = true
    }
  }, [open, task])

  if (!task) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Task details</DialogTitle>
        </DialogHeader>
        <div className="max-h-[min(60vh,28rem)] overflow-y-auto pr-1">
          <p className="text-sm font-medium text-foreground border-b border-border/60 pb-3">
            {task.task}
          </p>
          <div className="pt-1">
            <DetailRow label="Site" value={task.siteName} />
            <DetailRow
              label="Description"
              value={task.description?.trim() ? task.description.trim() : "—"}
            />
            <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-3 border-b border-border/60 py-2.5 text-sm sm:grid-cols-[8.5rem_1fr]">
              <span className="font-medium text-muted-foreground">Assignee</span>
              <span className="text-foreground">{task.assignee ?? "Unassigned"}</span>
            </div>
            <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-3 border-b border-border/60 py-2.5 text-sm sm:grid-cols-[8.5rem_1fr]">
              <span className="font-medium text-muted-foreground">Status</span>
              <StatusDisplay status={task.status} />
            </div>
            {task.checklistId ? (
              <div className="border-b border-border/60 py-2.5 text-sm">
                <div className="mb-2">
                  <span className="font-medium text-muted-foreground">Checklist</span>
                  <p className="mt-1 text-foreground">{checklistName ?? "Checklist"}</p>
                </div>
                {isChecklistLoading ? (
                  <p className="text-muted-foreground">Loading checklist items...</p>
                ) : checklistItems.length === 0 ? (
                  <p className="text-muted-foreground">No checklist items found.</p>
                ) : (
                  <div className="space-y-2">
                    {checklistItems.map((item) => (
                      <div key={item.id} className="rounded-md border border-border/60 px-3 py-2">
                        <span className="text-foreground">{item.label}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {item.completed ? "Completed" : "Pending"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
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

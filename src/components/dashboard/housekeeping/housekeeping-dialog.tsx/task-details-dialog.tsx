"use client"

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

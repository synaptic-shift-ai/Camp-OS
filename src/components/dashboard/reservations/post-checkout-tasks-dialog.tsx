"use client"

import { Sparkles, Wrench, X } from "lucide-react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PostCheckoutTasksDialogProps = {
  open: boolean
  reservationLabel: string
  isCreatingHousekeepingTask?: boolean
  isCreatingMaintenanceTask?: boolean
  onOpenChange: (open: boolean) => void
  onCreateHousekeepingTask: () => void
  onCreateMaintenanceTask: () => void
  onDone: () => void
}

type TaskCardProps = {
  title: string
  description: string
  icon: ReactNode
  actionLabel: string
  onAction: () => void
  isBusy?: boolean
}

function TaskCard({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  isBusy = false,
}: TaskCardProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/80 bg-muted/20 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-50 text-teal-700">
          {icon}
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Button type="button" size="sm" className="px-5" onClick={onAction} disabled={isBusy}>
        {isBusy ? "Creating..." : actionLabel}
      </Button>
    </div>
  )
}

export function PostCheckoutTasksDialog({
  open,
  reservationLabel,
  isCreatingHousekeepingTask = false,
  isCreatingMaintenanceTask = false,
  onOpenChange,
  onCreateHousekeepingTask,
  onCreateMaintenanceTask,
  onDone,
}: PostCheckoutTasksDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl [&>button]:hidden">
        <DialogHeader className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-2xl font-semibold tracking-tight text-foreground">
              Post-checkout tasks
            </DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 h-8 w-8 text-muted-foreground"
              onClick={onDone}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <DialogDescription className="max-w-[38ch] text-sm text-muted-foreground sm:text-base">
            {reservationLabel} was checked out. Create the tasks you need - skip the rest.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          <TaskCard
            title="Housekeeping task"
            description="Schedule cleaning for the unit."
            icon={<Sparkles className="h-4 w-4" aria-hidden />}
            actionLabel="Create"
            onAction={onCreateHousekeepingTask}
            isBusy={isCreatingHousekeepingTask}
          />
          <TaskCard
            title="Maintenance task"
            description="Log any issues that need fixing."
            icon={<Wrench className="h-4 w-4" aria-hidden />}
            actionLabel="Create"
            onAction={onCreateMaintenanceTask}
            isBusy={isCreatingMaintenanceTask}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onDone}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

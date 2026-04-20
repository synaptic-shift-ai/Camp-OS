"use client"

import { Button } from "@/components/ui/button"
import { ClipboardList, Plus } from "lucide-react"
import type { HousekeepingViewMode } from "./housekeeping-view-switcher"

type HousekeepingPageHeaderProps = {
  propertyName: string
  pendingTasksCount?: number
  onRefreshClick?: () => void
  onExportClick?: (format: string) => void
  viewMode: HousekeepingViewMode
  onAddTaskClick?: () => void
  onAddChecklistClick?: () => void
  canCreateTask?: boolean
}

export function HousekeepingPageHeader({
  propertyName,
  pendingTasksCount = 0,
  onRefreshClick,
  onExportClick,
  viewMode,
  onAddTaskClick,
  onAddChecklistClick,
  canCreateTask = true,
}: HousekeepingPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">
          Housekeeping
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{propertyName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {canCreateTask && (
          <Button
            type="button"
            size="sm"
            onClick={viewMode === "tasks" ? onAddTaskClick : onAddChecklistClick}
          >
            {viewMode === "tasks" ? (
              <>
                <Plus className="h-4 w-4" />
                Add Task
              </>
            ) : (
              <>
                <ClipboardList className="h-4 w-4" />
                Add Checklist
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  )
}

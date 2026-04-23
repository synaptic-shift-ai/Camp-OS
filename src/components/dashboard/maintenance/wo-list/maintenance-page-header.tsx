"use client"

import { Button } from "@/components/ui/button"
import { ExportMenu } from "@/components/ui/export-menu"
import { Plus } from "lucide-react"

type MaintenancePageHeaderProps = {
  propertyName: string
  openTasksCount?: number
  onRefreshClick?: () => void
  onExportClick?: (format: string) => void
  onPrimaryActionClick?: () => void
  primaryActionLabel?: string
  showPrimaryAction?: boolean
}

export function MaintenancePageHeader({
  propertyName,
  openTasksCount = 0,
  onRefreshClick,
  onExportClick,
  onPrimaryActionClick,
  primaryActionLabel = "Add Task",
  showPrimaryAction = true,
}: MaintenancePageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">
          Maintenance
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{propertyName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        {/* <ExportMenu
          onExport={(format) => onExportClick?.(format)}
          aria-label="Export maintenance tasks"
        /> */}

        {showPrimaryAction && onPrimaryActionClick ? (
          <Button type="button" size="sm" onClick={onPrimaryActionClick}>
            <Plus className="h-4 w-4" />
            {primaryActionLabel}
          </Button>
        ) : null}
      </div>
    </div>
  )
}

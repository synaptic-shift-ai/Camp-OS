"use client"

import { BarChart3, CalendarDays, List } from "lucide-react"

export type MaintenanceViewMode = "wo_list" | "analytics" | "schedules"

type MaintenanceViewSwitcherProps = {
  mode: MaintenanceViewMode
  onModeChange: (mode: MaintenanceViewMode) => void
}

export function MaintenanceViewSwitcher({ mode, onModeChange }: MaintenanceViewSwitcherProps) {
  return (
    <div className="flex items-center justify-end">
      <div
        className="relative inline-flex items-center rounded-md border border-border/80 bg-card/50 p-1"
        role="tablist"
        aria-label="Maintenance view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "wo_list"}
          onClick={() => onModeChange("wo_list")}
          className={[
            "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "wo_list" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
          ].join(" ")}
        >
          <List className="h-4 w-4 shrink-0" aria-hidden />
          WO List
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "analytics"}
          onClick={() => onModeChange("analytics")}
          className={[
            "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "analytics"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/60",
          ].join(" ")}
        >
          <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
          Analytics
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "schedules"}
          onClick={() => onModeChange("schedules")}
          className={[
            "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "schedules"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/60",
          ].join(" ")}
        >
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          Schedules
        </button>
      </div>
    </div>
  )
}

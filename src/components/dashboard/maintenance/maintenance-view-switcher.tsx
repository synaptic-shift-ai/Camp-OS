"use client"

import { BarChart3, BookOpen, CalendarDays, List, Users2 } from "lucide-react"

export type MaintenanceViewMode = "wo_list" | "analytics" | "schedules" | "vendors" | "guides"

type MaintenanceViewSwitcherProps = {
  mode: MaintenanceViewMode
  onModeChange: (mode: MaintenanceViewMode) => void
  /** Maps to maintenance module toggle `view-cost-reports`. */
  showCostReport?: boolean
  /** Maps to maintenance module toggle `manage-pm-schedules`. */
  showSchedules?: boolean
  /** Maps to maintenance module toggle `manage-vendors`. */
  showVendorsList?: boolean
  /** Shows the Guides tab. */
  showGuides?: boolean
}

const tabButtonClass = (selected: boolean) =>
  [
    "inline-flex shrink-0 items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
    selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
  ].join(" ")

export function MaintenanceViewSwitcher({
  mode,
  onModeChange,
  showCostReport = true,
  showSchedules = true,
  showVendorsList = true,
  showGuides = true,
}: MaintenanceViewSwitcherProps) {
  return (
    <div className="flex items-center sm:justify-end w-full">
      <div
        className="relative inline-flex items-center rounded-md border border-border/80 bg-card/50 p-1 overflow-x-auto max-w-full"
        role="tablist"
        aria-label="Maintenance view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "wo_list"}
          onClick={() => onModeChange("wo_list")}
          className={tabButtonClass(mode === "wo_list")}
        >
          <List className="h-4 w-4 shrink-0" aria-hidden />
          WO List
        </button>

        {showCostReport ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "analytics"}
            onClick={() => onModeChange("analytics")}
            className={tabButtonClass(mode === "analytics")}
          >
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
            Cost Report
          </button>
        ) : null}

        {showSchedules ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "schedules"}
            onClick={() => onModeChange("schedules")}
            className={tabButtonClass(mode === "schedules")}
          >
            <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
            Schedules
          </button>
        ) : null}

        {showVendorsList ? (
          <button
            type="button"
            role="tab"
            aria-selected={mode === "vendors"}
            onClick={() => onModeChange("vendors")}
            className={tabButtonClass(mode === "vendors")}
          >
            <Users2 className="h-4 w-4 shrink-0" aria-hidden />
            Vendors List
          </button>
        ) : null}

        <button
          type="button"
          role="tab"
          aria-selected={mode === "guides"}
          onClick={() => onModeChange("guides")}
          className={tabButtonClass(mode === "guides")}
        >
          <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
          Guides
        </button>
      </div>
    </div>
  )
}

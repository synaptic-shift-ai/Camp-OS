"use client"

import { ClipboardList, List, ShieldAlert } from "lucide-react"

export type HousekeepingViewMode = "tasks" | "checklist" | "damage-review"

type HousekeepingViewSwitcherProps = {
  mode: HousekeepingViewMode
  onModeChange: (mode: HousekeepingViewMode) => void
}

export function HousekeepingViewSwitcher({ mode, onModeChange }: HousekeepingViewSwitcherProps) {
  return (
    <div className="flex items-center justify-end">
      <div
        className="relative inline-flex items-center rounded-md border border-border/80 bg-card/50 p-1"
        role="tablist"
        aria-label="Housekeeping view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "tasks"}
          onClick={() => onModeChange("tasks")}
          className={[
            "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "tasks" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
          ].join(" ")}
        >
          <List className="h-4 w-4 shrink-0" aria-hidden />
          Task list
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "checklist"}
          onClick={() => onModeChange("checklist")}
          className={[
            "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "checklist"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/60",
          ].join(" ")}
        >
          <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
          Checklist
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "damage-review"}
          onClick={() => onModeChange("damage-review")}
          className={[
            "inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
            mode === "damage-review"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted/60",
          ].join(" ")}
        >
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
          Damage Review
        </button>
      </div>
    </div>
  )
}

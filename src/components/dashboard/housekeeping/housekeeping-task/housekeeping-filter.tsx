"use client"

import { useEffect, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { SlidersHorizontal } from "lucide-react"

export type HousekeepingFilterValue = {
  search: string
  siteId: string
  assigneeId: string
  status: string
  priority: string
}

const STATUS_FILTER_VALUES = ["Pending", "In Progress", "Done"] as const
const PRIORITY_FILTER_VALUES = ["Low", "Medium", "High", "Urgent"] as const

type HousekeepingFilterProps = {
  value: HousekeepingFilterValue
  onChange: (next: HousekeepingFilterValue) => void
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
  /** When false, the assignee control is omitted (e.g. housekeeping staff scoped to own tasks). */
  showAssigneeFilter?: boolean
}

export function HousekeepingFilter({
  value,
  onChange,
  siteOptions,
  assigneeOptions,
  showAssigneeFilter = true,
}: HousekeepingFilterProps) {
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const [draftFilters, setDraftFilters] = useState<HousekeepingFilterValue>(value)

  useEffect(() => {
    if (!mobileFiltersOpen) return
    setDraftFilters(value)
  }, [mobileFiltersOpen, value])

  const applyDraftFilters = () => {
    onChange(draftFilters)
    setMobileFiltersOpen(false)
  }

  const gridClassName = showAssigneeFilter
    ? "grid gap-4 border border-border/80 bg-card/50 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-end"
    : "grid gap-4 border border-border/80 bg-card/50 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-end"

  return (
    <>
      <div className="border border-border/80 bg-card/50 p-2 sm:hidden">
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value.search}
              onChange={(e) => onChange({ ...value, search: e.target.value })}
              placeholder="Search by task, description, site, or assignee…"
              className="h-9 rounded-none bg-card/50 pl-8 text-sm"
              aria-label="Search housekeeping tasks"
            />
          </div>
          <Dialog open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-9 w-9 rounded-none bg-card/50">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="sr-only">Open filters</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Housekeeping Filters</DialogTitle>
                <DialogDescription>Adjust filters and save to apply them.</DialogDescription>
              </DialogHeader>

              <div className="mt-4 space-y-3">
                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Site
                  </label>
                  <Select
                    value={draftFilters.siteId}
                    onValueChange={(siteId) => setDraftFilters((prev) => ({ ...prev, siteId }))}
                  >
                    <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                      <SelectValue placeholder="Site" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">All sites</SelectItem>
                      {siteOptions.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showAssigneeFilter ? (
                  <div className="space-y-0.5">
                    <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Assignee
                    </label>
                    <Select
                      value={draftFilters.assigneeId}
                      onValueChange={(assigneeId) =>
                        setDraftFilters((prev) => ({ ...prev, assigneeId }))
                      }
                    >
                      <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                        <SelectValue placeholder="Assignee" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="all">All assignees</SelectItem>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {assigneeOptions.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </label>
                  <Select
                    value={draftFilters.status}
                    onValueChange={(status) => setDraftFilters((prev) => ({ ...prev, status }))}
                  >
                    <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">All statuses</SelectItem>
                      {STATUS_FILTER_VALUES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Priority
                  </label>
                  <Select
                    value={draftFilters.priority}
                    onValueChange={(priority) =>
                      setDraftFilters((prev) => ({ ...prev, priority }))
                    }
                  >
                    <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">All priorities</SelectItem>
                      {PRIORITY_FILTER_VALUES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setMobileFiltersOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={applyDraftFilters}>
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className={`${gridClassName} hidden sm:grid`}>
      <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Search by task, description, site, or assignee…"
            className="h-9 rounded-none bg-card/50 pl-8 text-sm"
            aria-label="Search housekeeping tasks"
          />
        </div>
      </div>

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Site
        </label>
        <Select value={value.siteId} onValueChange={(siteId) => onChange({ ...value, siteId })}>
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Site" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">All sites</SelectItem>
            {siteOptions.map((site) => (
              <SelectItem key={site.id} value={site.id}>
                {site.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showAssigneeFilter ? (
        <div className="min-w-0 space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Assignee
          </label>
          <Select
            value={value.assigneeId}
            onValueChange={(assigneeId) => onChange({ ...value, assigneeId })}
          >
            <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All assignees</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {assigneeOptions.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  {person.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Status
        </label>
        <Select value={value.status} onValueChange={(status) => onChange({ ...value, status })}>
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_FILTER_VALUES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Priority
        </label>
        <Select
          value={value.priority}
          onValueChange={(priority) => onChange({ ...value, priority })}
        >
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITY_FILTER_VALUES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      </div>
    </>
  )
}

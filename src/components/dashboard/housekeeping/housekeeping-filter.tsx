"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type HousekeepingFilterValue = {
  search: string
  siteId: string
  assigneeId: string
  status: string
}

const STATUS_FILTER_VALUES = ["Pending", "In Progress", "Done"] as const

type HousekeepingFilterProps = {
  value: HousekeepingFilterValue
  onChange: (next: HousekeepingFilterValue) => void
  siteOptions: Array<{ id: string; label: string }>
  assigneeOptions: Array<{ id: string; label: string }>
}

export function HousekeepingFilter({
  value,
  onChange,
  siteOptions,
  assigneeOptions,
}: HousekeepingFilterProps) {
  return (
    <div className="grid gap-4 border border-border/80 bg-card/50 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
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
    </div>
  )
}

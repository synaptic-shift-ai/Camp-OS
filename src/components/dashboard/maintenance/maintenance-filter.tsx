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

export type MaintenanceFilterValue = {
  search: string
  status: string
  priority: string
  category: string
}

type MaintenanceFilterProps = {
  value: MaintenanceFilterValue
  onChange: (next: MaintenanceFilterValue) => void
  statusOptions: string[]
  priorityOptions: string[]
  categoryOptions: string[]
}

export function MaintenanceFilter({
  value,
  onChange,
  statusOptions,
  priorityOptions,
  categoryOptions,
}: MaintenanceFilterProps) {
  return (
    <div className="grid gap-4 border border-border/80 bg-card/50 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(9.5rem,0.9fr)_minmax(9.5rem,0.9fr)_minmax(9.5rem,0.9fr)] lg:items-end">
      <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            placeholder="Search by site, issue, or assignee..."
            className="h-9 rounded-none bg-card/50 pl-8 text-sm"
            aria-label="Search maintenance tasks"
          />
        </div>
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
            {statusOptions.map((status) => (
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
            {priorityOptions.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Category
        </label>
        <Select
          value={value.category}
          onValueChange={(category) => onChange({ ...value, category })}
        >
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">All categories</SelectItem>
            {categoryOptions.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

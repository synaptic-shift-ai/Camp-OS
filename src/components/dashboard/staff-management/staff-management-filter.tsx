"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type StaffManagementFilterValue = {
  search: string
  role: string
  category: string
  status: string
}

type StaffManagementFilterProps = {
  value: StaffManagementFilterValue
  onChange: (next: StaffManagementFilterValue) => void
  roleOptions: string[]
  categoryOptions: string[]
  statusOptions: string[]
}

export default function StaffManagementFilter({
  value,
  onChange,
  roleOptions,
  categoryOptions,
  statusOptions,
}: StaffManagementFilterProps) {
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
            placeholder="Search by name or email..."
            className="h-9 rounded-none bg-card/50 pl-8 text-sm"
            aria-label="Search staff"
          />
        </div>
      </div>

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Role
        </label>
        <Select value={value.role} onValueChange={(role) => onChange({ ...value, role })}>
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Role" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="all">All roles</SelectItem>
            {roleOptions.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 space-y-1">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Categories
        </label>
        <Select value={value.category} onValueChange={(category) => onChange({ ...value, category })}>
          <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
            <SelectValue placeholder="Categories" />
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
    </div>
  )
}
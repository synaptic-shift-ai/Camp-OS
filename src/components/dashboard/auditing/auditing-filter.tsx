import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type AuditingFilterProps = {
  propertyId: string | null
}

export default function AuditingFilter({ propertyId }: AuditingFilterProps) {
  return (
    <div
      className="flex flex-col gap-3 border border-border/80 bg-card/50 p-3 sm:flex-row sm:items-end sm:gap-3"
      data-property-id={propertyId ?? undefined}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            defaultValue=""
            placeholder="Search activity…"
            className="h-9 rounded-none bg-card/50 pl-8 text-sm"
            aria-label="Search activity"
          />
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2 sm:gap-3">
        <div className="space-y-0.5 sm:w-[min(100%,11rem)] sm:min-w-[9rem]">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Actions
          </label>
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
              <SelectValue placeholder="Actions" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="create">Create</SelectItem>
              <SelectItem value="update">Update</SelectItem>
              <SelectItem value="delete">Delete</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-0.5 sm:w-[min(100%,11rem)] sm:min-w-[9rem]">
          <label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Resource
          </label>
          <Select defaultValue="all">
            <SelectTrigger className="h-9 w-full rounded-none bg-card/50">
              <SelectValue placeholder="Resource" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">All Resources</SelectItem>
              <SelectItem value="reservations">Reservations</SelectItem>
              <SelectItem value="guests">Guests</SelectItem>
              <SelectItem value="sites">Sites</SelectItem>
              <SelectItem value="bookings">Bookings</SelectItem>
              <SelectItem value="payments">Payments</SelectItem>
              <SelectItem value="invoices">Invoices</SelectItem>
              <SelectItem value="reports">Reports</SelectItem>
              <SelectItem value="settings">Settings</SelectItem>
              <SelectItem value="users">Users</SelectItem>
              <SelectItem value="roles">Roles</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

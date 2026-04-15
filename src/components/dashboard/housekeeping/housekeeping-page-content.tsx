"use client"

import { useMemo, useState } from "react"
import { HousekeepingFilter, type HousekeepingFilterValue } from "./housekeeping-filter"
import { HousekeepingPageHeader } from "./housekeeping-page-header"
import { HousekeepingTable, type HousekeepingTaskRow } from "./housekeeping-table"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import { useToast } from "@/hooks/use-toast"

type HousekeepingPageContentProps = {
  propertyName: string
}

const INITIAL_TASKS: HousekeepingTaskRow[] = [
  {
    id: "hk-1",
    siteName: "Site A12",
    task: "Turnover clean after checkout",
    assignee: "Maya Patel",
    status: "In Progress",
    priority: "High",
    dueTime: "10:00 AM",
    zone: "North Loop",
  },
  {
    id: "hk-2",
    siteName: "Cabin C03",
    task: "Restock bathroom supplies",
    assignee: null,
    status: "Pending",
    priority: "Medium",
    dueTime: "11:30 AM",
    zone: "Cabin Row",
  },
  {
    id: "hk-3",
    siteName: "Site B04",
    task: "Final inspection",
    assignee: "Jordan Lee",
    status: "Done",
    priority: "Low",
    dueTime: "09:15 AM",
    zone: "South Loop",
  },
  {
    id: "hk-4",
    siteName: "Yurt Y02",
    task: "Linen change and reset",
    assignee: "Ari Santos",
    status: "Pending",
    priority: "High",
    dueTime: "01:00 PM",
    zone: "Glamping Ridge",
  },
]

const INITIAL_FILTERS: HousekeepingFilterValue = {
  search: "",
  status: "all",
  priority: "all",
  zone: "all",
}

export function HousekeepingPageContent({ propertyName }: HousekeepingPageContentProps) {
  const { toast } = useToast()
  const [filters, setFilters] = useState<HousekeepingFilterValue>(INITIAL_FILTERS)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<HousekeepingTaskRow[]>(INITIAL_TASKS)

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))).sort(),
    [rows],
  )
  const priorityOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.priority))).sort(),
    [rows],
  )
  const zoneOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.zone).filter(Boolean) as string[])).sort(),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        row.siteName.toLowerCase().includes(normalizedSearch) ||
        row.task.toLowerCase().includes(normalizedSearch) ||
        (row.assignee?.toLowerCase().includes(normalizedSearch) ?? false)

      const matchesStatus = filters.status === "all" || row.status === filters.status
      const matchesPriority = filters.priority === "all" || row.priority === filters.priority
      const matchesZone = filters.zone === "all" || row.zone === filters.zone

      return matchesSearch && matchesStatus && matchesPriority && matchesZone
    })
  }, [filters, rows])

  const pendingTasksCount = useMemo(
    () => rows.filter((row) => row.status !== "Done").length,
    [rows],
  )

  const handleRefresh = () => {
    setLoading(true)
    window.setTimeout(() => {
      setRows((currentRows) => [...currentRows])
      setLoading(false)
    }, 450)
  }

  const handleExport = (format: string) => {
    if (format !== "csv") return

    const filename = buildExportFilename("HOUSEKEEPING")
    exportToCsv<HousekeepingTaskRow>(filename, filteredRows, [
      { key: "siteName", header: "Site" },
      { key: "task", header: "Task" },
      {
        key: "assignee",
        header: "Asignee",
        accessor: (row) => row.assignee ?? "Unassigned",
      },
      { key: "status", header: "Status" },
      { key: "priority", header: "Priority" },
      { key: "dueTime", header: "Due Time" },
      { key: "zone", header: "Zone", accessor: (row) => row.zone ?? "—" },
    ])

    toast({
      title: "Export ready",
      description: "Housekeeping CSV has been downloaded.",
    })
  }

  const handleAddTask = () => {
    const nextId = `hk-${rows.length + 1}`
    setRows((currentRows) => [
      {
        id: nextId,
        siteName: "Site TBD",
        task: "New housekeeping task",
        assignee: null,
        status: "Pending",
        priority: "Medium",
        dueTime: "TBD",
        zone: "Unassigned",
      },
      ...currentRows,
    ])

    toast({
      title: "Task added",
      description: "A new housekeeping task has been added to the table.",
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <HousekeepingPageHeader
        propertyName={propertyName}
        pendingTasksCount={pendingTasksCount}
        onRefreshClick={handleRefresh}
        onExportClick={handleExport}
        onAddTaskClick={handleAddTask}
      />
      <HousekeepingFilter
        value={filters}
        onChange={setFilters}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        zoneOptions={zoneOptions}
      />
      <HousekeepingTable rows={filteredRows} loading={loading} />
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { buildExportFilename, exportToCsv } from "@/lib/csv/export"
import { useToast } from "@/hooks/use-toast"
import { MaintenanceFilter, type MaintenanceFilterValue } from "./maintenance-filter"
import { MaintenancePageHeader } from "./maintenance-page-header"
import { MaintenanceTable, type MaintenanceTaskRow } from "./maintenance-table"

type MaintenancePageContentProps = {
  propertyName: string
}

const INITIAL_TASKS: MaintenanceTaskRow[] = [
  {
    id: "mt-1",
    siteName: "Site A09",
    task: "Replace faulty power outlet",
    assignee: "Luis Carter",
    status: "In Progress",
    priority: "High",
    category: "Electrical",
  },
  {
    id: "mt-2",
    siteName: "Cabin C05",
    task: "Repair leaking bathroom sink",
    assignee: null,
    status: "Open",
    priority: "Medium",
    category: "Plumbing",
  },
  {
    id: "mt-3",
    siteName: "Site B02",
    task: "Replace damaged picnic table board",
    assignee: "Noah Kim",
    status: "Completed",
    priority: "Low",
    category: "Carpentry",
  },
]

const INITIAL_FILTERS: MaintenanceFilterValue = {
  search: "",
  status: "all",
  priority: "all",
  category: "all",
}

export function MaintenancePageContent({ propertyName }: MaintenancePageContentProps) {
  const { toast } = useToast()
  const [filters, setFilters] = useState<MaintenanceFilterValue>(INITIAL_FILTERS)
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<MaintenanceTaskRow[]>(INITIAL_TASKS)

  const statusOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.status))).sort(),
    [rows],
  )
  const priorityOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.priority))).sort(),
    [rows],
  )
  const categoryOptions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.category).filter(Boolean) as string[])).sort(),
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
      const matchesCategory = filters.category === "all" || row.category === filters.category

      return matchesSearch && matchesStatus && matchesPriority && matchesCategory
    })
  }, [filters, rows])

  const openTasksCount = useMemo(
    () => rows.filter((row) => row.status !== "Completed").length,
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

    const filename = buildExportFilename("MAINTENANCE")
    exportToCsv<MaintenanceTaskRow>(filename, filteredRows, [
      { key: "siteName", header: "Site" },
      { key: "task", header: "Task" },
      {
        key: "assignee",
        header: "Asignee",
        accessor: (row) => row.assignee ?? "Unassigned",
      },
      { key: "status", header: "Status" },
      { key: "priority", header: "Priority" },
      { key: "category", header: "Category", accessor: (row) => row.category ?? "—" },
    ])

    toast({
      title: "Export ready",
      description: "Maintenance CSV has been downloaded.",
    })
  }

  const handleAddTask = () => {
    const nextId = `mt-${rows.length + 1}`
    setRows((currentRows) => [
      {
        id: nextId,
        siteName: "Site TBD",
        task: "New maintenance task",
        assignee: null,
        status: "Open",
        priority: "Medium",
        category: "General",
      },
      ...currentRows,
    ])

    toast({
      title: "Task added",
      description: "A new maintenance task has been added to the table.",
    })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <MaintenancePageHeader
        propertyName={propertyName}
        openTasksCount={openTasksCount}
        onRefreshClick={handleRefresh}
        onExportClick={handleExport}
        onAddTaskClick={handleAddTask}
      />
      <MaintenanceFilter
        value={filters}
        onChange={setFilters}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        categoryOptions={categoryOptions}
      />
      <MaintenanceTable rows={filteredRows} loading={loading} />
    </div>
  )
}

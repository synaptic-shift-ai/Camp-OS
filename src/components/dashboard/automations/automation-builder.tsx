"use client"

import { useState, useCallback, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PermissionGate } from "@/components/ui/permission-gate"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { Plus, Search, RefreshCw, LayoutTemplate } from "lucide-react"
import { AutomationsTable } from "./automations-table"
import { AutomationViewDialog } from "./automation-view-dialog"
import { AutomationDeleteDialog } from "./automation-delete-dialog"
import { TemplatesGrid } from "./templates-grid"
import { TemplateDetailDialog } from "./template-detail-dialog"
import { DryRunDialog } from "./dry-run-dialog"
import { DEFAULT_AUTOMATION_TEMPLATES, type AutomationTemplate } from "@/lib/automations/templates"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { PHASE_ORDER, type AutomationPhase, type AutomationRow } from "@/lib/automations/types"
import { PHASE_COLORS } from "@/lib/automations/templates"

type AutomationBuilderProps = {
  automations: AutomationRow[]
  propertyId: string
  companyId: string
  systemMode?: boolean
}

export function AutomationBuilder({ automations: initialAutomations, propertyId, companyId, systemMode }: AutomationBuilderProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [search, setSearch] = useState("")
  const [phaseFilter, setPhaseFilter] = useState<AutomationPhase | "all">("all")
  const [viewingAutomation, setViewingAutomation] = useState<AutomationRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AutomationRow | null>(null)
  const [dryRunTarget, setDryRunTarget] = useState<AutomationRow | null>(null)
  const [templatesOpen, setTemplatesOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<AutomationTemplate | null>(null)

  // Pagination
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const pageRef = useRef(1)

  const filtered = useMemo(() => {
    let result = initialAutomations
    if (phaseFilter !== "all") {
      result = result.filter(a => a.phase === phaseFilter)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q)
      )
    }
    return result
  }, [initialAutomations, search, phaseFilter])

  const systemIds = useMemo(
    () => new Set(initialAutomations.filter(a => a.scope === 'system').map(a => a.id)),
    [initialAutomations]
  )

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / perPage))
  const startIndex = total === 0 ? 0 : (page - 1) * perPage + 1
  const endIndex = total === 0 ? 0 : Math.min(page * perPage, total)

  const pagedRows = useMemo(() => {
    return filtered.slice((page - 1) * perPage, page * perPage)
  }, [filtered, page, perPage])

  // Reset page when filters or page size change
  const filtersApiKey = useMemo(() => `${search}|${phaseFilter}|${perPage}`, [search, phaseFilter, perPage])
  const prevFiltersKeyRef = useRef(filtersApiKey)
  if (prevFiltersKeyRef.current !== filtersApiKey) {
    prevFiltersKeyRef.current = filtersApiKey
    pageRef.current = 1
    setPage(1)
  }

  const goToPage = useCallback((next: number) => {
    const clamped = Math.max(1, Math.min(next, totalPages))
    pageRef.current = clamped
    setPage(clamped)
  }, [totalPages])

  const refresh = useCallback(() => {
    router.refresh()
  }, [router])

  const baseUrl = `/dashboard/${propertyId}/automations`

  const handleToggleActive = useCallback(async (row: AutomationRow) => {
    try {
      const url = systemMode ? `/api/v1/automations/${row.id}` : `/api/v1/automations/${row.id}?propertyId=${propertyId}`
      const res = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.is_active }),
      })
      if (!res.ok) throw new Error()
      toast({ title: row.is_active ? "Automation deactivated" : "Automation activated" })
      refresh()
    } catch {
      toast({ title: "Failed to update", variant: "destructive" })
    }
  }, [propertyId, systemMode, toast, refresh])

  const handleDeleted = useCallback(async () => {
    if (!deleteTarget) return
    try {
      const url = systemMode ? `/api/v1/automations/${deleteTarget.id}` : `/api/v1/automations/${deleteTarget.id}?propertyId=${propertyId}`
      const res = await fetch(url, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error()
      setDeleteTarget(null)
      toast({ title: "Automation deleted" })
      refresh()
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" })
    }
  }, [deleteTarget, propertyId, systemMode, toast, refresh])

  const handleDuplicate = useCallback(async (row: AutomationRow) => {
    try {
      const fetchUrl = systemMode ? `/api/v1/automations/${row.id}` : `/api/v1/automations/${row.id}?propertyId=${propertyId}`
      const res = await fetch(fetchUrl, {
        method: "GET",
      })
      if (!res.ok) throw new Error()
      const payload = await res.json()
      const data = payload.data ?? payload

      const flatGroups = data.conditionGroups ?? []
      const flatConditions = data.conditions ?? []
      const flatActions = data.actions ?? []

      const conditionGroups = flatGroups.map((g: any) => ({
        logicOperator: g.logic_operator,
        parentGroupId: g.parent_group_id,
        conditions: flatConditions
          .filter((c: any) => c.group_id === g.id)
          .map((c: any) => ({
            variable: c.variable,
            operator: c.operator,
            value: c.value,
          })),
      }))

      const actions = flatActions.map((a: any) => ({
        actionType: a.action_type,
        actionConfig: a.action_config ?? {},
        delayValue: a.delay_value,
        delayUnit: a.delay_unit,
        sortOrder: a.sort_order,
      }))

      const res2 = await fetch(`/api/v1/automations?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(systemMode ? {} : { companyId, propertyId }),
          name: `${row.name} (Copy)`,
          description: row.description ?? undefined,
          phase: row.phase,
          triggerType: row.trigger_type,
          ...(systemMode ? { scope: 'system' } : {}),
          isActive: false,
          isTerminal: row.is_terminal,
          conditionGroups,
          actions,
        }),
      })

      if (!res2.ok) throw new Error()
      toast({ title: "Automation duplicated" })
      refresh()
    } catch {
      toast({ title: "Failed to duplicate", variant: "destructive" })
    }
  }, [propertyId, companyId, systemMode, toast, refresh])

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1 w-full">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search automations..."
              className="pl-8 h-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                phaseFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              }`}
              onClick={() => setPhaseFilter("all")}
            >
              All ({initialAutomations.length})
            </button>
            {PHASE_ORDER.map(phase => {
              const count = initialAutomations.filter(a => a.phase === phase).length
              if (count === 0) return null
              return (
                <button
                  key={phase}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    phaseFilter === phase
                      ? `${PHASE_COLORS[phase]} border-current`
                      : "bg-background hover:bg-muted border-border"
                  }`}
                  onClick={() => setPhaseFilter(phase)}
                >
                  {phase.charAt(0) + phase.slice(1).toLowerCase()} ({count})
                </button>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
            <LayoutTemplate className="h-4 w-4 mr-1" />
            Templates
          </Button>
          <PermissionGate permission="automations.manage">
            <Button size="sm" onClick={() => router.push(systemMode ? `/dashboard/${propertyId}/automations/new?scope=system` : `${baseUrl}/new`)}>
              <Plus className="h-4 w-4 mr-1" />
              Create Automation
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Table */}
      <AutomationsTable
        rows={pagedRows}
        loading={false}
        emptyMessage={
          initialAutomations.length === 0
            ? "No automations yet. Create one or use a template."
            : "No automations match your search."
        }
        onView={row => setViewingAutomation(row)}
        onEdit={row => router.push(systemMode ? `/dashboard/${propertyId}/automations/${row.id}/edit?scope=system` : `${baseUrl}/${row.id}/edit`)}
        onDuplicate={handleDuplicate}
        onDelete={row => setDeleteTarget(row)}
        onToggleActive={handleToggleActive}
        onDryRun={row => setDryRunTarget(row)}
        canManage={true}
        readOnlyIds={systemMode ? undefined : systemIds}
      />

      {/* Pagination */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <div>
            Showing{" "}
            <span className="font-medium">
              {startIndex}-{endIndex}
            </span>{" "}
            of <span className="font-medium">{total}</span> automations
          </div>
          <PageSizeSelector value={perPage} onChange={setPerPage} disabled={false} />
        </div>
        <div className="flex w-full justify-center sm:w-auto sm:justify-end">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={goToPage}
            disabled={false}
            windowSize={2}
          />
        </div>
      </div>

      {/* View dialog */}
      <AutomationViewDialog
        open={viewingAutomation !== null}
        automation={viewingAutomation}
        propertyId={propertyId}
        onOpenChange={(open) => { if (!open) setViewingAutomation(null) }}
        onEdit={() => {
          if (viewingAutomation) {
            setViewingAutomation(null)
            router.push(systemMode ? `/dashboard/${propertyId}/automations/${viewingAutomation.id}/edit?scope=system` : `${baseUrl}/${viewingAutomation.id}/edit`)
          }
        }}
        onDuplicate={() => {
          if (viewingAutomation) {
            handleDuplicate(viewingAutomation)
          }
        }}
        onDryRun={() => {
          if (viewingAutomation) {
            setViewingAutomation(null)
            setDryRunTarget(viewingAutomation)
          }
        }}
      />

      {/* Delete dialog */}
      <AutomationDeleteDialog
        automation={deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        onConfirm={handleDeleted}
      />

      {/* Dry Run dialog */}
      {dryRunTarget && (
        <DryRunDialog
          open={dryRunTarget !== null}
          onOpenChange={(open) => { if (!open) setDryRunTarget(null) }}
          automationId={dryRunTarget.id}
          automationName={dryRunTarget.name}
          propertyId={propertyId}
        />
      )}

      {/* Templates dialog */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Automation Templates</DialogTitle>
          </DialogHeader>
          <TemplatesGrid
            templates={DEFAULT_AUTOMATION_TEMPLATES}
            onTemplateClick={setSelectedTemplate}
          />
        </DialogContent>
      </Dialog>
      <TemplateDetailDialog
        template={selectedTemplate}
        open={!!selectedTemplate}
        onOpenChange={(open) => !open && setSelectedTemplate(null)}
        propertyId={propertyId}
        companyId={companyId}
        systemMode={systemMode}
      />
    </div>
  )
}

"use client"

import { useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Copy, Trash2, Plus, Search, Loader2, MessageSquare, ExternalLink } from "lucide-react"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { SmsTemplatePreviewDialog } from "./sms-template-preview-dialog"
import { usePermissions } from "@/hooks/use-permissions"
import { toast } from "sonner"

type SmsTemplatesListProps = {
  templates: Array<Record<string, unknown>>
  propertyId: string
  companyId: string
}

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "welcome", label: "Welcome" },
  { value: "reservation", label: "Reservation" },
  { value: "payment", label: "Payment" },
  { value: "review", label: "Review" },
  { value: "notification", label: "Notification" },
  { value: "custom", label: "Custom" },
]

const CATEGORY_COLORS: Record<string, string> = {
  welcome: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400",
  reservation: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  payment: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  review: "border-purple-200 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-400",
  notification: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  custom: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400",
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

export function SmsTemplatesList({ templates: initialTemplates, propertyId, companyId }: SmsTemplatesListProps) {
  const router = useRouter()
  const { can } = usePermissions()
  const canEdit = can("automations.edit_sms_templates")
  const [templates, setTemplates] = useState(initialTemplates)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTemplate, setDeleteTemplate] = useState<Record<string, unknown> | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<Record<string, unknown> | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [testDialogTemplate, setTestDialogTemplate] = useState<Record<string, unknown> | null>(null)
  const [testPhone, setTestPhone] = useState("")

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/automations/sms-templates?propertyId=${propertyId}`)
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`)
      const payload = await res.json()
      setTemplates((payload.data?.templates ?? []) as Array<Record<string, unknown>>)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [propertyId])

  // Client-side filtering
  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return templates.filter((t) => {
      const name = ((t.name as string) ?? "").toLowerCase()
      const slug = ((t.slug as string) ?? "").toLowerCase()
      const matchesSearch = !q || name.includes(q) || slug.includes(q)
      const matchesCategory = categoryFilter === "all" || (t.category as string) === categoryFilter
      return matchesSearch && matchesCategory
    })
  }, [templates, search, categoryFilter])

  function openCreate() {
    router.push(`/dashboard/${propertyId}/automations/sms-templates/new`)
  }

  function openEdit(t: Record<string, unknown>) {
    router.push(`/dashboard/${propertyId}/automations/sms-templates/${t.id}/edit`)
  }

  async function handleDelete() {
    if (!deleteTemplate) return
    setActionLoading(deleteTemplate.id as string)
    try {
      const res = await fetch(
        `/api/v1/automations/sms-templates/${deleteTemplate.id}?propertyId=${propertyId}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error(`Delete failed (${res.status})`)
      setDeleteTemplate(null)
      await fetchTemplates()
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleClone(t: Record<string, unknown>, e: React.MouseEvent) {
    e.stopPropagation()
    setActionLoading(t.id as string)
    try {
      const sourceSlug = t.slug as string
      let slug = `${sourceSlug}-copy`
      const existingSlugs = new Set(templates.map((tmpl) => tmpl.slug as string))
      if (existingSlugs.has(slug)) {
        let counter = 2
        while (existingSlugs.has(`${sourceSlug}-copy-${counter}`)) counter++
        slug = `${sourceSlug}-copy-${counter}`
      }

      const smsBody = String(t.body ?? "").trim()
      if (!smsBody) {
        throw new Error("Cannot duplicate a template with an empty message body")
      }

      const sourcePropertyId = t.property_id as string | null | undefined

      const res = await fetch(
        `/api/v1/automations/sms-templates?propertyId=${propertyId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            ...(sourcePropertyId ? { propertyId: sourcePropertyId } : {}),
            slug,
            name: (t.name as string).replace(/ \(Copy\)$/, "") + " (Copy)",
            description: t.description ?? null,
            body: smsBody,
            category: (t.category as string) ?? "custom",
            status: "draft",
          }),
        },
      )
      const resData = await res.json()
      if (!res.ok) {
        const message =
          resData?.error?.message ||
          (typeof resData?.error?.details === "string" ? resData.error.details : null) ||
          `Clone failed (${res.status})`
        throw new Error(message)
      }

      const created = resData?.data?.smsTemplate as Record<string, unknown> | undefined
      if (created) {
        setTemplates((prev) => [...prev, created])
      } else {
        await fetchTemplates()
      }
      router.refresh()
      toast.success("Template duplicated")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to duplicate template"
      toast.error(message)
      console.error(err)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleToggleStatus(t: Record<string, unknown>) {
    setActionLoading(t.id as string)
    try {
      const newStatus = (t.status as string) === 'active' ? 'draft' : 'active'
      const res = await fetch(
        `/api/v1/automations/sms-templates/${t.id}?propertyId=${propertyId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        },
      )
      if (!res.ok) throw new Error(`Toggle failed (${res.status})`)
      await fetchTemplates()
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(null)
    }
  }

  function handleTestSms() {
    toast.info("Coming soon", { description: "Test SMS sending is not yet implemented." })
    setTestDialogTemplate(null)
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64 pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <PermissionGate permission="automations.add_sms_templates">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create Template
              <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </PermissionGate>
        </div>
      </div>

      {/* Table */}
      <div className="relative border border-border/80 bg-card/50">
        {loading && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/60"
            aria-busy="true"
            aria-label="Loading templates"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-red-50 dark:bg-red-950/30 uppercase">
            <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
              <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
                Name
              </TableHead>
              <TableHead className="w-[180px] py-1.5 text-black/90 dark:text-white/90 font-medium">
                Slug
              </TableHead>
              <TableHead className="w-[120px] py-1.5 text-black/90 dark:text-white/90 font-medium">
                Category
              </TableHead>
              <TableHead className="w-[100px] py-1.5 text-black/90 dark:text-white/90 font-medium">
                Status
              </TableHead>
              <TableHead className="w-[100px] py-1.5 text-black/90 dark:text-white/90 font-medium">
                System
              </TableHead>
              <TableHead className="w-[120px] py-1.5 text-black/90 dark:text-white/90 font-medium">
                Updated
              </TableHead>
              <TableHead className="w-[160px] py-1.5 text-right text-black/90 dark:text-white/90 font-medium">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  {templates.length === 0
                    ? "No SMS templates yet. Create one to get started."
                    : "No templates match your search or filter."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((t) => {
                const id = t.id as string
                const status = (t.status as string) ?? 'draft'
                const isSystem = (t.is_system_default as boolean) ?? false
                const isLoading = actionLoading === id
                const cat = (t.category as string) ?? "custom"

                return (
                  <TableRow
                    key={id}
                    className="cursor-pointer border-border/80 hover:bg-muted/50 data-[state=selected]:bg-muted/30"
                    onClick={() => { setSelectedTemplate(t); setPreviewOpen(true) }}
                  >
                    <TableCell className="py-1.5">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-foreground">{t.name as string}</div>
                        {t.description ? (
                          <div className="text-xs text-muted-foreground">{t.description as string}</div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <code className="text-xs text-muted-foreground">{t.slug as string}</code>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border",
                          CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.custom,
                        )}
                      >
                        {cat}
                      </span>
                    </TableCell>
                    <TableCell className="py-1.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); if (canEdit) handleToggleStatus(t) }}
                        disabled={isLoading || !canEdit}
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                          canEdit ? "cursor-pointer" : "cursor-default opacity-60",
                          status === 'active'
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                            : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
                        )}
                      >
                        {status === 'active' ? "Active" : "Draft"}
                      </button>
                    </TableCell>
                    <TableCell className="py-1.5">
                      {isSystem ? (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
                          Default
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-1.5 text-xs text-muted-foreground whitespace-nowrap">
                      {t.updated_at ? formatDate(t.updated_at as string) : "—"}
                    </TableCell>
                    <TableCell className="py-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : (
                          <>
                            <PermissionGate permission="automations.edit_sms_templates">
                              <Button
                                variant="ghost"
                                size="xs"
                                aria-label="Edit template"
                                className="h-8 w-8 p-0"
                                onClick={() => openEdit(t)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate permission="automations.add_sms_templates">
                              <Button
                                variant="ghost"
                                size="xs"
                                aria-label="Clone template"
                                className="h-8 w-8 p-0"
                                onClick={(e) => handleClone(t, e)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate permission="automations.edit_sms_templates">
                              <Button
                                variant="ghost"
                                size="xs"
                                aria-label="Test SMS"
                                className="h-8 w-8 p-0"
                                onClick={() => { setTestDialogTemplate(t); setTestPhone("") }}
                              >
                                <MessageSquare className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                            <PermissionGate permission="automations.delete_sms_templates">
                              <Button
                                variant="ghost"
                                size="xs"
                                aria-label="Delete template"
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                                onClick={() => setDeleteTemplate(t)}
                                disabled={isSystem}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </PermissionGate>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteTemplate !== null} onOpenChange={(open) => { if (!open) setDeleteTemplate(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{String(deleteTemplate?.name ?? "")}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTemplate(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={actionLoading !== null}>
              {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test SMS Dialog */}
      <Dialog open={testDialogTemplate !== null} onOpenChange={(open) => { if (!open) setTestDialogTemplate(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Test SMS</DialogTitle>
            <DialogDescription>
              Send a test of &quot;{String(testDialogTemplate?.name ?? "")}&quot; to a phone number.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label htmlFor="test-phone" className="text-sm font-medium">Phone number</label>
            <Input
              id="test-phone"
              type="tel"
              placeholder="+1 (555) 123-4567"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogTemplate(null)}>Cancel</Button>
            <Button onClick={handleTestSms}>
              <MessageSquare className="h-4 w-4" />
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <SmsTemplatePreviewDialog
        template={selectedTemplate}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { DollarSign, Loader2, MoreVertical, Pencil, Plus, Trash2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BudgetRow = {
  id: string
  category: string
  period: string
  amount: number
  spent: number
}

type SpendLimitRow = {
  id: string
  category: string
  threshold_amount: number
  alert_enabled: boolean
}

type BudgetManagementProps = {
  propertyId: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERIOD_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
}

function formatCurrency(val: number): string {
  return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
}

const CATEGORY_OPTIONS = [
  "electrical",
  "plumbing",
  "facility",
  "cleaning_issue",
  "other",
] as const

// ---------------------------------------------------------------------------
// Budget Dialog
// ---------------------------------------------------------------------------

type BudgetFormData = {
  category: string
  period: string
  amount: string
}

type BudgetDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  editBudget: BudgetRow | null
  onSaved: () => void
}

const INITIAL_BUDGET_FORM: BudgetFormData = {
  category: "electrical",
  period: "monthly",
  amount: "",
}

function BudgetDialog({ open, onOpenChange, propertyId, editBudget, onSaved }: BudgetDialogProps) {
  const [form, setForm] = useState<BudgetFormData>(INITIAL_BUDGET_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editBudget) {
      setForm({
        category: editBudget.category,
        period: editBudget.period,
        amount: String(editBudget.amount),
      })
    } else {
      setForm(INITIAL_BUDGET_FORM)
    }
    setError(null)
  }, [open, editBudget])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const amount = Number(form.amount)
    if (!form.category.trim() || !form.period || isNaN(amount) || amount < 0) {
      setError("All fields are required. Amount must be >= 0.")
      return
    }

    setIsSubmitting(true)
    try {
      const url = editBudget
        ? `/api/v1/properties/${propertyId}/maintenance/budgets/${editBudget.id}`
        : `/api/v1/properties/${propertyId}/maintenance/budgets`
      const method = editBudget ? "PATCH" : "POST"
      const body = editBudget
        ? { category: form.category, period: form.period, amount }
        : { category: form.category, period: form.period, amount }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error?.message ?? "Failed to save budget.")
      }

      toast.success(editBudget ? "Budget updated" : "Budget created")
      onOpenChange(false)
      onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save budget."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editBudget ? "Edit Budget" : "Add Budget"}</DialogTitle>
          <DialogDescription>
            {editBudget
              ? "Update the budget allocation."
              : "Set a budget allocation for a maintenance category."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Period</Label>
            <Select
              value={form.period}
              onValueChange={(v) => setForm((p) => ({ ...p, period: v }))}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="0.00"
                className="pl-7"
                value={form.amount}
                onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                min={0}
                step={1}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editBudget ? "Save changes" : "Add budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Spend Limit Dialog
// ---------------------------------------------------------------------------

type SpendLimitFormData = {
  category: string
  thresholdAmount: string
  alertEnabled: boolean
}

type SpendLimitDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  editLimit: SpendLimitRow | null
  onSaved: () => void
}

const INITIAL_LIMIT_FORM: SpendLimitFormData = {
  category: "electrical",
  thresholdAmount: "",
  alertEnabled: true,
}

function SpendLimitDialog({ open, onOpenChange, propertyId, editLimit, onSaved }: SpendLimitDialogProps) {
  const [form, setForm] = useState<SpendLimitFormData>(INITIAL_LIMIT_FORM)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (editLimit) {
      setForm({
        category: editLimit.category,
        thresholdAmount: String(editLimit.threshold_amount),
        alertEnabled: editLimit.alert_enabled,
      })
    } else {
      setForm(INITIAL_LIMIT_FORM)
    }
    setError(null)
  }, [open, editLimit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const thresholdAmount = Number(form.thresholdAmount)
    if (!form.category.trim() || isNaN(thresholdAmount) || thresholdAmount < 0) {
      setError("Category and threshold amount are required.")
      return
    }

    setIsSubmitting(true)
    try {
      const url = editLimit
        ? `/api/v1/properties/${propertyId}/maintenance/spend-limits/${editLimit.id}`
        : `/api/v1/properties/${propertyId}/maintenance/spend-limits`
      const method = editLimit ? "PATCH" : "POST"
      const body = editLimit
        ? { category: form.category, thresholdAmount, alertEnabled: form.alertEnabled }
        : { category: form.category, thresholdAmount, alertEnabled: form.alertEnabled }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.error?.message ?? "Failed to save spend limit.")
      }

      toast.success(editLimit ? "Spend limit updated" : "Spend limit created")
      onOpenChange(false)
      onSaved()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to save spend limit."
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editLimit ? "Edit Spend Limit" : "Add Spend Limit"}</DialogTitle>
          <DialogDescription>
            {editLimit
              ? "Update the spend threshold for this category."
              : "Set an alert threshold for a maintenance category."}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          {error && (
            <p className="text-sm text-destructive" role="alert">{error}</p>
          )}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}
              disabled={isSubmitting}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Threshold Amount</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                type="number"
                placeholder="0.00"
                className="pl-7"
                value={form.thresholdAmount}
                onChange={(e) => setForm((p) => ({ ...p, thresholdAmount: e.target.value }))}
                min={0}
                step={1}
                disabled={isSubmitting}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="spend-limit-alert"
              checked={form.alertEnabled}
              onChange={(e) => setForm((p) => ({ ...p, alertEnabled: e.target.checked }))}
              className="h-4 w-4 rounded border-border"
            />
            <Label htmlFor="spend-limit-alert" className="cursor-pointer">
              Alert enabled
            </Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editLimit ? "Save changes" : "Add spend limit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Delete Confirmation Dialog
// ---------------------------------------------------------------------------

type DeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  onConfirm: () => Promise<void>
}

function DeleteDialog({ open, onOpenChange, title, description, onConfirm }: DeleteDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => void handleConfirm()}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BudgetManagement({ propertyId }: BudgetManagementProps) {
  const [budgets, setBudgets] = useState<BudgetRow[]>([])
  const [spendLimits, setSpendLimits] = useState<SpendLimitRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Dialog state
  const [isBudgetDialogOpen, setIsBudgetDialogOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<BudgetRow | null>(null)
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false)
  const [editingLimit, setEditingLimit] = useState<SpendLimitRow | null>(null)
  const [deletingItem, setDeletingItem] = useState<{ type: "budget" | "limit"; id: string; name: string } | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [budgetsRes, limitsRes] = await Promise.all([
        fetch(`/api/v1/properties/${propertyId}/maintenance/budgets`),
        fetch(`/api/v1/properties/${propertyId}/maintenance/spend-limits`),
      ])

      const budgetsPayload = await budgetsRes.json()
      const limitsPayload = await limitsRes.json()

      if (budgetsPayload?.success) {
        const budgetData = (budgetsPayload.data?.budgets ?? []) as Array<{
          id: string
          category: string
          period: string
          amount: number
        }>

        // Fetch category spend for each budget
        const budgetsSpend = await Promise.all(
          budgetData.map(async (b) => {
            try {
              const spendRes = await fetch(
                `/api/v1/properties/${propertyId}/maintenance/budgets/${b.id}/spend-check`,
              )
              if (!spendRes.ok) return { ...b, spent: 0 }
              const spendPayload = await spendRes.json()
              return { ...b, spent: (spendPayload?.data?.spent as number) ?? 0 }
            } catch {
              return { ...b, spent: 0 }
            }
          }),
        )

        setBudgets(budgetsSpend)
      }

      if (limitsPayload?.success) {
        setSpendLimits(
          (limitsPayload.data?.spendLimits ?? []) as SpendLimitRow[],
        )
      }
    } catch {
      toast.error("Failed to load budget data")
    } finally {
      setIsLoading(false)
    }
  }, [propertyId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Handlers
  const handleDeleteBudget = async () => {
    if (!deletingItem) return
    const res = await fetch(
      `/api/v1/properties/${propertyId}/maintenance/budgets/${deletingItem.id}`,
      { method: "DELETE" },
    )
    const payload = await res.json()
    if (!res.ok || !payload?.success) {
      toast.error(payload?.error?.message ?? "Failed to delete budget")
      return
    }
    toast.success("Budget deleted")
    loadData()
  }

  const handleDeleteLimit = async () => {
    if (!deletingItem) return
    const res = await fetch(
      `/api/v1/properties/${propertyId}/maintenance/spend-limits/${deletingItem.id}`,
      { method: "DELETE" },
    )
    const payload = await res.json()
    if (!res.ok || !payload?.success) {
      toast.error(payload?.error?.message ?? "Failed to delete spend limit")
      return
    }
    toast.success("Spend limit deleted")
    loadData()
  }

  const formatCategoryLabel = (c: string) =>
    c.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading budgets…
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5" />
            Budgets &amp; Spend Limits
          </CardTitle>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingBudget(null)
                setIsBudgetDialogOpen(true)
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Budget
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingLimit(null)
                setIsLimitDialogOpen(true)
              }}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add Spend Limit
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 pt-0">
        {/* Budgets */}
        <div>
          <h3 className="mb-2 text-sm font-medium">Budget Allocations</h3>
          {budgets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No budgets configured.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-md border">
              <table className="w-full text-sm min-w-[540px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Category</th>
                    <th className="px-3 py-2 text-left font-medium">Period</th>
                    <th className="px-3 py-2 text-right font-medium">Budget</th>
                    <th className="px-3 py-2 text-right font-medium">Spent</th>
                    <th className="px-3 py-2 text-right font-medium">Remaining</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((b) => {
                    const remaining = b.amount - b.spent
                    const overBudget = remaining < 0
                    return (
                      <tr key={b.id} className="cursor-pointer border-b last:border-b-0 hover:bg-muted/50" onClick={() => {
                            setEditingBudget(b)
                            setIsBudgetDialogOpen(true)
                          }}>
                        <td className="px-3 py-2">{formatCategoryLabel(b.category)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{PERIOD_LABELS[b.period] ?? b.period}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(b.amount)}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(b.spent)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${overBudget ? "text-red-600" : "text-emerald-700"}`}>
                          {overBudget ? `−${formatCurrency(Math.abs(remaining))}` : formatCurrency(remaining)}
                        </td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  aria-label={`Actions for ${formatCategoryLabel(b.category)} budget`}
                                >
                                  <MoreVertical className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-40">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setEditingBudget(b)
                                    setIsBudgetDialogOpen(true)
                                  }}
                                >
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600 focus:text-red-600"
                                  onClick={() =>
                                    setDeletingItem({ type: "budget", id: b.id, name: formatCategoryLabel(b.category) })
                                  }
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Spend Limits */}
        <div>
          <h3 className="mb-2 text-sm font-medium">Spend Limits</h3>
          {spendLimits.length === 0 ? (
            <p className="text-sm text-muted-foreground">No spend limits configured.</p>
          ) : (
            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 rounded-md border">
              <table className="w-full text-sm min-w-[400px]">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Category</th>
                    <th className="px-3 py-2 text-right font-medium">Threshold</th>
                    <th className="px-3 py-2 text-center font-medium">Alert</th>
                    <th className="px-3 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {spendLimits.map((sl) => (
                    <tr key={sl.id} className="cursor-pointer border-b last:border-b-0 hover:bg-muted/50" onClick={() => {
                              setEditingLimit(sl)
                              setIsLimitDialogOpen(true)
                            }}>
                      <td className="px-3 py-2">{formatCategoryLabel(sl.category)}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(sl.threshold_amount)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sl.alert_enabled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-muted text-muted-foreground border border-border"}`}>
                          {sl.alert_enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                aria-label={`Actions for ${formatCategoryLabel(sl.category)} spend limit`}
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingLimit(sl)
                                  setIsLimitDialogOpen(true)
                                }}
                              >
                                <Pencil className="mr-2 h-3.5 w-3.5" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() =>
                                  setDeletingItem({ type: "limit", id: sl.id, name: formatCategoryLabel(sl.category) })
                                }
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>

      {/* Dialogs */}
      <BudgetDialog
        open={isBudgetDialogOpen}
        onOpenChange={setIsBudgetDialogOpen}
        propertyId={propertyId}
        editBudget={editingBudget}
        onSaved={() => void loadData()}
      />
      <SpendLimitDialog
        open={isLimitDialogOpen}
        onOpenChange={setIsLimitDialogOpen}
        propertyId={propertyId}
        editLimit={editingLimit}
        onSaved={() => void loadData()}
      />
      <DeleteDialog
        open={deletingItem !== null}
        onOpenChange={(open) => { if (!open) setDeletingItem(null) }}
        title={deletingItem?.type === "budget" ? "Delete Budget?" : "Delete Spend Limit?"}
        description={`This will permanently remove the ${deletingItem?.type === "budget" ? "budget" : "spend limit"} for "${deletingItem?.name}".`}
        onConfirm={() =>
          deletingItem?.type === "budget"
            ? handleDeleteBudget()
            : handleDeleteLimit()
        }
      />
    </Card>
  )
}

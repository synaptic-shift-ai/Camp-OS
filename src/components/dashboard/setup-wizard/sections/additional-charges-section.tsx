"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { v4 as uuidv4 } from "uuid"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react"
import type { PricingConfig, UserDefinedFee, UserDefinedFeeType, FeeTriggerType } from "@/lib/config/types"
import { useWizardFormStore } from "../wizard-form-store"

const nanToUndefined = (val: unknown) => (typeof val === "number" && isNaN(val) ? undefined : val)

const FEE_TYPE_OPTIONS: { value: UserDefinedFeeType; label: string; description: string }[] = [
  { value: "flat_amount", label: "Flat Amount", description: "One-time charge per reservation" },
  { value: "percentage_of_subtotal", label: "% of Subtotal", description: "Percentage of nightly rate subtotal" },
  { value: "percentage_of_total", label: "% of Total", description: "Percentage of total including other charges" },
  { value: "per_night", label: "Per Night", description: "Charge for each night" },
  { value: "per_guest", label: "Per Guest", description: "Charge per guest (one-time)" },
  { value: "per_guest_per_night", label: "Per Guest Per Night", description: "Charge per guest for each night" },
]

const TRIGGER_TYPE_OPTIONS: { value: FeeTriggerType; label: string; description: string }[] = [
  { value: "always", label: "Always", description: "Auto-apply to every reservation" },
  { value: "manual", label: "Manual", description: "Staff applies manually" },
  { value: "min_nights", label: "Min Nights", description: "Auto-apply when stay is at least X nights" },
  { value: "min_guests", label: "Min Guests", description: "Auto-apply when guests >= X" },
  { value: "has_pets", label: "Has Pets", description: "Auto-apply when reservation includes pets" },
  { value: "date_range", label: "Date Range", description: "Auto-apply during specific dates" },
]

const feeFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(500).optional(),
  fee_type: z.enum(["flat_amount", "percentage_of_subtotal", "percentage_of_total", "per_night", "per_guest", "per_guest_per_night"]),
  value_dollars: z.preprocess(nanToUndefined, z.number().min(0).optional()),
  value_percentage: z.preprocess(nanToUndefined, z.number().min(0).max(100).optional()),
  is_taxable: z.boolean(),
  trigger_type: z.enum(["always", "manual", "min_nights", "min_guests", "has_pets", "date_range"]),
  min_nights: z.preprocess(nanToUndefined, z.number().int().min(1).optional()),
  min_guests: z.preprocess(nanToUndefined, z.number().int().min(1).optional()),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
}).superRefine((data, ctx) => {
  const isPercentage = data.fee_type === "percentage_of_subtotal" || data.fee_type === "percentage_of_total"
  if (isPercentage && data.value_percentage == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Percentage is required", path: ["value_percentage"] })
  if (!isPercentage && data.fee_type !== undefined && data.value_dollars == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount is required", path: ["value_dollars"] })
  if (data.trigger_type === "min_nights" && data.min_nights == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Minimum nights is required", path: ["min_nights"] })
  if (data.trigger_type === "min_guests" && data.min_guests == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Minimum guests is required", path: ["min_guests"] })
  if (data.trigger_type === "date_range" && !data.start_date) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start date is required", path: ["start_date"] })
  if (data.trigger_type === "date_range" && !data.end_date) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date is required", path: ["end_date"] })
})

type FeeFormInput = z.infer<typeof feeFormSchema>

interface Props {
  propertyId: string
  initialConfig?: PricingConfig | null
}

export function AdditionalChargesSection({ propertyId, initialConfig }: Props) {
  const { saveDraft, getDraft } = useWizardFormStore()
  const draftConfig = getDraft(propertyId)?.pricingConfig as PricingConfig | undefined

  const [fees, setFees] = useState<UserDefinedFee[]>(
    draftConfig?.user_defined_fees ?? initialConfig?.user_defined_fees ?? []
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingFee, setEditingFee] = useState<UserDefinedFee | null>(null)

  const form = useForm<FeeFormInput>({
    resolver: zodResolver(feeFormSchema),
    defaultValues: { title: "", description: "", fee_type: "flat_amount", is_taxable: true, trigger_type: "always" },
  })

  const watchFeeType = form.watch("fee_type")
  const watchTriggerType = form.watch("trigger_type")
  const isPercentageType = watchFeeType === "percentage_of_subtotal" || watchFeeType === "percentage_of_total"

  const pushDraft = (nextFees: UserDefinedFee[]) => {
    const draft = getDraft(propertyId) ?? {}
    const existingPricing = (draft.pricingConfig as PricingConfig | undefined) ?? {}
    saveDraft(propertyId, { ...draft, pricingConfig: { ...existingPricing, user_defined_fees: nextFees } })
  }

  const openAdd = () => {
    form.reset({ title: "", description: "", fee_type: "flat_amount", is_taxable: true, trigger_type: "always" })
    setEditingFee(null)
    setIsDialogOpen(true)
  }

  const openEdit = (fee: UserDefinedFee) => {
    form.reset({
      title: fee.title,
      description: fee.description ?? "",
      fee_type: fee.fee_type,
      value_dollars: fee.value_cents ? fee.value_cents / 100 : undefined,
      value_percentage: fee.value_percentage,
      is_taxable: fee.is_taxable,
      trigger_type: fee.trigger_type,
      min_nights: fee.trigger_conditions?.min_nights,
      min_guests: fee.trigger_conditions?.min_guests,
      start_date: fee.trigger_conditions?.start_date,
      end_date: fee.trigger_conditions?.end_date,
    })
    setEditingFee(fee)
    setIsDialogOpen(true)
  }

  const handleSubmit = (data: FeeFormInput) => {
    let triggerConditions: UserDefinedFee["trigger_conditions"]
    if (data.trigger_type === "min_nights" && data.min_nights) triggerConditions = { min_nights: data.min_nights }
    else if (data.trigger_type === "min_guests" && data.min_guests) triggerConditions = { min_guests: data.min_guests }
    else if (data.trigger_type === "date_range") {
      const c: Record<string, string> = {}
      if (data.start_date) c.start_date = data.start_date
      if (data.end_date) c.end_date = data.end_date
      if (Object.keys(c).length) triggerConditions = c as UserDefinedFee["trigger_conditions"]
    }

    const newFee: UserDefinedFee = {
      id: editingFee?.id ?? uuidv4(),
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      fee_type: data.fee_type,
      ...(isPercentageType
        ? data.value_percentage != null ? { value_percentage: data.value_percentage } : {}
        : data.value_dollars ? { value_cents: Math.round(data.value_dollars * 100) } : {}),
      is_taxable: data.is_taxable,
      trigger_type: data.trigger_type,
      ...(triggerConditions ? { trigger_conditions: triggerConditions } : {}),
      display_order: editingFee?.display_order ?? fees.length,
      enabled: editingFee?.enabled ?? true,
      created_at: editingFee?.created_at ?? new Date().toISOString(),
    }

    const next = editingFee ? fees.map((f) => (f.id === editingFee.id ? newFee : f)) : [...fees, newFee]
    setFees(next)
    pushDraft(next)
    setIsDialogOpen(false)
    setEditingFee(null)
    form.reset()
  }

  const toggleEnabled = (id: string) => {
    const next = fees.map((f) => (f.id === id ? { ...f, enabled: !f.enabled } : f))
    setFees(next)
    pushDraft(next)
  }

  const deleteFee = (id: string) => {
    const next = fees.filter((f) => f.id !== id)
    setFees(next)
    pushDraft(next)
  }

  const getFeeTypeLabel = (type: UserDefinedFeeType) => FEE_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
  const formatFeeValue = (fee: UserDefinedFee) =>
    fee.fee_type === "percentage_of_subtotal" || fee.fee_type === "percentage_of_total"
      ? `${fee.value_percentage ?? 0}%`
      : `$${((fee.value_cents ?? 0) / 100).toFixed(2)}`

  const getTriggerBadge = (fee: UserDefinedFee) => {
    switch (fee.trigger_type) {
      case "always": return <Badge variant="secondary">Always</Badge>
      case "manual": return <Badge variant="outline">Manual</Badge>
      case "min_nights": return <Badge variant="secondary">{fee.trigger_conditions?.min_nights}+ nights</Badge>
      case "min_guests": return <Badge variant="secondary">{fee.trigger_conditions?.min_guests}+ guests</Badge>
      case "has_pets": return <Badge variant="secondary">Pets</Badge>
      case "date_range": {
        const s = fee.trigger_conditions?.start_date
        const e = fee.trigger_conditions?.end_date
        return <Badge variant="secondary">{s && e ? `${s} - ${e}` : s ? `From ${s}` : e ? `Until ${e}` : "Date Range"}</Badge>
      }
      default: return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-lg font-semibold">Additional Charges</h3>
          <p className="text-sm text-muted-foreground">
            Configure charges applied to reservations (cleaning, service, pet fees, etc.)
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" onClick={openAdd} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Charge
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingFee ? "Edit Charge" : "Add Charge"}</DialogTitle>
              <DialogDescription>Configure a charge to be applied to reservations</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fee_title">Charge Title</Label>
                <Input id="fee_title" placeholder="e.g., Cleaning Fee, Resort Fee" {...form.register("title")} />
                {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee_description">Description (optional)</Label>
                <Input id="fee_description" placeholder="Brief description" {...form.register("description")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee_type">Charge Type</Label>
                <Select value={watchFeeType} onValueChange={(v) => form.setValue("fee_type", v as UserDefinedFeeType)}>
                  <SelectTrigger id="fee_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <div><div>{o.label}</div><div className="text-xs text-muted-foreground">{o.description}</div></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isPercentageType ? (
                <div className="space-y-2">
                  <Label htmlFor="fee_pct">Percentage (%)</Label>
                  <Input id="fee_pct" type="number" step="0.1" min="0" max="100" placeholder="5.0" {...form.register("value_percentage", { valueAsNumber: true })} />
                  {form.formState.errors.value_percentage && <p className="text-sm text-destructive">{form.formState.errors.value_percentage.message}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="fee_amt">Amount ($)</Label>
                  <Input id="fee_amt" type="number" step="0.01" min="0" placeholder="25.00" {...form.register("value_dollars", { valueAsNumber: true })} />
                  {form.formState.errors.value_dollars && <p className="text-sm text-destructive">{form.formState.errors.value_dollars.message}</p>}
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Taxable</Label>
                  <p className="text-sm text-muted-foreground">Include in tax calculation</p>
                </div>
                <Switch checked={form.watch("is_taxable")} onCheckedChange={(v) => form.setValue("is_taxable", v)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger_type">When to Apply</Label>
                <Select value={watchTriggerType} onValueChange={(v) => form.setValue("trigger_type", v as FeeTriggerType)}>
                  <SelectTrigger id="trigger_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        <div><div>{o.label}</div><div className="text-xs text-muted-foreground">{o.description}</div></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {watchTriggerType === "min_nights" && (
                <div className="space-y-2">
                  <Label htmlFor="min_nights">Minimum Nights</Label>
                  <Input id="min_nights" type="number" min="1" placeholder="7" {...form.register("min_nights", { valueAsNumber: true })} />
                  {form.formState.errors.min_nights && <p className="text-sm text-destructive">{form.formState.errors.min_nights.message}</p>}
                </div>
              )}
              {watchTriggerType === "min_guests" && (
                <div className="space-y-2">
                  <Label htmlFor="min_guests">Minimum Guests</Label>
                  <Input id="min_guests" type="number" min="1" placeholder="4" {...form.register("min_guests", { valueAsNumber: true })} />
                  {form.formState.errors.min_guests && <p className="text-sm text-destructive">{form.formState.errors.min_guests.message}</p>}
                </div>
              )}
              {watchTriggerType === "date_range" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Input type="date" {...form.register("start_date")} />
                    {form.formState.errors.start_date && <p className="text-sm text-destructive">{form.formState.errors.start_date.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>End Date</Label>
                    <Input type="date" {...form.register("end_date")} />
                    {form.formState.errors.end_date && <p className="text-sm text-destructive">{form.formState.errors.end_date.message}</p>}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit" size="sm">{editingFee ? "Save Changes" : "Add Charge"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {fees.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No additional charges configured yet.</p>
          <p className="text-sm">Click &quot;Add Charge&quot; to create your first charge.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {fees.map((fee) => (
            <div key={fee.id} className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 ${fee.enabled ? "bg-card" : "bg-muted/50 opacity-60"}`}>
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:mt-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{fee.title}</span>
                    {getTriggerBadge(fee)}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    {getFeeTypeLabel(fee.fee_type)} · {formatFeeValue(fee)}{fee.is_taxable && " · Taxable"}
                  </div>
                  {fee.description && <div className="mt-1 text-xs text-muted-foreground">{fee.description}</div>}
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-1 border-t border-border/60 pt-3 sm:gap-2 sm:border-0 sm:pt-0">
                <Switch checked={fee.enabled} onCheckedChange={() => toggleEnabled(fee.id)} className="shrink-0" aria-label={`${fee.enabled ? "Disable" : "Enable"} ${fee.title}`} />
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => openEdit(fee)} aria-label={`Edit ${fee.title}`}><Pencil className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => deleteFee(fee.id)} aria-label={`Delete ${fee.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

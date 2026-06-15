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
import type { RateDiscountsConfig, UserDefinedDiscount, UserDefinedDiscountType, DiscountTriggerType } from "@/lib/config/types"
import { useWizardFormStore } from "../wizard-form-store"

const nanToUndefined = (val: unknown) => (typeof val === "number" && isNaN(val) ? undefined : val)

const DISCOUNT_TYPE_OPTIONS: { value: UserDefinedDiscountType; label: string; description: string }[] = [
  { value: "percentage_of_subtotal", label: "% of Subtotal", description: "Percentage off nightly rate subtotal" },
  { value: "percentage_of_total", label: "% of Total", description: "Percentage off the full total" },
  { value: "flat_amount", label: "Flat Amount", description: "Fixed dollar amount off" },
]

const TRIGGER_TYPE_OPTIONS: { value: DiscountTriggerType; label: string; description: string }[] = [
  { value: "manual", label: "Manual", description: "Staff applies manually" },
  { value: "min_nights", label: "Min Nights", description: "Auto-apply when stay is at least X nights" },
  { value: "min_guests", label: "Min Guests", description: "Auto-apply when guests >= X" },
  { value: "date_range", label: "Date Range", description: "Auto-apply during specific dates" },
]

const discountFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(100),
  description: z.string().max(500).optional(),
  discount_type: z.enum(["percentage_of_subtotal", "percentage_of_total", "flat_amount"]),
  value_dollars: z.preprocess(nanToUndefined, z.number().min(0).optional()),
  value_percentage: z.preprocess(nanToUndefined, z.number().min(0).max(100).optional()),
  trigger_type: z.enum(["manual", "min_nights", "min_guests", "date_range"]),
  min_nights: z.preprocess(nanToUndefined, z.number().int().min(1).optional()),
  min_guests: z.preprocess(nanToUndefined, z.number().int().min(1).optional()),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  max_discount_dollars: z.preprocess(nanToUndefined, z.number().min(0).optional()),
}).superRefine((data, ctx) => {
  const isPct = data.discount_type === "percentage_of_subtotal" || data.discount_type === "percentage_of_total"
  if (isPct && data.value_percentage == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Percentage is required", path: ["value_percentage"] })
  if (!isPct && data.value_dollars == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Amount is required", path: ["value_dollars"] })
  if (data.trigger_type === "min_nights" && data.min_nights == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Minimum nights is required", path: ["min_nights"] })
  if (data.trigger_type === "min_guests" && data.min_guests == null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Minimum guests is required", path: ["min_guests"] })
  if (data.trigger_type === "date_range" && !data.start_date) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Start date is required", path: ["start_date"] })
  if (data.trigger_type === "date_range" && !data.end_date) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "End date is required", path: ["end_date"] })
})

type DiscountFormInput = z.infer<typeof discountFormSchema>

interface Props {
  propertyId: string
  initialConfig?: RateDiscountsConfig | null
}

export function DiscountsSection({ propertyId, initialConfig }: Props) {
  const { saveDraft, getDraft } = useWizardFormStore()
  const draftConfig = getDraft(propertyId)?.rateDiscountsConfig as RateDiscountsConfig | undefined

  const [discounts, setDiscounts] = useState<UserDefinedDiscount[]>(
    draftConfig?.user_defined_discounts ?? initialConfig?.user_defined_discounts ?? []
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState<UserDefinedDiscount | null>(null)

  const form = useForm<DiscountFormInput>({
    resolver: zodResolver(discountFormSchema),
    defaultValues: { title: "", description: "", discount_type: "percentage_of_subtotal", trigger_type: "manual" },
  })

  const watchDiscountType = form.watch("discount_type")
  const watchTriggerType = form.watch("trigger_type")
  const isPercentageType = watchDiscountType === "percentage_of_subtotal" || watchDiscountType === "percentage_of_total"

  const pushDraft = (next: UserDefinedDiscount[]) => {
    const draft = getDraft(propertyId) ?? {}
    saveDraft(propertyId, { ...draft, rateDiscountsConfig: { user_defined_discounts: next } })
  }

  const openAdd = () => {
    form.reset({ title: "", description: "", discount_type: "percentage_of_subtotal", trigger_type: "manual" })
    setEditingDiscount(null)
    setIsDialogOpen(true)
  }

  const openEdit = (d: UserDefinedDiscount) => {
    form.reset({
      title: d.title,
      description: d.description ?? "",
      discount_type: d.discount_type,
      value_dollars: d.value_cents ? d.value_cents / 100 : undefined,
      value_percentage: d.value_percentage,
      trigger_type: d.trigger_type,
      min_nights: d.trigger_conditions?.min_nights,
      min_guests: d.trigger_conditions?.min_guests,
      start_date: d.trigger_conditions?.start_date,
      end_date: d.trigger_conditions?.end_date,
      max_discount_dollars: d.max_discount_cents ? d.max_discount_cents / 100 : undefined,
    })
    setEditingDiscount(d)
    setIsDialogOpen(true)
  }

  const handleSubmit = (data: DiscountFormInput) => {
    let triggerConditions: UserDefinedDiscount["trigger_conditions"]
    if (data.trigger_type === "min_nights" && data.min_nights) triggerConditions = { min_nights: data.min_nights }
    else if (data.trigger_type === "min_guests" && data.min_guests) triggerConditions = { min_guests: data.min_guests }
    else if (data.trigger_type === "date_range") {
      const c: Record<string, string> = {}
      if (data.start_date) c.start_date = data.start_date
      if (data.end_date) c.end_date = data.end_date
      if (Object.keys(c).length) triggerConditions = c as UserDefinedDiscount["trigger_conditions"]
    }

    const newDiscount: UserDefinedDiscount = {
      id: editingDiscount?.id ?? uuidv4(),
      title: data.title,
      ...(data.description ? { description: data.description } : {}),
      discount_type: data.discount_type,
      ...(isPercentageType
        ? data.value_percentage != null ? { value_percentage: data.value_percentage } : {}
        : data.value_dollars ? { value_cents: Math.round(data.value_dollars * 100) } : {}),
      trigger_type: data.trigger_type,
      ...(triggerConditions ? { trigger_conditions: triggerConditions } : {}),
      ...(data.max_discount_dollars ? { max_discount_cents: Math.round(data.max_discount_dollars * 100) } : {}),
      display_order: editingDiscount?.display_order ?? discounts.length,
      enabled: editingDiscount?.enabled ?? true,
      created_at: editingDiscount?.created_at ?? new Date().toISOString(),
    }

    const next = editingDiscount ? discounts.map((d) => (d.id === editingDiscount.id ? newDiscount : d)) : [...discounts, newDiscount]
    setDiscounts(next)
    pushDraft(next)
    setIsDialogOpen(false)
    setEditingDiscount(null)
    form.reset()
  }

  const toggleEnabled = (id: string) => {
    const next = discounts.map((d) => (d.id === id ? { ...d, enabled: !d.enabled } : d))
    setDiscounts(next)
    pushDraft(next)
  }

  const deleteDiscount = (id: string) => {
    const next = discounts.filter((d) => d.id !== id)
    setDiscounts(next)
    pushDraft(next)
  }

  const getTypeLabel = (type: UserDefinedDiscountType) => DISCOUNT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type
  const formatValue = (d: UserDefinedDiscount) =>
    d.discount_type === "percentage_of_subtotal" || d.discount_type === "percentage_of_total"
      ? `${d.value_percentage ?? 0}%`
      : `$${((d.value_cents ?? 0) / 100).toFixed(2)}`

  const getTriggerBadge = (d: UserDefinedDiscount) => {
    switch (d.trigger_type) {
      case "manual": return <Badge variant="outline">Manual</Badge>
      case "min_nights": return <Badge variant="secondary">{d.trigger_conditions?.min_nights}+ nights</Badge>
      case "min_guests": return <Badge variant="secondary">{d.trigger_conditions?.min_guests}+ guests</Badge>
      case "date_range": {
        const s = d.trigger_conditions?.start_date
        const e = d.trigger_conditions?.end_date
        return <Badge variant="secondary">{s && e ? `${s} - ${e}` : s ? `From ${s}` : e ? `Until ${e}` : "Date Range"}</Badge>
      }
      default: return null
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-lg font-semibold">Discounts</h3>
          <p className="text-sm text-muted-foreground">
            Configure discounts that can be applied automatically or manually to reservations
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button type="button" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />Add Discount
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingDiscount ? "Edit Discount" : "Add Discount"}</DialogTitle>
              <DialogDescription>Configure a discount to be applied to reservations</DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discount_title">Discount Title</Label>
                <Input id="discount_title" placeholder="e.g., Weekly Stay Discount, Early Bird" {...form.register("title")} />
                {form.formState.errors.title && <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_description">Description (optional)</Label>
                <Input id="discount_description" placeholder="Brief description" {...form.register("description")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="discount_type">Discount Type</Label>
                <Select value={watchDiscountType} onValueChange={(v) => form.setValue("discount_type", v as UserDefinedDiscountType)}>
                  <SelectTrigger id="discount_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DISCOUNT_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} textValue={o.label}>
                        <div><div>{o.label}</div><div className="text-xs text-muted-foreground">{o.description}</div></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {isPercentageType ? (
                <div className="space-y-2">
                  <Label htmlFor="discount_pct">Percentage (%)</Label>
                  <Input id="discount_pct" type="number" step="0.1" min="0" max="100" placeholder="10.0" {...form.register("value_percentage", { valueAsNumber: true })} />
                  {form.formState.errors.value_percentage && <p className="text-sm text-destructive">{form.formState.errors.value_percentage.message}</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="discount_amt">Amount ($)</Label>
                  <Input id="discount_amt" type="number" step="0.01" min="0" placeholder="25.00" {...form.register("value_dollars", { valueAsNumber: true })} />
                  {form.formState.errors.value_dollars && <p className="text-sm text-destructive">{form.formState.errors.value_dollars.message}</p>}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="trigger_type">When to Apply</Label>
                <Select value={watchTriggerType} onValueChange={(v) => form.setValue("trigger_type", v as DiscountTriggerType)}>
                  <SelectTrigger id="trigger_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} textValue={o.label}>
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
              <div className="space-y-2">
                <Label htmlFor="max_discount">Maximum Discount (optional)</Label>
                <Input id="max_discount" type="number" step="0.01" min="0" placeholder="100.00" {...form.register("max_discount_dollars", { valueAsNumber: true })} />
                <p className="text-sm text-muted-foreground">Cap the discount at this amount (useful for percentage discounts)</p>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">{editingDiscount ? "Save Changes" : "Add Discount"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {discounts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No discounts configured yet.</p>
          <p className="text-sm">Click &quot;Add Discount&quot; to create your first discount.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {discounts.map((discount) => (
            <div key={discount.id} className={`flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4 ${discount.enabled ? "bg-card" : "bg-muted/50 opacity-60"}`}>
              <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
                <GripVertical className="mt-0.5 h-4 w-4 shrink-0 cursor-grab text-muted-foreground sm:mt-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium">{discount.title}</span>
                    {getTriggerBadge(discount)}
                  </div>
                  <div className="mt-0.5 break-words text-sm text-muted-foreground">
                    {getTypeLabel(discount.discount_type)} · {formatValue(discount)} off
                    {discount.max_discount_cents && ` (max $${(discount.max_discount_cents / 100).toFixed(2)})`}
                  </div>
                  {discount.description && <div className="mt-1 break-words text-xs text-muted-foreground">{discount.description}</div>}
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-end gap-1 border-t border-border/60 pt-3 sm:gap-2 sm:border-0 sm:pt-0">
                <Switch checked={discount.enabled} onCheckedChange={() => toggleEnabled(discount.id)} className="shrink-0" aria-label={`${discount.enabled ? "Disable" : "Enable"} ${discount.title}`} />
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => openEdit(discount)} aria-label={`Edit ${discount.title}`}><Pencil className="h-4 w-4" /></Button>
                <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => deleteDiscount(discount.id)} aria-label={`Delete ${discount.title}`}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

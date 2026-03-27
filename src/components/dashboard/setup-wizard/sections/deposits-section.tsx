"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { depositConfigFormSchema, type DepositConfigFormInput } from "@/lib/config/schemas"
import type { DepositConfig, BookingType } from "@/lib/config/types"
import { useWizardFormStore } from "../wizard-form-store"

const BOOKING_TYPES: { value: BookingType; label: string; description: string }[] = [
  { value: "nightly", label: "Nightly", description: "Standard short-term stays" },
  { value: "weekly", label: "Weekly", description: "7+ day reservations" },
  { value: "monthly", label: "Monthly", description: "30+ day reservations" },
  { value: "seasonal", label: "Seasonal", description: "Multi-month seasonal stays" },
  { value: "long_term", label: "Long-term", description: "Extended stays (6+ months)" },
]

interface Props {
  propertyId: string
  initialConfig?: DepositConfig | null
}

export function DepositsSection({ propertyId, initialConfig }: Props) {
  const { saveDraft, getDraft } = useWizardFormStore()
  const draftConfig = getDraft(propertyId)?.depositConfig as DepositConfig | undefined
  const cfg = draftConfig ?? initialConfig

  const { register, watch, setValue, getValues } = useForm<DepositConfigFormInput>({
    resolver: zodResolver(depositConfigFormSchema),
    defaultValues: cfg
      ? {
          require_deposit: cfg.require_deposit,
          deposit_type: cfg.deposit_type,
          deposit_percentage: cfg.deposit_percentage,
          deposit_amount_dollars: cfg.deposit_amount_cents ? cfg.deposit_amount_cents / 100 : null,
          applies_to_booking_types: cfg.applies_to_booking_types,
          exempt_if_paid_in_full: cfg.exempt_if_paid_in_full,
          full_payment_required_days_before: cfg.full_payment_required_days_before,
        }
      : {
          require_deposit: false,
          deposit_type: "percentage",
          deposit_percentage: 25,
          deposit_amount_dollars: null,
          applies_to_booking_types: ["nightly", "weekly", "monthly", "seasonal", "long_term"],
          exempt_if_paid_in_full: true,
          full_payment_required_days_before: null,
        },
  })

  const requireDeposit = watch("require_deposit")
  const depositType = watch("deposit_type")
  const appliesToBookingTypes = watch("applies_to_booking_types")
  const exemptIfPaidInFull = watch("exempt_if_paid_in_full")

  const pushDraft = () => {
    const data = getValues()
    const nextConfig: DepositConfig = {
      require_deposit: data.require_deposit,
      deposit_type: data.deposit_type,
      applies_to_booking_types: data.applies_to_booking_types,
      exempt_if_paid_in_full: data.exempt_if_paid_in_full,
      full_payment_required_days_before: data.full_payment_required_days_before === undefined ? null : data.full_payment_required_days_before,
    }
    if (data.deposit_percentage !== undefined) nextConfig.deposit_percentage = data.deposit_percentage
    if (data.deposit_amount_dollars != null) nextConfig.deposit_amount_cents = Math.round(data.deposit_amount_dollars * 100)
    const draft = getDraft(propertyId) ?? {}
    saveDraft(propertyId, { ...draft, depositConfig: nextConfig as unknown as Record<string, unknown> })
  }

  useEffect(() => {
    const sub = watch(() => pushDraft())
    return () => sub.unsubscribe()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watch])

  const toggleBookingType = (type: BookingType) => {
    const current = appliesToBookingTypes
    const updated = current.includes(type) ? current.filter((t: BookingType) => t !== type) : [...current, type]
    setValue("applies_to_booking_types", updated, { shouldDirty: true })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Deposits</h3>
        <p className="text-sm text-muted-foreground">
          Configure deposit requirements and payment timing rules for reservations
        </p>
      </div>
      {/* Deposit Requirement */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Require Deposit</Label>
            <p className="text-sm text-muted-foreground">Require guests to pay a deposit at booking</p>
          </div>
          <Switch checked={requireDeposit} onCheckedChange={(v) => setValue("require_deposit", v, { shouldDirty: true })} />
        </div>
        {requireDeposit && (
          <Alert><Info className="h-4 w-4" /><AlertDescription>Deposits help secure reservations and reduce no-shows. Configure the amount and rules below.</AlertDescription></Alert>
        )}
      </div>

      {requireDeposit && (
        <>
          <div className="border-t border-border pt-4 space-y-4">
            <h4 className="text-sm font-semibold">Deposit Amount</h4>
            <div className="space-y-2">
              <Label htmlFor="deposit_type">Deposit Type</Label>
              <Select value={depositType} onValueChange={(v) => setValue("deposit_type", v as any, { shouldDirty: true })}>
                <SelectTrigger id="deposit_type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage of Total</SelectItem>
                  <SelectItem value="flat_amount">Flat Amount</SelectItem>
                  <SelectItem value="first_night">First Night&apos;s Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {depositType === "percentage" && (
              <div className="space-y-2">
                <Label htmlFor="deposit_percentage">Deposit Percentage (%)</Label>
                <Input id="deposit_percentage" type="number" min="0" max="100" step="1" placeholder="25" {...register("deposit_percentage", { valueAsNumber: true })} />
                <p className="text-sm text-muted-foreground">Percentage of reservation total (e.g., 25% of $400 = $100 deposit)</p>
              </div>
            )}
            {depositType === "flat_amount" && (
              <div className="space-y-2">
                <Label htmlFor="deposit_amount_dollars">Deposit Amount ($)</Label>
                <Input id="deposit_amount_dollars" type="number" min="0" step="0.01" placeholder="100.00" {...register("deposit_amount_dollars", { valueAsNumber: true })} />
                <p className="text-sm text-muted-foreground">Fixed deposit amount regardless of reservation total</p>
              </div>
            )}
            {depositType === "first_night" && (
              <Alert><Info className="h-4 w-4" /><AlertDescription>Deposit will be the cost of the first night of the stay (including all fees and taxes for that night).</AlertDescription></Alert>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h4 className="text-sm font-semibold">Booking Type Rules</h4>
            <p className="text-xs text-muted-foreground">Which booking types require a deposit</p>
            <div className="space-y-3">
              {BOOKING_TYPES.map((type) => (
                <div key={type.value} className="flex items-start space-x-3">
                  <Checkbox id={`bt-${type.value}`} checked={appliesToBookingTypes.includes(type.value)} onCheckedChange={() => toggleBookingType(type.value)} />
                  <div className="grid gap-1.5 leading-none">
                    <Label htmlFor={`bt-${type.value}`} className="cursor-pointer font-medium">{type.label}</Label>
                    <p className="text-sm text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              ))}
            </div>
            {appliesToBookingTypes.length === 0 && (
              <Alert variant="destructive"><AlertDescription>Warning: No booking types selected. Deposits will not be required for any reservations.</AlertDescription></Alert>
            )}
          </div>

          <div className="border-t border-border pt-4 space-y-4">
            <h4 className="text-sm font-semibold">Exemptions & Payment Deadlines</h4>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Exempt if Paid in Full</Label>
                <p className="text-sm text-muted-foreground">Skip deposit if guest pays full amount upfront</p>
              </div>
              <Switch checked={exemptIfPaidInFull} onCheckedChange={(v) => setValue("exempt_if_paid_in_full", v, { shouldDirty: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="full_payment_days">Full Payment Required (days before check-in)</Label>
              <Input id="full_payment_days" type="number" min="0" max="90" placeholder="Optional – leave blank for no requirement" {...register("full_payment_required_days_before", { setValueAs: (v) => v === "" || v === null ? null : parseInt(v) })} />
              <p className="text-sm text-muted-foreground">Require full payment X days before check-in</p>
            </div>
            <Alert><Info className="h-4 w-4" /><AlertDescription>Example: With 25% deposit and full payment required 7 days before check-in, guests pay 25% at booking and the remaining 75% at least 7 days before arrival.</AlertDescription></Alert>
          </div>
        </>
      )}
    </div>
  )
}

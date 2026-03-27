"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useWizardFormStore } from "../wizard-form-store"
import type { PricingConfig } from "@/lib/config/types"

interface Props {
  propertyId: string
  initialConfig?: PricingConfig | null
}

export function TaxesSection({ propertyId, initialConfig }: Props) {
  const { saveDraft, getDraft } = useWizardFormStore()

  const draftConfig = getDraft(propertyId)?.pricingConfig as PricingConfig | undefined

  const [taxRatePercentage, setTaxRatePercentage] = useState(
    draftConfig?.tax_rate != null
      ? draftConfig.tax_rate * 100
      : initialConfig?.tax_rate
        ? initialConfig.tax_rate * 100
        : 0
  )
  const [taxName, setTaxName] = useState(
    draftConfig?.tax_name ?? initialConfig?.tax_name ?? "Tax"
  )

  const pushDraft = (rate: number, name: string) => {
    const draft = getDraft(propertyId) ?? {}
    const existingPricing = (draft.pricingConfig as PricingConfig | undefined) ?? {}
    saveDraft(propertyId, {
      ...draft,
      pricingConfig: {
        ...existingPricing,
        tax_rate: rate / 100,
        tax_name: name,
      },
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Taxes</h3>
        <p className="text-sm text-muted-foreground">Configure tax rates applied to reservations</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="tax_rate_percentage">Tax Rate (%)</Label>
          <Input
            id="tax_rate_percentage"
            type="number"
            step="0.01"
            min="0"
            max="100"
            placeholder="8.5"
            value={taxRatePercentage || ""}
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0
              setTaxRatePercentage(val)
              pushDraft(val, taxName)
            }}
          />
          <p className="text-sm text-muted-foreground">Example: 8.5% sales tax or occupancy tax</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="tax_name">Tax Name</Label>
          <Input
            id="tax_name"
            placeholder="Sales Tax"
            value={taxName}
            onChange={(e) => {
              setTaxName(e.target.value)
              pushDraft(taxRatePercentage, e.target.value)
            }}
          />
          <p className="text-sm text-muted-foreground">Displayed on invoices and receipts</p>
        </div>
      </div>
    </div>
  )
}

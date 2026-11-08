"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Plus } from "lucide-react"
import type { PropertyReservationTypesConfig, BookingType, SiteTypeRateConfig } from "@/lib/config/types"
import { DEFAULT_RESERVATION_TYPES_CONFIG } from "@/lib/config/types"
import { useWizardFormStore } from "../wizard-form-store"
import { parseEnabledReservationTypesFromDB, parseReservationTypesConfigFromDB } from "@/lib/config/resolution"



import { SITE_TYPES, siteTypeLabel } from '@/lib/constants'
type RatePeriod = "nightly" | "weekly" | "monthly"
type SiteTypeRates = Record<string, Record<RatePeriod, SiteTypeRateConfig>>

/** Thresholds come from the canonical property defaults, never from literals here. */
const periodDefault = (period: RatePeriod): SiteTypeRateConfig => {
  const { min_nights, max_nights } = DEFAULT_RESERVATION_TYPES_CONFIG[period]
  return { rate_cents: null, min_nights, max_nights }
}

const DEFAULT_RATES = (): Record<RatePeriod, SiteTypeRateConfig> => ({
  nightly: periodDefault("nightly"),
  weekly: periodDefault("weekly"),
  monthly: periodDefault("monthly"),
})

/**
 * Merge a stored period over its default. `max_nights` is checked for presence
 * rather than coalesced, so a deliberate null (an unbounded period) survives
 * instead of being replaced by the default bound.
 */
const resolvePeriod = (raw: unknown, period: RatePeriod): SiteTypeRateConfig => {
  const fallback = periodDefault(period)
  if (!raw || typeof raw !== "object") return fallback
  const stored = raw as Partial<SiteTypeRateConfig>
  return {
    rate_cents: stored.rate_cents ?? null,
    min_nights: stored.min_nights ?? fallback.min_nights,
    max_nights: "max_nights" in stored ? (stored.max_nights ?? null) : fallback.max_nights,
  }
}

interface Props {
  propertyId: string
  siteTypes: Array<{ siteType: string }>
  allowedSiteTypesFromConfig: string[]
  siteTypeRatesFromConfig: Record<string, unknown>
  reservationTypeConfigRaw: unknown
  enabledReservationTypesRaw: unknown
}

export function SiteTypesRatesSection({
  propertyId,
  siteTypes,
  allowedSiteTypesFromConfig,
  siteTypeRatesFromConfig,
  reservationTypeConfigRaw,
  enabledReservationTypesRaw,
}: Props) {
  const { saveDraft, getDraft } = useWizardFormStore()

  const draftSiteTypeConfig = getDraft(propertyId)?.siteTypeConfig as
    | { allowed_site_types?: string[]; site_type_rates?: Record<string, unknown> }
    | undefined
  const draftRTC = getDraft(propertyId)?.reservationTypeConfig as PropertyReservationTypesConfig | undefined
  const draftERT = getDraft(propertyId)?.enabledReservationTypes as BookingType[] | undefined

  const [enabledTypes] = useState<BookingType[]>(
    draftERT ?? parseEnabledReservationTypesFromDB(enabledReservationTypesRaw) ?? ["nightly", "weekly", "monthly"]
  )
  const [config] = useState<PropertyReservationTypesConfig>(
    draftRTC ?? parseReservationTypesConfigFromDB(reservationTypeConfigRaw) ?? DEFAULT_RESERVATION_TYPES_CONFIG
  )

  const initAllowed = draftSiteTypeConfig?.allowed_site_types ?? allowedSiteTypesFromConfig
  const rawRates = draftSiteTypeConfig?.site_type_rates ?? siteTypeRatesFromConfig

  const [allowedSiteTypes, setAllowedSiteTypes] = useState<string[]>(
    initAllowed.length > 0 ? initAllowed : siteTypes.map((s) => s.siteType)
  )

  const buildRates = (types: string[]): SiteTypeRates =>
    types.reduce<SiteTypeRates>((acc, st) => {
      const cfg = ((rawRates as Record<string, unknown>)[st] ?? {}) as Record<string, unknown>
      acc[st] = {
        nightly: resolvePeriod(cfg.nightly, "nightly"),
        weekly: resolvePeriod(cfg.weekly, "weekly"),
        monthly: resolvePeriod(cfg.monthly, "monthly"),
      }
      return acc
    }, {})

  const [siteTypeRates, setSiteTypeRates] = useState<SiteTypeRates>(buildRates(allowedSiteTypes))
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [rateInput, setRateInput] = useState("")

  const available = SITE_TYPES.filter((st) => !allowedSiteTypes.some((a) => a.toLowerCase() === st.toLowerCase()))

  const pushDraft = (types: string[], rates: SiteTypeRates) => {
    const draft = getDraft(propertyId) ?? {}
    saveDraft(propertyId, {
      ...draft,
      reservationTypeConfig: config as unknown as Record<string, unknown>,
      enabledReservationTypes: enabledTypes,
      siteTypeConfig: { allowed_site_types: types, site_type_rates: rates },
    })
  }

  const addSiteType = (st: string) => {
    const next = [...allowedSiteTypes, st]
    const nextRates = { ...siteTypeRates, [st]: siteTypeRates[st] ?? DEFAULT_RATES() }
    setAllowedSiteTypes(next)
    setSiteTypeRates(nextRates)
    pushDraft(next, nextRates)
  }

  const removeSiteType = (st: string) => {
    const next = allowedSiteTypes.filter((t) => t !== st)
    setAllowedSiteTypes(next)
    pushDraft(next, siteTypeRates)
  }

  const parseDollarsToCents = (d: string) => { const v = parseFloat(d); return isNaN(v) || v < 0 ? null : Math.round(v * 100) }
  const formatCents = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2))

  const updateRate = (st: string, period: "nightly" | "weekly" | "monthly", field: keyof SiteTypeRateConfig, value: number | null) => {
    const nextRates = { ...siteTypeRates, [st]: { ...siteTypeRates[st], [period]: { ...siteTypeRates[st]?.[period], [field]: value } } } as SiteTypeRates
    setSiteTypeRates(nextRates)
    pushDraft(allowedSiteTypes, nextRates)
  }

  const orderedSiteTypes = allowedSiteTypes
    .map((st) => ({ siteType: st }))
    .sort((a, b) => {
      const ia = SITE_TYPES.findIndex((t) => t.toLowerCase() === a.siteType.toLowerCase())
      const ib = SITE_TYPES.findIndex((t) => t.toLowerCase() === b.siteType.toLowerCase())
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
    })

  const activeBookingTypes = (["nightly", "weekly", "monthly"] as const).filter((t) => enabledTypes.includes(t))

  return (
    <div className="space-y-6">
      {/* Site Types picker */}
      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 space-y-1.5">
            <h3 className="text-lg font-semibold">Site types rates</h3>
            <p className="text-sm text-muted-foreground">Set default rates by site type</p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <Plus className="mr-2 h-4 w-4" />Add Site Type
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {available.length === 0 ? (
                <DropdownMenuItem disabled>All site types added</DropdownMenuItem>
              ) : available.map((st) => (
                <DropdownMenuItem key={st} onClick={() => addSiteType(st)}>{siteTypeLabel(st)} Site</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {allowedSiteTypes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No site types selected. Use &quot;Add Site Type&quot; to choose which site types this property offers.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allowedSiteTypes.map((st) => (
              <div key={st} className="inline-flex max-w-full items-center gap-2 rounded-full border bg-muted px-3 py-1.5 text-sm">
                <span className="min-w-0 truncate">{st} Site</span>
                <button type="button" className="shrink-0 text-xs text-muted-foreground hover:text-destructive" aria-label={`Remove ${st}`} onClick={() => removeSiteType(st)}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Rate Configuration */}
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold tracking-tight">Rate Configuration</h3>
        <p className="text-sm text-muted-foreground">Set nightly, weekly, and monthly rates for each site type</p>
      </div>

      {orderedSiteTypes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No site types found for this property.</p>
          <p className="text-sm">Add a site type above to configure rates.</p>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-2">
          {orderedSiteTypes.map(({ siteType }) => {
            const rates = siteTypeRates[siteType] ?? DEFAULT_RATES()
            return (
              <AccordionItem key={siteType} value={siteType} className="rounded-lg border px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="font-medium">{siteType} Sites</span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pt-2 pb-2">
                    {activeBookingTypes.map((period) => {
                      const rate = rates[period]
                      const fieldKey = `${siteType}-${period}-rate`
                      return (
                        <div key={period} className="space-y-2">
                          <h5 className="text-sm font-medium capitalize">{period}</h5>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor={fieldKey}>Rate ($)</Label>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                <Input
                                  id={fieldKey}
                                  type="number"
                                  step="1"
                                  min="0"
                                  className="pl-7"
                                  placeholder="Enter rate"
                                  value={focusedField === fieldKey ? rateInput : formatCents(rate.rate_cents)}
                                  onFocus={() => { setFocusedField(fieldKey); setRateInput(formatCents(rate.rate_cents)) }}
                                  onChange={(e) => setRateInput(e.target.value)}
                                  onBlur={() => { updateRate(siteType, period, "rate_cents", parseDollarsToCents(rateInput) ?? rate.rate_cents); setFocusedField(null) }}
                                />
                              </div>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor={`${siteType}-${period}-min`}>Min Nights</Label>
                              <Input id={`${siteType}-${period}-min`} type="number" min="1" value={rate.min_nights} onChange={(e) => updateRate(siteType, period, "min_nights", parseInt(e.target.value) || 1)} />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs" htmlFor={`${siteType}-${period}-max`}>Max Nights</Label>
                              <Input id={`${siteType}-${period}-max`} type="number" min="1" placeholder="No limit" value={rate.max_nights ?? ""} onChange={(e) => updateRate(siteType, period, "max_nights", e.target.value ? parseInt(e.target.value) : null)} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}

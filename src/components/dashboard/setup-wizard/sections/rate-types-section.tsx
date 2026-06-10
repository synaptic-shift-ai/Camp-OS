"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Info, Plus, Pencil, Trash2 } from "lucide-react"
import type { PropertyReservationTypesConfig, SeasonalPeriod, BookingType } from "@/lib/config/types"
import { DEFAULT_RESERVATION_TYPES_CONFIG } from "@/lib/config/types"
import { useWizardFormStore } from "../wizard-form-store"
import { parseEnabledReservationTypesFromDB, parseReservationTypesConfigFromDB } from "@/lib/config/resolution"

const MONTHS = [
  { value: 1, label: "January" }, { value: 2, label: "February" }, { value: 3, label: "March" },
  { value: 4, label: "April" }, { value: 5, label: "May" }, { value: 6, label: "June" },
  { value: 7, label: "July" }, { value: 8, label: "August" }, { value: 9, label: "September" },
  { value: 10, label: "October" }, { value: 11, label: "November" }, { value: 12, label: "December" },
]

type ConfigurableType = "nightly" | "weekly" | "monthly" | "seasonal"
const TYPE_LABELS: Record<ConfigurableType, { title: string; description: string }> = {
  nightly: { title: "Nightly", description: "Short stays charged per night (1-6 nights default)" },
  weekly: { title: "Weekly", description: "Week-long stays with potential discounts (7-27 nights default)" },
  monthly: { title: "Monthly", description: "Extended stays of 28+ nights with monthly rates" },
  seasonal: { title: "Seasonal", description: "Fixed date range stays with flat rates" },
}

interface SeasonForm {
  id?: string; name: string; start_month: number; start_day: number
  end_month: number; end_day: number; base_rate_cents: number; recurring: boolean
}

interface Props {
  propertyId: string
  reservationTypeConfigRaw: unknown
  enabledReservationTypesRaw: unknown
}

export function RateTypesSection({ propertyId, reservationTypeConfigRaw, enabledReservationTypesRaw }: Props) {
  const { saveDraft, getDraft } = useWizardFormStore()
  const draftRTC = getDraft(propertyId)?.reservationTypeConfig as PropertyReservationTypesConfig | undefined
  const draftERT = getDraft(propertyId)?.enabledReservationTypes as BookingType[] | undefined

  const [config, setConfig] = useState<PropertyReservationTypesConfig>(
    draftRTC ?? parseReservationTypesConfigFromDB(reservationTypeConfigRaw) ?? DEFAULT_RESERVATION_TYPES_CONFIG
  )
  const [enabledTypes, setEnabledTypes] = useState<BookingType[]>(
    draftERT ?? parseEnabledReservationTypesFromDB(enabledReservationTypesRaw) ?? ["nightly", "weekly", "monthly"]
  )
  const [seasonalPeriods, setSeasonalPeriods] = useState<SeasonalPeriod[]>([])
  const [seasonDialog, setSeasonDialog] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<SeasonForm | null>(null)
  const [seasonError, setSeasonError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [focusedRate, setFocusedRate] = useState<ConfigurableType | null>(null)
  const [rateInput, setRateInput] = useState("")
  const [isSeasonBaseRateFocused, setIsSeasonBaseRateFocused] = useState(false)
  const [seasonBaseRateInput, setSeasonBaseRateInput] = useState("")

  const pushDraft = (nextConfig: PropertyReservationTypesConfig, nextTypes: BookingType[]) => {
    const draft = getDraft(propertyId) ?? {}
    saveDraft(propertyId, {
      ...draft,
      reservationTypeConfig: nextConfig as unknown as Record<string, unknown>,
      enabledReservationTypes: nextTypes,
    })
  }

  const parseDollarsToCents = (d: string) => { const v = parseFloat(d); return isNaN(v) || v < 0 ? null : Math.round(v * 100) }
  const formatCents = (c: number | null | undefined) => (c == null ? "" : (c / 100).toFixed(2))
  const fmtMD = (m: number, d: number) => `${MONTHS.find((x) => x.value === m)?.label.slice(0, 3)} ${d}`
  const fmtCents = (c: number) => `$${(c / 100).toFixed(2)}`

  const toggle = (type: ConfigurableType) => {
    const isOn = enabledTypes.includes(type)
    const nextTypes = isOn ? enabledTypes.filter((t) => t !== type) : [...enabledTypes, type]
    const nextConfig = { ...config, [type]: { ...config[type], enabled: !isOn } }
    setEnabledTypes(nextTypes)
    setConfig(nextConfig)
    pushDraft(nextConfig, nextTypes)
  }

  const updateConfig = (type: "nightly" | "weekly" | "monthly", field: "min_nights" | "max_nights" | "rate_cents", value: number | null) => {
    const nextConfig = { ...config, [type]: { ...config[type], [field]: value } }
    setConfig(nextConfig)
    pushDraft(nextConfig, enabledTypes)
  }

  const openAddSeason = () => {
    setEditingPeriod({ name: "", start_month: 6, start_day: 1, end_month: 8, end_day: 31, base_rate_cents: 0, recurring: true })
    setSeasonError(null)
    setIsSeasonBaseRateFocused(false)
    setSeasonBaseRateInput("")
    setSeasonDialog(true)
  }
  const openEditSeason = (p: SeasonalPeriod) => {
    setEditingPeriod({ id: p.id, name: p.name, start_month: p.start_month, start_day: p.start_day, end_month: p.end_month, end_day: p.end_day, base_rate_cents: p.base_rate_cents, recurring: p.recurring })
    setSeasonError(null)
    setIsSeasonBaseRateFocused(false)
    setSeasonBaseRateInput("")
    setSeasonDialog(true)
  }

  const commitSeasonBaseRateInput = () => {
    if (!editingPeriod) return
    const cents = parseDollarsToCents(seasonBaseRateInput)
    setEditingPeriod({
      ...editingPeriod,
      base_rate_cents: cents ?? editingPeriod.base_rate_cents ?? 0,
    })
    setIsSeasonBaseRateFocused(false)
  }

  const saveSeason = async () => {
    if (!editingPeriod) return

    const periodToSave = isSeasonBaseRateFocused
      ? {
          ...editingPeriod,
          base_rate_cents:
            parseDollarsToCents(seasonBaseRateInput) ?? editingPeriod.base_rate_cents ?? 0,
        }
      : editingPeriod

    if (isSeasonBaseRateFocused) {
      setEditingPeriod(periodToSave)
      setIsSeasonBaseRateFocused(false)
    }

    if (!periodToSave.name.trim()) { setSeasonError("Season name is required"); return }
    if (periodToSave.base_rate_cents <= 0) { setSeasonError("Base rate must be greater than $0"); return }
    setIsSaving(true)
    setSeasonError(null)
    try {
      const isEditing = !!periodToSave.id
      const url = isEditing
        ? `/api/v1/properties/${propertyId}/seasonal-periods/${periodToSave.id}`
        : `/api/v1/properties/${propertyId}/seasonal-periods`
      const res = await fetch(url, { method: isEditing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: periodToSave.name, start_month: periodToSave.start_month, start_day: periodToSave.start_day, end_month: periodToSave.end_month, end_day: periodToSave.end_day, base_rate_cents: periodToSave.base_rate_cents, recurring: periodToSave.recurring }) })
      if (!res.ok) throw new Error((await res.json()).error?.message ?? "Failed to save")
      const { data: saved } = await res.json()
      setSeasonalPeriods((prev) => isEditing ? prev.map((p) => (p.id === periodToSave.id ? saved : p)) : [...prev, saved])
      setSeasonDialog(false)
      setEditingPeriod(null)
      setIsSeasonBaseRateFocused(false)
      setSeasonBaseRateInput("")
    } catch (e) {
      setSeasonError(e instanceof Error ? e.message : "Failed to save")
    } finally { setIsSaving(false) }
  }

  const deleteSeason = async (id: string) => {
    if (!confirm("Delete this seasonal period?")) return
    const res = await fetch(`/api/v1/properties/${propertyId}/seasonal-periods/${id}`, { method: "DELETE" })
    if (res.ok) setSeasonalPeriods((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Rate types</h3>
        <p className="text-sm text-muted-foreground">
          Configure available reservation types and their stay duration rules
        </p>
      </div>
      <div className="space-y-4">
        {(["nightly", "weekly", "monthly", "seasonal"] as const).map((type) => (
          <div key={type} className="flex flex-col space-y-4 pb-4 border-b last:border-b-0 last:pb-0">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-base">{TYPE_LABELS[type].title}</Label>
                <p className="text-sm text-muted-foreground">{TYPE_LABELS[type].description}</p>
              </div>
              <Switch checked={enabledTypes.includes(type)} onCheckedChange={() => toggle(type)} />
            </div>
            {enabledTypes.includes(type) && type !== "seasonal" && (
              <div className="grid gap-4 md:grid-cols-3 pl-4 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor={`${type}-rate`}>{type === "nightly" ? "Nightly Rate" : `${TYPE_LABELS[type].title} Rate`}</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                    <Input
                      id={`${type}-rate`}
                      type="number"
                      step="1"
                      min="0"
                      className="pl-7"
                      placeholder="Enter rate"
                      value={focusedRate === type ? rateInput : formatCents(config[type].rate_cents)}
                      onFocus={() => { setFocusedRate(type); setRateInput(formatCents(config[type].rate_cents)) }}
                      onChange={(e) => setRateInput(e.target.value)}
                      onBlur={() => { updateConfig(type, "rate_cents", parseDollarsToCents(rateInput) ?? config[type].rate_cents ?? 0); setFocusedRate(null) }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${type}-min`}>Minimum Nights</Label>
                  <Input id={`${type}-min`} type="number" min="1" max="365" value={config[type].min_nights} onChange={(e) => updateConfig(type, "min_nights", parseInt(e.target.value) || 1)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${type}-max`}>Maximum Nights</Label>
                  <Input id={`${type}-max`} type="number" min="1" max="365" placeholder="No limit" value={config[type].max_nights ?? ""} onChange={(e) => updateConfig(type, "max_nights", e.target.value ? parseInt(e.target.value) : null)} />
                </div>
              </div>
            )}
            {enabledTypes.includes(type) && type === "seasonal" && (
              <Alert><Info className="h-4 w-4" /><AlertDescription>Seasonal reservations use flat rates for defined date ranges. Configure seasonal periods below.</AlertDescription></Alert>
            )}
          </div>
        ))}
      </div>

      {enabledTypes.includes("seasonal") && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold">Seasonal Periods</h4>
              <p className="text-xs text-muted-foreground">Define date ranges and base rates for seasonal reservations</p>
            </div>
            <Button type="button" onClick={openAddSeason} size="sm"><Plus className="mr-2 h-4 w-4" />Add Season</Button>
          </div>
          {seasonalPeriods.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">No seasonal periods configured. Add a season to enable seasonal bookings.</div>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Season Name</TableHead><TableHead>Date Range</TableHead><TableHead>Base Rate</TableHead><TableHead>Recurring</TableHead><TableHead className="w-[100px]">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {seasonalPeriods.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{fmtMD(p.start_month, p.start_day)} – {fmtMD(p.end_month, p.end_day)}</TableCell>
                    <TableCell>{fmtCents(p.base_rate_cents)}</TableCell>
                    <TableCell>{p.recurring ? "Yes" : "No"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditSeason(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteSeason(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={seasonDialog} onOpenChange={setSeasonDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingPeriod?.id ? "Edit Seasonal Period" : "Add Seasonal Period"}</DialogTitle>
            <DialogDescription>Define the date range and base rate for this season.</DialogDescription>
          </DialogHeader>
          {editingPeriod && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="season-name">Season Name</Label>
                <Input id="season-name" placeholder="e.g., Summer Peak" value={editingPeriod.name} onChange={(e) => setEditingPeriod({ ...editingPeriod, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={String(editingPeriod.start_month)} onValueChange={(v) => setEditingPeriod({ ...editingPeriod, start_month: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-[220px]">{MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min="1" max="31" value={editingPeriod.start_day} onChange={(e) => setEditingPeriod({ ...editingPeriod, start_day: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={String(editingPeriod.end_month)} onValueChange={(v) => setEditingPeriod({ ...editingPeriod, end_month: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent side="bottom" sideOffset={4} avoidCollisions={false} className="max-h-[220px]">{MONTHS.map((m) => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min="1" max="31" value={editingPeriod.end_day} onChange={(e) => setEditingPeriod({ ...editingPeriod, end_day: parseInt(e.target.value) || 1 })} />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="base-rate">Base Rate (flat rate for entire season)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="base-rate"
                    type="number"
                    step="1"
                    min="0"
                    className="pl-7"
                    placeholder="Enter rate"
                    value={
                      isSeasonBaseRateFocused
                        ? seasonBaseRateInput
                        : formatCents(editingPeriod.base_rate_cents)
                    }
                    onFocus={() => {
                      setIsSeasonBaseRateFocused(true)
                      setSeasonBaseRateInput(formatCents(editingPeriod.base_rate_cents))
                    }}
                    onChange={(e) => setSeasonBaseRateInput(e.target.value)}
                    onBlur={commitSeasonBaseRateInput}
                  />
                </div>
                <p className="text-sm text-muted-foreground">Total price for the season, not per night</p>
              </div>
              <div className="flex items-center space-x-2">
                <Switch id="recurring" checked={editingPeriod.recurring} onCheckedChange={(v) => setEditingPeriod({ ...editingPeriod, recurring: v })} />
                <Label htmlFor="recurring">Recurring annually</Label>
              </div>
              {seasonError && <Alert variant="destructive"><AlertDescription>{seasonError}</AlertDescription></Alert>}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSeasonDialog(false)}>Cancel</Button>
            <Button type="button" onClick={saveSeason} disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingPeriod?.id ? "Save Changes" : "Add Season"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

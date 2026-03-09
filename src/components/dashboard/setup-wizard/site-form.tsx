"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Save, X, ImageIcon, Trash2 } from "lucide-react"
import { siteFormSchema, siteStatuses, toApiFormat, fromApiFormat } from "./site-form-schema"
import type { SiteFormData, reservationTypes } from "./site-form-schema"
import { Switch } from "@/components/ui/switch"
import { Dropzone, DropzoneEmptyState, DropzoneContent } from "@/components/dropzone"
import { useSupabaseUpload } from "@/hooks/use-supabase-upload"
import { createClient } from "@/lib/supabase/client"

/**
 * Property defaults for reservation types and pricing.
 * Used to pre-fill form when site overrides property defaults.
 */
export interface PropertyDefaults {
  enabled_reservation_types?: ('nightly' | 'weekly' | 'monthly' | 'seasonal')[]
  default_reservation_type?: 'nightly' | 'weekly' | 'monthly' | 'seasonal'
  nightly_rate_cents?: number | null
  weekly_rate_cents?: number | null
  monthly_rate_cents?: number | null
  seasonal_rate_cents?: number | null
  base_price_cents?: number | null  // Fallback base price
  weekend_price?: number | null
}

const SITE_IMAGES_BUCKET = "site-property-images"
const MAX_SITE_IMAGES = 3
const MAX_SITE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

interface SiteFormProps {
  propertyId: string
  site?: any // For edit mode - existing site data
  propertyDefaults?: PropertyDefaults | undefined // Property-level defaults to pre-fill
  onSave: (site: any) => void
  onCancel: () => void
}

export function SiteForm({ propertyId, site, propertyDefaults, onSave, onCancel }: SiteFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditMode = !!site
  const [isSingleDay, setIsSingleDay] = useState(true)
  const [houseKeepingFrom, setHouseKeepingFrom] = useState<string>('')
  const [houseKeepingTo, setHouseKeepingTo] = useState('')
  const [dateConflictError, setDateConflictError] = useState<string | null>(null)
  const [checkingDate, setCheckingDate] = useState(false)
  const [siteImageUrls, setSiteImageUrls] = useState<string[]>(() => {
    const raw = site?.images ?? site?.site_images
    return Array.isArray(raw) ? [...raw] : []
  })
  const supabase = useMemo(() => createClient(), [])

  const siteImagesPath = site?.id ? `${propertyId}/${site.id}` : `${propertyId}/new`
  const siteImagesUpload = useSupabaseUpload({
    bucketName: SITE_IMAGES_BUCKET,
    path: siteImagesPath,
    maxFiles: MAX_SITE_IMAGES,
    maxFileSize: MAX_SITE_IMAGE_SIZE_BYTES,
    allowedMimeTypes: ["image/*"],
    upsert: true,
  })

  // When switching to a different site (or opening edit), init siteImageUrls from site
  const siteId = site?.id
  useEffect(() => {
    if (!siteId) return
    const raw = site?.images ?? site?.site_images
    setSiteImageUrls(Array.isArray(raw) ? [...raw] : [])
  }, [siteId])

  // When uploads succeed, add their public URLs to siteImageUrls
  const successes = siteImagesUpload.successes
  useEffect(() => {
    if (successes.length === 0) return
    setSiteImageUrls((prev) => {
      const existingUrls = new Set(prev)
      let next = [...prev]
      for (const name of successes) {
        const { data } = supabase.storage.from(SITE_IMAGES_BUCKET).getPublicUrl(`${siteImagesPath}/${name}`)
        if (!existingUrls.has(data.publicUrl) && next.length < MAX_SITE_IMAGES) {
          next.push(data.publicUrl)
          existingUrls.add(data.publicUrl)
        }
      }
      return next.slice(0, MAX_SITE_IMAGES)
    })
  }, [successes, siteImagesPath, supabase])

  const removeSiteImage = useCallback(
    async (
      url: string,
      inputRef?: React.RefObject<HTMLInputElement | null>
    ) => {
      const marker = `/object/public/${SITE_IMAGES_BUCKET}/`
      const idx = url.indexOf(marker)
      const path = idx !== -1 ? url.slice(idx + marker.length) : null
      if (path) {
        await supabase.storage.from(SITE_IMAGES_BUCKET).remove([path])
      }
      setSiteImageUrls((prev) => prev.filter((u) => u !== url))
      if (inputRef?.current) inputRef.current.value = ""
    },
    [supabase]
  )

  // Convert API response (camelCase) to form format (snake_case) using shared helper
  const defaultFormValues = site ? fromApiFormat(site) : undefined

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    trigger,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteFormSchema),
    mode: 'onChange',
    defaultValues: defaultFormValues || {
      site_number: "",
      site_name: "",
      site_type: "tent",
      max_occupancy: 4,
      max_vehicles: 1,
      status: "available",
      description: "",
      base_price: 0,
      hookups: {
        water: false,
        electric: false,
        sewer: false,
      },
      amenities: {
        fire_pit: false,
        picnic_table: false,
        grill: false,
        shade: false,
        pet_friendly: false,
        lake_view: false,
        waterfront: false,
      },
      allow_pets: false,
      pet_fee: undefined,
      ada_accessible: false,
      accessibility_features: {
        wheelchair_accessible: false,
        wide_paths: false,
        accessible_table: false,
        accessible_restroom: false,
        handrails: false,
        level_ground: false,
      },
      use_property_reservation_types: true,
      enabled_reservation_types_override: undefined,
      seasonal_rate: undefined,
    },
  })

  const siteType = watch("site_type")
  const hookups = watch("hookups")
  const amenities = watch("amenities")
  const allowPets = watch("allow_pets")
  const adaAccessible = watch("ada_accessible")
  const accessibilityFeatures = watch("accessibility_features")
  const usePropertyReservationTypes = watch("use_property_reservation_types")
  const enabledReservationTypesOverride = watch("enabled_reservation_types_override")
  const defaultReservationType = watch("default_reservation_type")

  useEffect(() => {
    if (!site?.availability_rules) return
    const blocked = (site.availability_rules as any)?.blocked_dates
    if (blocked?.length > 0) {
      const firstBlock = blocked[0]
      setHouseKeepingFrom(firstBlock.from ?? '')
      setHouseKeepingTo(firstBlock.to ?? '')
      setIsSingleDay(firstBlock.from === firstBlock.to)
    }
  }, [site])

  const toggleReservationType = (type: typeof reservationTypes[number]) => {
    const current = enabledReservationTypesOverride || []
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type]
    setValue("enabled_reservation_types_override", updated.length > 0 ? updated : undefined)
  }

  const RESERVATION_TYPE_LABELS: Record<typeof reservationTypes[number], { title: string; description: string }> = {
    nightly: { title: "Nightly", description: "Short stays (1-6 nights)" },
    weekly: { title: "Weekly", description: "Week-long stays (7-27 nights)" },
    monthly: { title: "Monthly", description: "Extended stays (28+ nights)" },
    seasonal: { title: "Seasonal", description: "Fixed date range with flat rate" },
  }

  const onSubmit = async (data: SiteFormData) => {
    try {
      setSaving(true)
      setError(null)

      const apiData = toApiFormat(data)

      const isBlockingDates =
        (data.status === "housekeeping" || data.status === "maintenance") &&
        houseKeepingFrom

      const finalApiData = isBlockingDates
        ? {
          ...apiData,
          status: site?.status ?? apiData.status,
          availability_rules: {
            blocked_dates: [
              {
                from: houseKeepingFrom,
                to: isSingleDay ? houseKeepingFrom : (houseKeepingTo || houseKeepingFrom),
                reason: data.status,
              }
            ]
          }
        }
        : apiData

      const payload = { ...finalApiData, images: siteImageUrls.length > 0 ? siteImageUrls : undefined }

      if (isEditMode) {
        // Update existing site - Migrated to v1 API
        const response = await fetch(`/api/v1/sites/${site.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to update site")
        }

        onSave(result.data)
      } else {
        // Create new site - Migrated to v1 API (Phase 4, Week 13-14)
        console.log("[SiteForm] Creating site at:", `/api/v1/properties/${propertyId}/sites`)
        const response = await fetch(`/api/v1/properties/${propertyId}/sites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })

        console.log("[SiteForm] Response status:", response.status)
        const result = await response.json()
        console.log("[SiteForm] Response body:", JSON.stringify(result, null, 2))

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to create site")
        }

        onSave(result.data)
      }
    } catch (err) {
      console.error("Error saving site:", err)
      setError(err instanceof Error ? err.message : "Failed to save site")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Site identification and capacity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="site_number">Site Number *</Label>
              <Input
                id="site_number"
                {...register("site_number")}
                placeholder="A1, B2, etc."
                disabled={isEditMode} // Don't allow changing site number in edit mode
              />
              {errors.site_number && (
                <p className="text-sm text-destructive mt-1">{errors.site_number.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="site_name">Site Name</Label>
              <Input
                id="site_name"
                {...register("site_name")}
                placeholder="Lakeside Premium (optional)"
              />
              {errors.site_name && (
                <p className="text-sm text-destructive mt-1">{errors.site_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="site_type">Site Type *</Label>
              <Select
                value={siteType}
                onValueChange={(value) => setValue("site_type", value as any)}
              >
                <SelectTrigger id="site_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tent">Tent</SelectItem>
                  <SelectItem value="rv">RV</SelectItem>
                  <SelectItem value="cabin">Cabin</SelectItem>
                  <SelectItem value="glamping">Glamping</SelectItem>
                  <SelectItem value="yurt">Yurt</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.site_type && (
                <p className="text-sm text-destructive mt-1">{errors.site_type.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="max_occupancy">Max Occupancy *</Label>
              <Input
                id="max_occupancy"
                type="number"
                min="1"
                max="50"
                {...register("max_occupancy")}
                placeholder="4"
              />
              {errors.max_occupancy && (
                <p className="text-sm text-destructive mt-1">{errors.max_occupancy.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="max_vehicles">Max Vehicles</Label>
              <Input
                id="max_vehicles"
                type="number"
                min="1"
                max="10"
                {...register("max_vehicles")}
                placeholder="1"
              />
              {errors.max_vehicles && (
                <p className="text-sm text-destructive mt-1">{errors.max_vehicles.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="size_sqft">Size (sq ft)</Label>
              <Input
                id="size_sqft"
                type="number"
                min="0"
                {...register("size_sqft")}
                placeholder="Optional"
              />
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={watch("status")} onValueChange={(value) => setValue("status", value as any)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {siteStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(watch("status") === "housekeeping" || watch("status") === "maintenance") && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="Date">Select Date</Label>
                <CardDescription>
                  Set the date for the site {watch("status")} schedule.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="singleDay"
                  checked={isSingleDay}
                  onCheckedChange={(checked) => setIsSingleDay(!!checked)}
                />
                <Label htmlFor="singleDay" className="cursor-pointer font-normal">
                  Single Day
                </Label>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Label htmlFor="houseKeepingFrom" className="text-xs text-muted-foreground mb-1 block">
                    {isSingleDay ? "Date" : "Start Date"}
                  </Label>
                  <Input
                    id="houseKeepingFrom"
                    type="date"
                    value={houseKeepingFrom}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setHouseKeepingFrom(e.target.value)}
                  />
                </div>

                {!isSingleDay && (
                  <div className="flex-1">
                    <Label htmlFor="houseKeepingTo" className="text-xs text-muted-foreground mb-1 block">
                      End Date
                    </Label>
                    <Input
                      id="houseKeepingTo"
                      type="date"
                      value={houseKeepingTo}
                      min={houseKeepingFrom || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setHouseKeepingTo(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Describe this site, its features, and what makes it special..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Site Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Site images
          </CardTitle>
          <CardDescription>
            Upload up to {MAX_SITE_IMAGES} images for this site. Optional.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Dropzone
            {...siteImagesUpload}
            uploadedCount={siteImageUrls.length}
            className={
              siteImageUrls.length >= MAX_SITE_IMAGES && siteImagesUpload.files.length === 0
                ? "opacity-60 pointer-events-none"
                : ""
            }
          >
            {siteImagesUpload.files.length === 0 ? (
              <div className="flex flex-1 items-center justify-center min-h-[120px]">
                <DropzoneEmptyState />
              </div>
            ) : (
              <div className="w-full overflow-y-auto p-2">
                <DropzoneContent layout="grid" className="mt-0" />
              </div>
            )}
          </Dropzone>

          {/* Uploaded images — always show section like property step */}
          <div className="pt-2">
            <h4 className="text-sm font-medium mb-3">Uploaded images</h4>
            {siteImageUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {siteImageUrls.map((url) => {
                  const fileName = url.split("/").pop() ?? "Image"
                  return (
                    <div
                      key={url}
                      className="relative h-28 rounded-lg overflow-hidden bg-muted group"
                    >
                      <img
                        src={url}
                        alt={fileName}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeSiteImage(url, siteImagesUpload.inputRef)}
                        className="absolute top-1.5 right-1.5 h-7 w-7 rounded-md flex items-center justify-center backdrop-blur-sm bg-black/40 hover:bg-destructive/80 text-white transition opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 size={13} />
                      </button>
                      {/* Filename label — same as property uploaded images */}
                      <div className="absolute bottom-0 left-0 right-0 px-2 pt-6 pb-1.5 bg-gradient-to-t from-black/50 to-transparent">
                        <p title={fileName} className="text-white text-[11px] font-medium truncate leading-tight">
                          {fileName}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No images uploaded yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pricing & Reservation Types - Combined Section */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing & Reservation Types</CardTitle>
          <CardDescription>
            Configure pricing and available reservation types for this site
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Property Defaults Toggle */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="use_property_defaults" className="font-medium">Use Property Defaults</Label>
              <p className="text-sm text-muted-foreground">
                Inherit pricing and reservation types from property settings
              </p>
            </div>
            <Switch
              id="use_property_defaults"
              checked={usePropertyReservationTypes}
              onCheckedChange={async (checked) => {
                setValue("use_property_reservation_types", checked, { shouldDirty: true })
                if (checked) {
                  setValue("enabled_reservation_types_override", undefined)
                  setValue("default_reservation_type", undefined)
                } else {
                  // Pre-fill with property defaults when switching to override mode
                  const defaultTypes = propertyDefaults?.enabled_reservation_types || ["nightly"]
                  setValue("enabled_reservation_types_override", defaultTypes, { shouldDirty: true })
                  setValue("default_reservation_type", propertyDefaults?.default_reservation_type)

                  // In edit mode, keep existing rates; only pre-fill from property defaults if rates are 0
                  const currentBasePrice = watch("base_price")
                  if (!currentBasePrice || currentBasePrice === 0) {
                    if (propertyDefaults?.nightly_rate_cents || propertyDefaults?.base_price_cents) {
                      const baseRate = (propertyDefaults.nightly_rate_cents || propertyDefaults.base_price_cents || 0) / 100
                      setValue("base_price", baseRate, { shouldDirty: true })
                    }
                  }

                  const currentWeekendPrice = watch("weekend_price")
                  if (!currentWeekendPrice && propertyDefaults?.weekend_price) {
                    setValue("weekend_price", propertyDefaults.weekend_price / 100)
                  }

                  const currentWeeklyRate = watch("weekly_rate")
                  if (!currentWeeklyRate && propertyDefaults?.weekly_rate_cents) {
                    setValue("weekly_rate", propertyDefaults.weekly_rate_cents / 100)
                  }

                  const currentMonthlyRate = watch("monthly_rate")
                  if (!currentMonthlyRate && propertyDefaults?.monthly_rate_cents) {
                    setValue("monthly_rate", propertyDefaults.monthly_rate_cents / 100)
                  }

                  const currentSeasonalRate = watch("seasonal_rate")
                  if (!currentSeasonalRate && propertyDefaults?.seasonal_rate_cents) {
                    setValue("seasonal_rate", propertyDefaults.seasonal_rate_cents / 100)
                  }
                }
                // Trigger validation after all changes
                await trigger()
              }}
            />
          </div>

          {/* Site-Specific Configuration (only when NOT using property defaults) */}
          {!usePropertyReservationTypes && (
            <div className="space-y-6">
              {/* Reservation Type Selection with Integrated Pricing */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground">
                  Select reservation types and set rates for this site:
                </h4>

                {/* Nightly */}
                <div className={`p-4 border rounded-lg space-y-3 ${enabledReservationTypesOverride?.includes("nightly") ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="res-type-nightly"
                      checked={enabledReservationTypesOverride?.includes("nightly") || false}
                      onCheckedChange={() => toggleReservationType("nightly")}
                    />
                    <div className="flex-1">
                      <Label htmlFor="res-type-nightly" className="cursor-pointer font-medium">
                        Nightly
                      </Label>
                      <p className="text-xs text-muted-foreground">Short stays (1-6 nights)</p>
                    </div>
                  </div>
                  {enabledReservationTypesOverride?.includes("nightly") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pl-7">
                      <div>
                        <Label htmlFor="base_price" className="text-xs">Base Rate (per night) *</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            id="base_price"
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-7 h-9"
                            {...register("base_price", { valueAsNumber: true })}
                            placeholder="45.00"
                          />
                        </div>
                        {errors.base_price && (
                          <p className="text-xs text-destructive mt-1">{errors.base_price.message}</p>
                        )}
                      </div>
                      <div>
                        <Label htmlFor="weekend_price" className="text-xs">Weekend Rate (Fri/Sat)</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            id="weekend_price"
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-7 h-9"
                            {...register("weekend_price")}
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Weekly */}
                <div className={`p-4 border rounded-lg space-y-3 ${enabledReservationTypesOverride?.includes("weekly") ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="res-type-weekly"
                      checked={enabledReservationTypesOverride?.includes("weekly") || false}
                      onCheckedChange={() => toggleReservationType("weekly")}
                    />
                    <div className="flex-1">
                      <Label htmlFor="res-type-weekly" className="cursor-pointer font-medium">
                        Weekly
                      </Label>
                      <p className="text-xs text-muted-foreground">Week-long stays (7-27 nights)</p>
                    </div>
                  </div>
                  {enabledReservationTypesOverride?.includes("weekly") && (
                    <div className="pt-2 pl-7">
                      <div className="max-w-xs">
                        <Label htmlFor="weekly_rate" className="text-xs">Weekly Rate (per night)</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            id="weekly_rate"
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-7 h-9"
                            {...register("weekly_rate", { valueAsNumber: true })}
                            placeholder="40.00"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Leave empty to use base rate</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Monthly */}
                <div className={`p-4 border rounded-lg space-y-3 ${enabledReservationTypesOverride?.includes("monthly") ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="res-type-monthly"
                      checked={enabledReservationTypesOverride?.includes("monthly") || false}
                      onCheckedChange={() => toggleReservationType("monthly")}
                    />
                    <div className="flex-1">
                      <Label htmlFor="res-type-monthly" className="cursor-pointer font-medium">
                        Monthly
                      </Label>
                      <p className="text-xs text-muted-foreground">Extended stays (28+ nights)</p>
                    </div>
                  </div>
                  {enabledReservationTypesOverride?.includes("monthly") && (
                    <div className="pt-2 pl-7">
                      <div className="max-w-xs">
                        <Label htmlFor="monthly_rate" className="text-xs">Monthly Rate (per night)</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            id="monthly_rate"
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-7 h-9"
                            {...register("monthly_rate", { valueAsNumber: true })}
                            placeholder="35.00"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Leave empty to use base rate</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Seasonal */}
                <div className={`p-4 border rounded-lg space-y-3 ${enabledReservationTypesOverride?.includes("seasonal") ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="res-type-seasonal"
                      checked={enabledReservationTypesOverride?.includes("seasonal") || false}
                      onCheckedChange={() => toggleReservationType("seasonal")}
                    />
                    <div className="flex-1">
                      <Label htmlFor="res-type-seasonal" className="cursor-pointer font-medium">
                        Seasonal
                      </Label>
                      <p className="text-xs text-muted-foreground">Fixed date range with flat rate</p>
                    </div>
                  </div>
                  {enabledReservationTypesOverride?.includes("seasonal") && (
                    <div className="pt-2 pl-7">
                      <div className="max-w-xs">
                        <Label htmlFor="seasonal_rate" className="text-xs">Seasonal Flat Rate</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            id="seasonal_rate"
                            type="number"
                            step="0.01"
                            min="0"
                            className="pl-7 h-9"
                            {...register("seasonal_rate", { valueAsNumber: true })}
                            placeholder="Use property rate"
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Leave empty to use property seasonal rates</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Validation Alert */}
              {(!enabledReservationTypesOverride || enabledReservationTypesOverride.length === 0) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Select at least one reservation type for this site.
                  </AlertDescription>
                </Alert>
              )}

              {/* Default Reservation Type */}
              {enabledReservationTypesOverride && enabledReservationTypesOverride.length > 1 && (
                <div className="pt-2 space-y-2">
                  <Label htmlFor="default_reservation_type">Default Reservation Type</Label>
                  <Select
                    value={defaultReservationType || "__inherit__"}
                    onValueChange={(value) => setValue("default_reservation_type", value === "__inherit__" ? undefined : value as any)}
                  >
                    <SelectTrigger id="default_reservation_type" className="max-w-xs">
                      <SelectValue placeholder="Use property default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__inherit__">Use property default</SelectItem>
                      {enabledReservationTypesOverride.map((type) => (
                        <SelectItem key={type} value={type}>
                          {RESERVATION_TYPE_LABELS[type].title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Suggested reservation type when guests book this site
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hookups */}
      <Card>
        <CardHeader>
          <CardTitle>Hookups</CardTitle>
          <CardDescription>Available utility connections</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hookup_water"
                checked={hookups.water}
                onCheckedChange={(checked) =>
                  setValue("hookups.water", checked as boolean)
                }
              />
              <Label htmlFor="hookup_water" className="font-normal cursor-pointer">
                Water
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hookup_electric"
                checked={hookups.electric}
                onCheckedChange={(checked) =>
                  setValue("hookups.electric", checked as boolean)
                }
              />
              <Label htmlFor="hookup_electric" className="font-normal cursor-pointer">
                Electric
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="hookup_sewer"
                checked={hookups.sewer}
                onCheckedChange={(checked) =>
                  setValue("hookups.sewer", checked as boolean)
                }
              />
              <Label htmlFor="hookup_sewer" className="font-normal cursor-pointer">
                Sewer
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card>
        <CardHeader>
          <CardTitle>Amenities</CardTitle>
          <CardDescription>Site-specific features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_fire_pit"
                checked={amenities.fire_pit}
                onCheckedChange={(checked) =>
                  setValue("amenities.fire_pit", checked as boolean)
                }
              />
              <Label htmlFor="amenity_fire_pit" className="font-normal cursor-pointer">
                Fire Pit
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_picnic_table"
                checked={amenities.picnic_table}
                onCheckedChange={(checked) =>
                  setValue("amenities.picnic_table", checked as boolean)
                }
              />
              <Label htmlFor="amenity_picnic_table" className="font-normal cursor-pointer">
                Picnic Table
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_grill"
                checked={amenities.grill}
                onCheckedChange={(checked) =>
                  setValue("amenities.grill", checked as boolean)
                }
              />
              <Label htmlFor="amenity_grill" className="font-normal cursor-pointer">
                Grill
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_shade"
                checked={amenities.shade}
                onCheckedChange={(checked) =>
                  setValue("amenities.shade", checked as boolean)
                }
              />
              <Label htmlFor="amenity_shade" className="font-normal cursor-pointer">
                Shade
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_pet_friendly"
                checked={amenities.pet_friendly}
                onCheckedChange={(checked) =>
                  setValue("amenities.pet_friendly", checked as boolean)
                }
              />
              <Label htmlFor="amenity_pet_friendly" className="font-normal cursor-pointer">
                Pet Friendly
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_lake_view"
                checked={amenities.lake_view}
                onCheckedChange={(checked) =>
                  setValue("amenities.lake_view", checked as boolean)
                }
              />
              <Label htmlFor="amenity_lake_view" className="font-normal cursor-pointer">
                Lake View
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="amenity_waterfront"
                checked={amenities.waterfront}
                onCheckedChange={(checked) =>
                  setValue("amenities.waterfront", checked as boolean)
                }
              />
              <Label htmlFor="amenity_waterfront" className="font-normal cursor-pointer">
                Waterfront
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pets & Accessibility */}
      <Card>
        <CardHeader>
          <CardTitle>Pets & Accessibility</CardTitle>
          <CardDescription>Pet policies and ADA accessibility features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Pet Settings */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow_pets"
                checked={allowPets}
                onCheckedChange={(checked) =>
                  setValue("allow_pets", checked as boolean)
                }
              />
              <Label htmlFor="allow_pets" className="font-medium cursor-pointer">
                Allow Pets
              </Label>
            </div>

            {allowPets && (
              <div>
                <Label htmlFor="pet_fee">Pet Fee (one-time)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="pet_fee"
                    type="number"
                    step="0.01"
                    min="0"
                    className="pl-7"
                    {...register("pet_fee", { valueAsNumber: true })}
                    placeholder="15.00"
                  />
                </div>
                {errors.pet_fee && (
                  <p className="text-sm text-destructive mt-1">{errors.pet_fee.message}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  One-time fee (optional, leave empty for no fee)
                </p>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="ada_accessible"
                checked={adaAccessible}
                onCheckedChange={(checked) =>
                  setValue("ada_accessible", checked as boolean)
                }
              />
              <Label htmlFor="ada_accessible" className="font-medium cursor-pointer">
                ADA Accessible
              </Label>
            </div>

            {adaAccessible && accessibilityFeatures && (
              <div className="ml-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Select specific accessibility features available:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_wheelchair"
                      checked={accessibilityFeatures.wheelchair_accessible}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.wheelchair_accessible", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_wheelchair" className="font-normal cursor-pointer">
                      Wheelchair Accessible
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_wide_paths"
                      checked={accessibilityFeatures.wide_paths}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.wide_paths", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_wide_paths" className="font-normal cursor-pointer">
                      Wide Paths
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_table"
                      checked={accessibilityFeatures.accessible_table}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.accessible_table", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_table" className="font-normal cursor-pointer">
                      Accessible Table
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_restroom"
                      checked={accessibilityFeatures.accessible_restroom}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.accessible_restroom", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_restroom" className="font-normal cursor-pointer">
                      Accessible Restroom
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_handrails"
                      checked={accessibilityFeatures.handrails}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.handrails", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_handrails" className="font-normal cursor-pointer">
                      Handrails
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="accessibility_level_ground"
                      checked={accessibilityFeatures.level_ground}
                      onCheckedChange={(checked) =>
                        setValue("accessibility_features.level_ground", checked as boolean)
                      }
                    />
                    <Label htmlFor="accessibility_level_ground" className="font-normal cursor-pointer">
                      Level Ground
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Validation Errors Summary */}
      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium mb-1">Please fix the following errors:</p>
            <ul className="list-disc list-inside text-sm">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>
                  {field.replace(/_/g, ' ')}: {error?.message || 'Invalid value'}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {isEditMode ? "Update Site" : "Add Site"}
            </>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>
    </form>
  )
}

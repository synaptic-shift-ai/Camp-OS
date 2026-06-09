"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
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
import { Loader2, Save, X, ImageIcon, Trash2, Info } from "lucide-react"
import { BlackoutDatesPicker } from "@/components/guest/booking-date-range-picker"
import { Badge } from "@/components/ui/badge"
import { siteFormSchema, siteStatuses, toApiFormat, fromApiFormat } from "./site-form-schema"
import type { SiteFormData, reservationTypes } from "./site-form-schema"
import { Dropzone, DropzoneEmptyState, DropzoneContent } from "@/components/dropzone"
import { useSupabaseUpload } from "@/hooks/use-supabase-upload"
import { createClient } from "@/lib/supabase/client"
import { useWizardFormStore } from "./wizard-form-store"

export interface PropertyDefaults {
  enabled_reservation_types?: ('nightly' | 'weekly' | 'monthly' | 'seasonal')[]
  default_reservation_type?: 'nightly' | 'weekly' | 'monthly' | 'seasonal'
  nightly_rate_cents?: number | null
  weekly_rate_cents?: number | null
  monthly_rate_cents?: number | null
  seasonal_rate_cents?: number | null
  base_price_cents?: number | null
  weekend_price?: number | null
}

export type SiteTypeConfig = {
  allowed_site_types?: string[]
  site_type_rates?: Record<
    string,
    {
      nightly?: { rate_cents: number | null;[k: string]: unknown }
      weekly?: { rate_cents: number | null;[k: string]: unknown }
      monthly?: { rate_cents: number | null;[k: string]: unknown }
      seasonal?: { rate_cents: number | null;[k: string]: unknown }
    }
  >
}

const SITE_IMAGES_BUCKET = "site-property-images"
const MAX_SITE_IMAGES = 1
const MAX_SITE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

const ALL_SITE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'tent', label: 'Tent' },
  { value: 'rv', label: 'RV' },
  { value: 'cabin', label: 'Cabin' },
  { value: 'glamping', label: 'Glamping' },
  { value: 'yurt', label: 'Yurt' },
  { value: 'other', label: 'Other' },
]

interface SiteFormProps {
  propertyId: string
  site?: any
  propertyDefaults?: PropertyDefaults | undefined
  siteTypeConfig?: SiteTypeConfig | undefined
  onSave: (site: any) => void
  onCancel: () => void
  onDirtyChange?: (dirty: boolean) => void
}

export function SiteForm({ propertyId, site, propertyDefaults, siteTypeConfig, onSave, onCancel, onDirtyChange }: SiteFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isEditMode = !!site
  const [propertyAmenities, setPropertyAmenities] = useState<unknown[] | null>(null)
  const [amenitiesLoading, setAmenitiesLoading] = useState(false)
  const [deletingImageUrl, setDeletingImageUrl] = useState<string | null>(null)
  const { getDraft } = useWizardFormStore()
  const [blackoutDates, setBlackoutDates] = useState<string[]>(() => {
    const raw = site?.availability_rules as { blackout_dates?: string[] } | undefined
    return Array.isArray(raw?.blackout_dates) ? [...raw.blackout_dates].sort() : []
  })
  const [openPeriodFrom, setOpenPeriodFrom] = useState<string | null>(null)
  const [openPeriodUntil, setOpenPeriodUntil] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  const serializedAvailabilityRules = useMemo(
    () => JSON.stringify(site?.availability_rules ?? null),
    [site?.availability_rules],
  )
  useEffect(() => {
    const raw = site?.availability_rules as { blackout_dates?: string[] } | undefined
    setBlackoutDates(Array.isArray(raw?.blackout_dates) ? [...raw.blackout_dates].sort() : [])
  }, [serializedAvailabilityRules])

  const [siteImageUrls, setSiteImageUrls] = useState<string[]>(() => {
    const raw = site?.site_images ?? site?.images
    return Array.isArray(raw) ? [...raw] : []
  })

  const siteImagesPath = site?.id ? `${propertyId}/${site.id}` : `${propertyId}/new`
  const siteImagesUpload = useSupabaseUpload({
    bucketName: SITE_IMAGES_BUCKET,
    path: siteImagesPath,
    maxFiles: MAX_SITE_IMAGES,
    maxFileSize: MAX_SITE_IMAGE_SIZE_BYTES,
    allowedMimeTypes: ["image/*"],
    upsert: true,
  })

  const siteId = site?.id
  const rawImages = site?.site_images ?? site?.images
  const serializedImages = JSON.stringify(rawImages)
  useEffect(() => {
    const raw = site?.site_images ?? site?.images
    setSiteImageUrls(Array.isArray(raw) ? [...raw] : [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, serializedImages])

  // When uploads succeed, add their public URLs to siteImageUrls
  const successes = siteImagesUpload.successes
  useEffect(() => {
    if (successes.length === 0) return
    setSiteImageUrls((prev) => {
      const existingUrls = new Set(prev)
      const next = [...prev]
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
    async (url: string, inputRef?: React.RefObject<HTMLInputElement | null>) => {
      setDeletingImageUrl(url)
      try {
        const marker = `/object/public/${SITE_IMAGES_BUCKET}/`
        const idx = url.indexOf(marker)
        const path = idx !== -1 ? url.slice(idx + marker.length) : null
        if (path) {
          await supabase.storage.from(SITE_IMAGES_BUCKET).remove([path])
        }
        setSiteImageUrls((prev) => prev.filter((u) => u !== url))
        if (inputRef?.current) inputRef.current.value = ""
      } finally {
        setDeletingImageUrl(null)
      }
    },
    [supabase]
  )

  const defaultFormValues = site ? fromApiFormat(site) : undefined

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    getValues,
    watch,
    trigger,
    reset,
  } = useForm<SiteFormData>({
    resolver: zodResolver(siteFormSchema),
    mode: 'onChange',
    shouldUnregister: false,
    defaultValues: defaultFormValues || {
      site_number: "",
      site_name: "",
      site_type: "tent",
      max_occupancy: 4,
      max_vehicles: 1,
      status: "available",
      description: "",
      base_price: 0,
      hookups: { water: false, electric: false, sewer: false },
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
      pricing_source: "property_defaults",
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
  const pricingSource = watch("pricing_source")
  const enabledReservationTypesOverride = watch("enabled_reservation_types_override")
  const defaultReservationType = watch("default_reservation_type")
  const amenityOptions = useMemo(() => {
    const fallback: { key: string; label: string; description?: string }[] = [
      { key: "fire_pit", label: "Fire Pit" },
      { key: "picnic_table", label: "Picnic Table" },
      { key: "grill", label: "Grill" },
      { key: "shade", label: "Shade" },
      { key: "pet_friendly", label: "Pet Friendly" },
      { key: "lake_view", label: "Lake View" },
      { key: "waterfront", label: "Waterfront" },
    ]

    if (!Array.isArray(propertyAmenities)) return fallback

    const options: { key: string; label: string; description?: string }[] = []
    const seen = new Set<string>()

    for (const item of propertyAmenities) {
      const rawName =
        typeof item === "string"
          ? item
          : item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string"
            ? (item as { name: string }).name
            : null

      if (!rawName) continue
      const trimmed = rawName.trim()
      if (!trimmed) continue

      // Extract description if available.
      const rawDescription =
        item && typeof item === "object" && typeof (item as { description?: unknown }).description === "string"
          ? (item as { description: string }).description.trim()
          : undefined

      // Store site amenities by property amenity id when available.
      const keyFromId =
        item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
          ? (item as { id: string }).id.trim()
          : ""
      // Fallback for legacy string-only amenities in case no id exists.
      const key = keyFromId || trimmed
      if (!key || seen.has(key)) continue

      seen.add(key)
      options.push({ key, label: trimmed, ...(rawDescription ? { description: rawDescription } : {}) })
    }

    return options.length > 0 ? options : fallback
  }, [propertyAmenities])

  useEffect(() => {
    if (isEditMode && site) {
      const values = fromApiFormat(site)
      reset(values as SiteFormData)
    }
  }, [isEditMode, site, reset])

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])

  // Property amenities (from Settings → Property Amenities) control which site amenity checkboxes are shown.
  // We map known property amenity names to the site amenity keys used by this form.
  useEffect(() => {
    let cancelled = false

    const fetchPropertyAmenities = async () => {
      setAmenitiesLoading(true)
      try {
        const draftAmenities = getDraft(propertyId)?.site_amenities
        if (Array.isArray(draftAmenities) && draftAmenities.length > 0) {
          setPropertyAmenities(draftAmenities)
          return
        }

        const response = await fetch(`/api/v1/properties/${propertyId}`)
        const result = await response.json()

        if (cancelled) return

        if (!response.ok || !result.success) {
          setPropertyAmenities(null)
          return
        }

        const dbAmenities = result.data?.site_amenities
        if (!Array.isArray(dbAmenities)) {
          setPropertyAmenities(null)
        } else {
          setPropertyAmenities(dbAmenities)
        }

        const rawSettings = result.data?.settings as Record<string, unknown> | null | undefined
        const from = rawSettings?.openPeriodFrom ?? rawSettings?.open_period_from
        const until = rawSettings?.openPeriodUntil ?? rawSettings?.open_period_until
        setOpenPeriodFrom(typeof from === 'string' ? from : null)
        setOpenPeriodUntil(typeof until === 'string' ? until : null)
      } catch {
        if (cancelled) return
        setPropertyAmenities(null)
        setOpenPeriodFrom(null)
        setOpenPeriodUntil(null)
      } finally {
        if (!cancelled) setAmenitiesLoading(false)
      }
    }

    fetchPropertyAmenities()
    return () => {
      cancelled = true
    }
  }, [propertyId, getDraft])

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

      const selectedAmenities = new Set(amenityOptions.map((opt) => opt.key))
      const amenitiesForSubmit: Record<string, boolean> = {}
      for (const key of selectedAmenities) {
        amenitiesForSubmit[key] = Boolean(data.amenities?.[key])
      }

      const apiData = toApiFormat({
        ...data,
        amenities: amenitiesForSubmit,
      })
      const priorRules =
        typeof site?.availability_rules === "object" && site?.availability_rules !== null
          ? { ...(site.availability_rules as Record<string, unknown>) }
          : {}

      const availability_rules: Record<string, unknown> = {
        ...priorRules,
        blackout_dates: blackoutDates,
        blocked_dates: [],
      }

      const finalApiData = {
        ...apiData,
        availability_rules,
      }

      const payloadBase = { ...finalApiData, images: siteImageUrls.length > 0 ? siteImageUrls : undefined }
      // Important: when editing and using defaults pricing, don't overwrite the site's stored manual base price.
      // The v1 update route will otherwise persist `basePrice: 0` and clobber the existing DB value.
      const payload =
        isEditMode && data.pricing_source !== "manual"
          ? (({ basePrice: _basePrice, base_price: _basePriceSnake, ...rest }) => rest)(payloadBase as any)
          : payloadBase

      if (isEditMode) {
        const response = await fetch(`/api/v1/sites/${site.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          const msg =
            (result.error?.details && typeof result.error.details === 'object' && 'message' in result.error.details
              ? (result.error.details as { message?: string }).message
              : null) || result.error?.message
          throw new Error(msg || "Something went wrong while updating the site. Please try again.")
        }
        onSave(result.data)
      } else {
        const response = await fetch(`/api/v1/properties/${propertyId}/sites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          const msg =
            (result.error?.details && typeof result.error.details === 'object' && 'message' in result.error.details
              ? (result.error.details as { message?: string }).message
              : null) || result.error?.message
          throw new Error(msg || "Something went wrong while saving the site. Please try again.")
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

  const siteTypeOptions = useMemo(() => {
    const allowed = siteTypeConfig?.allowed_site_types
    if (!Array.isArray(allowed) || allowed.length === 0) return ALL_SITE_TYPE_OPTIONS
    const allowedLower = new Set(allowed.map((t) => t.toLowerCase()))
    return ALL_SITE_TYPE_OPTIONS.filter((opt) => allowedLower.has(opt.value))
  }, [siteTypeConfig?.allowed_site_types])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Site identification and capacity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:space-y-4 sm:px-6 sm:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="site_number">Site Number *</Label>
              <Input id="site_number" {...register("site_number")} placeholder="A1, B2, etc." disabled={isEditMode} />
              {errors.site_number && <p className="text-sm text-destructive mt-1">{errors.site_number.message}</p>}
            </div>
            <div>
              <Label htmlFor="site_name">Site Name</Label>
              <Input id="site_name" {...register("site_name")} placeholder="Lakeside Premium (optional)" />
              {errors.site_name && <p className="text-sm text-destructive mt-1">{errors.site_name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="site_type">Site Type *</Label>
              <Select value={siteType} onValueChange={(value) => setValue("site_type", value as any)}>
                <SelectTrigger id="site_type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {siteTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.site_type && <p className="text-sm text-destructive mt-1">{errors.site_type.message}</p>}
            </div>
            <div>
              <Label htmlFor="max_occupancy">Max Occupancy *</Label>
              <Input id="max_occupancy" type="number" min="1" max="50" {...register("max_occupancy")} placeholder="4" />
              {errors.max_occupancy && <p className="text-sm text-destructive mt-1">{errors.max_occupancy.message}</p>}
            </div>
            <div>
              <Label htmlFor="max_vehicles">Max Vehicles</Label>
              <Input id="max_vehicles" type="number" min="1" max="10" {...register("max_vehicles")} placeholder="1" />
              {errors.max_vehicles && <p className="text-sm text-destructive mt-1">{errors.max_vehicles.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="size_sqft">Size (sq ft)</Label>
              <Input id="size_sqft" type="number" min="0" {...register("size_sqft")} placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={watch("status")} onValueChange={(value) => setValue("status", value as any)}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
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

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" {...register("description")} placeholder="Describe this site..." rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Site Images */}
      <Card>
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Site images
          </CardTitle>
          <CardDescription>Upload up to {MAX_SITE_IMAGES} images for this site. Optional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0 sm:space-y-4 sm:px-6 sm:pb-6">
          <Dropzone
            {...siteImagesUpload}
            uploadedCount={siteImageUrls.length}
            className={
              siteImageUrls.length >= MAX_SITE_IMAGES && siteImagesUpload.files.length === 0
                ? "h-48 flex flex-col overflow-hidden opacity-60 pointer-events-none"
                : "h-48 flex flex-col overflow-hidden"
            }
          >
            {siteImagesUpload.files.length === 0 ? (
              <div className="flex-1 flex items-center justify-center"><DropzoneEmptyState /></div>
            ) : (
              <div className="w-full h-full overflow-y-auto p-2">
                <DropzoneContent layout="grid" className="mt-0" />
              </div>
            )}
          </Dropzone>

          <div className="pt-2">
            <h4 className="text-sm font-medium mb-3">Uploaded images</h4>
            {siteImageUrls.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {siteImageUrls.map((url) => {
                  const fileName = url.split("/").pop() ?? "Image"
                  const isDeleting = deletingImageUrl === url
                  return (
                    <div key={url} className="relative h-28 rounded-lg overflow-hidden bg-muted group">
                      <img src={url} alt={fileName} className="absolute inset-0 w-full h-full object-cover" />
                      <button
                        type="button"
                        disabled={isDeleting}
                        onClick={() => removeSiteImage(url, siteImagesUpload.inputRef)}
                        className="absolute top-1.5 right-1.5 h-7 w-7 rounded-md flex items-center justify-center backdrop-blur-sm bg-black/50 hover:bg-destructive/90 text-white opacity-90 hover:opacity-100 transition"
                      >
                        {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 px-2 pt-6 pb-1.5 bg-gradient-to-t from-black/50 to-transparent">
                        <p title={fileName} className="text-white text-[11px] font-medium truncate leading-tight">{fileName}</p>
                      </div>
                      {isDeleting && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 size={16} className="animate-spin text-white" />
                        </div>
                      )}
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

      {/* Pricing & Reservation Types */}
      <Card>
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
          <CardTitle>Pricing & Reservation Types</CardTitle>
          <CardDescription>Configure pricing and available reservation types for this site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:space-y-6 sm:px-6 sm:pb-6">
          <div className="space-y-2">
            <Label htmlFor="pricing_source" className="font-medium">Pricing source</Label>
            <Select
              value={pricingSource}
              onValueChange={async (value: "manual" | "property_defaults" | "site_type_defaults") => {
                setValue("pricing_source", value, { shouldDirty: true })
                setValue("use_property_reservation_types", value !== "manual", { shouldDirty: true })

                if (value !== "manual") {
                  setValue("default_reservation_type", undefined)
                  await trigger()
                  return
                }

                // Manual: set reservation types defaults. Keep manual pricing fields as-is (don't overwrite).
                const current = enabledReservationTypesOverride ?? []
                if (current.length === 0) {
                  const defaultTypes = propertyDefaults?.enabled_reservation_types || ["nightly"]
                  setValue("enabled_reservation_types_override", defaultTypes, { shouldDirty: true })
                }
                setValue("default_reservation_type", propertyDefaults?.default_reservation_type)
                await trigger()
              }}
            >
              <SelectTrigger id="pricing_source"><SelectValue placeholder="Select pricing source" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="property_defaults">Use Property Defaults</SelectItem>
                <SelectItem value="site_type_defaults">Use Property Site Type Defaults</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {pricingSource === "manual" && "Use only the rates entered below (base, weekend, weekly, monthly, seasonal)."}
              {pricingSource === "property_defaults" && "Inherit from property rate type configuration (Reservation Types tab)."}
              {pricingSource === "site_type_defaults" && "Inherit from property site type rates (Site Types Rates tab) for this site type."}
            </p>
          </div>

          {pricingSource === "manual" && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-foreground">Select reservation types and set rates for this site:</h4>

                {/* Nightly */}
                <div className={`p-4 border rounded-lg space-y-3 ${enabledReservationTypesOverride?.includes("nightly") ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="res-type-nightly" checked={enabledReservationTypesOverride?.includes("nightly") || false} onCheckedChange={() => toggleReservationType("nightly")} />
                    <div className="flex-1">
                      <Label htmlFor="res-type-nightly" className="cursor-pointer font-medium">Nightly</Label>
                      <p className="text-xs text-muted-foreground">Short stays (1-6 nights)</p>
                    </div>
                  </div>
                  {enabledReservationTypesOverride?.includes("nightly") && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 pl-7">
                      <div>
                        <Label htmlFor="base_price" className="text-xs">Base Rate (per night) *</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input id="base_price" type="number" step="0.01" min="0" className="pl-7 h-9" {...register("base_price", { valueAsNumber: true })} placeholder="45.00" />
                        </div>
                        {errors.base_price && <p className="text-xs text-destructive mt-1">{errors.base_price.message}</p>}
                      </div>
                      <div>
                        <Label htmlFor="weekend_price" className="text-xs">Weekend Rate (Fri/Sat)</Label>
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input id="weekend_price" type="number" step="0.01" min="0" className="pl-7 h-9" {...register("weekend_price")} placeholder="Optional" />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Weekly */}
                <div className={`p-4 border rounded-lg space-y-3 ${enabledReservationTypesOverride?.includes("weekly") ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="res-type-weekly" checked={enabledReservationTypesOverride?.includes("weekly") || false} onCheckedChange={() => toggleReservationType("weekly")} />
                    <div className="flex-1">
                      <Label htmlFor="res-type-weekly" className="cursor-pointer font-medium">Weekly</Label>
                      <p className="text-xs text-muted-foreground">Week-long stays (7-27 nights)</p>
                    </div>
                  </div>
                  {enabledReservationTypesOverride?.includes("weekly") && (
                    <div className="pt-2 pl-7 max-w-xs">
                      <Label htmlFor="weekly_rate" className="text-xs">Weekly Rate (per night)</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input id="weekly_rate" type="number" step="0.01" min="0" className="pl-7 h-9" {...register("weekly_rate")} placeholder="40.00" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Leave empty to use base rate</p>
                    </div>
                  )}
                </div>

                {/* Monthly */}
                <div className={`p-4 border rounded-lg space-y-3 ${enabledReservationTypesOverride?.includes("monthly") ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="res-type-monthly" checked={enabledReservationTypesOverride?.includes("monthly") || false} onCheckedChange={() => toggleReservationType("monthly")} />
                    <div className="flex-1">
                      <Label htmlFor="res-type-monthly" className="cursor-pointer font-medium">Monthly</Label>
                      <p className="text-xs text-muted-foreground">Extended stays (28+ nights)</p>
                    </div>
                  </div>
                  {enabledReservationTypesOverride?.includes("monthly") && (
                    <div className="pt-2 pl-7 max-w-xs">
                      <Label htmlFor="monthly_rate" className="text-xs">Monthly Rate (per night)</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input id="monthly_rate" type="number" step="0.01" min="0" className="pl-7 h-9" {...register("monthly_rate")} placeholder="35.00" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Leave empty to use base rate</p>
                    </div>
                  )}
                </div>

                {/* Seasonal */}
                <div className={`p-4 border rounded-lg space-y-3 ${enabledReservationTypesOverride?.includes("seasonal") ? "border-primary/50 bg-primary/5" : ""}`}>
                  <div className="flex items-center space-x-3">
                    <Checkbox id="res-type-seasonal" checked={enabledReservationTypesOverride?.includes("seasonal") || false} onCheckedChange={() => toggleReservationType("seasonal")} />
                    <div className="flex-1">
                      <Label htmlFor="res-type-seasonal" className="cursor-pointer font-medium">Seasonal</Label>
                      <p className="text-xs text-muted-foreground">Fixed date range with flat rate</p>
                    </div>
                  </div>
                  {enabledReservationTypesOverride?.includes("seasonal") && (
                    <div className="pt-2 pl-7 max-w-xs">
                      <Label htmlFor="seasonal_rate" className="text-xs">Seasonal Flat Rate</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                        <Input id="seasonal_rate" type="number" step="0.01" min="0" className="pl-7 h-9" {...register("seasonal_rate")} placeholder="Use property rate" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Leave empty to use property seasonal rates</p>
                    </div>
                  )}
                </div>
              </div>

              {(!enabledReservationTypesOverride || enabledReservationTypesOverride.length === 0) && (
                <Alert variant="destructive">
                  <AlertDescription>Select at least one reservation type for this site.</AlertDescription>
                </Alert>
              )}

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
                        <SelectItem key={type} value={type}>{RESERVATION_TYPE_LABELS[type].title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Suggested reservation type when guests book this site</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hookups */}
      <Card>
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
          <CardTitle>Hookups</CardTitle>
          <CardDescription>Select the hookup types available at this site</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="hookup_water" checked={hookups.water} onCheckedChange={(c) => setValue("hookups.water", c as boolean)} />
              <Label htmlFor="hookup_water" className="font-normal cursor-pointer">Water</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="hookup_electric" checked={hookups.electric} onCheckedChange={(c) => setValue("hookups.electric", c as boolean)} />
              <Label htmlFor="hookup_electric" className="font-normal cursor-pointer">Electric</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="hookup_sewer" checked={hookups.sewer} onCheckedChange={(c) => setValue("hookups.sewer", c as boolean)} />
              <Label htmlFor="hookup_sewer" className="font-normal cursor-pointer">Sewer</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Amenities */}
      <Card>
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
          <CardTitle>Site Amenities</CardTitle>
          <CardDescription>Select the amenities available at this site. These are based on the Site Amenities configured in Property Details.</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 pt-0 sm:px-6 sm:pb-6">
          {amenitiesLoading ? (
            <div className="flex items-center justify-center py-10">
              <span className="text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {amenityOptions.map(({ key, label, description }) => {
                const field = `amenities.${key}`
                const checked = Boolean((amenities as Record<string, boolean> | undefined)?.[key])
                const id = `amenity_${key}`

                return (
                  <div key={id} className="flex items-start space-x-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(c) => setValue(field as any, c as boolean)}
                      className="mt-0.5"
                    />
                    <div className="grid gap-0.5 leading-none">
                      <Label htmlFor={id} className="font-normal cursor-pointer">{label}</Label>
                      {description && (
                        <p className="text-xs text-muted-foreground">{description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pets & Accessibility */}
      <Card>
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pb-4 sm:pt-6">
          <CardTitle>Pets & Accessibility</CardTitle>
          <CardDescription>Pet policies and ADA accessibility features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 pb-4 pt-0 sm:space-y-6 sm:px-6 sm:pb-6">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="allow_pets" checked={allowPets} onCheckedChange={(c) => setValue("allow_pets", c as boolean)} />
              <Label htmlFor="allow_pets" className="font-medium cursor-pointer">Allow Pets</Label>
            </div>
            {allowPets && (
              <div>
                <Label htmlFor="pet_fee">Pet Fee (one-time)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input id="pet_fee" type="number" step="0.01" min="0" className="pl-7" {...register("pet_fee")} placeholder="15.00" />
                </div>
                {errors.pet_fee && <p className="text-sm text-destructive mt-1">{errors.pet_fee.message}</p>}
                <p className="text-xs text-muted-foreground mt-1">One-time fee (optional, leave empty for no fee)</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="ada_accessible" checked={adaAccessible} onCheckedChange={(c) => setValue("ada_accessible", c as boolean)} />
              <Label htmlFor="ada_accessible" className="font-medium cursor-pointer">ADA Accessible</Label>
            </div>
            {adaAccessible && accessibilityFeatures && (
              <div className="ml-6 space-y-3">
                <p className="text-sm text-muted-foreground">Select specific accessibility features available:</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { id: "accessibility_wheelchair", field: "accessibility_features.wheelchair_accessible" as const, label: "Wheelchair Accessible", value: accessibilityFeatures.wheelchair_accessible },
                    { id: "accessibility_wide_paths", field: "accessibility_features.wide_paths" as const, label: "Wide Paths", value: accessibilityFeatures.wide_paths },
                    { id: "accessibility_table", field: "accessibility_features.accessible_table" as const, label: "Accessible Table", value: accessibilityFeatures.accessible_table },
                    { id: "accessibility_restroom", field: "accessibility_features.accessible_restroom" as const, label: "Accessible Restroom", value: accessibilityFeatures.accessible_restroom },
                    { id: "accessibility_handrails", field: "accessibility_features.handrails" as const, label: "Handrails", value: accessibilityFeatures.handrails },
                    { id: "accessibility_level_ground", field: "accessibility_features.level_ground" as const, label: "Level Ground", value: accessibilityFeatures.level_ground },
                  ].map(({ id, field, label, value }) => (
                    <div key={id} className="flex items-center space-x-2">
                      <Checkbox id={id} checked={value} onCheckedChange={(c) => setValue(field, c as boolean)} />
                      <Label htmlFor={id} className="font-normal cursor-pointer">{label}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blackout Dates */}
      <Card>
        <CardHeader>
          <CardTitle>Blackout Dates</CardTitle>
          <CardDescription>Dates when check-in is not allowed for this site</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BlackoutDatesPicker
            variant="dashboard"
            label="Blackout dates"
            value={blackoutDates}
            onChange={setBlackoutDates}
            numberOfMonths={1}
            openPeriodFrom={openPeriodFrom}
            openPeriodUntil={openPeriodUntil}
          />

          {blackoutDates.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {blackoutDates.map((date) => (
                <Badge key={date} variant="secondary" className="pl-3 pr-1">
                  {date}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-auto p-1"
                    onClick={() => setBlackoutDates((prev) => prev.filter((d) => d !== date))}
                    aria-label={`Remove ${date}`}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          )}

          {blackoutDates.length > 0 && (
            <Alert>
              <Info className="h-4 w-4" aria-hidden />
              <AlertDescription>
              Blackout dates prevent check-in on specific dates (e.g. holidays). 
              Guests can still be checked-in if their reservation started before the blackout date.
              </AlertDescription>
            </Alert>
          )}

          {blackoutDates.length === 0 && (
            <p className="text-sm text-muted-foreground">No blackout dates configured for this site.</p>
          )}
        </CardContent>
      </Card>

      {Object.keys(errors).length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>
            <p className="font-medium mb-1">Please fix the following errors:</p>
            <ul className="list-disc list-inside text-sm">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>
                  {field.replace(/_/g, ' ')}: {typeof error?.message === "string" ? error.message : "Invalid value"}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-2 items-center justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          <X className="mr-2 h-4 w-4" />Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : <><Save className="mr-2 h-4 w-4" />{isEditMode ? "Update Site" : "Add Site"}</>}
        </Button>
      </div>
    </form>
  )
}
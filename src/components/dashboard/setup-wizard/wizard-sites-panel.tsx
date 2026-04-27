"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { useForm, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Tent,
  Trash2,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { siteFormSchema, toApiFormat, fromApiFormat } from "./site-form-schema"
import type { SiteFormData } from "./site-form-schema"
import { useToast } from "@/hooks/use-toast"
import { Dropzone, DropzoneContent, DropzoneEmptyState } from "@/components/dropzone"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useSupabaseUpload } from "@/hooks/use-supabase-upload"
import { createClient } from "@/lib/supabase/client"
import { BlackoutDatesPicker } from "@/components/guest/booking-date-range-picker"
import { Badge } from "@/components/ui/badge"
import { useWizardFormStore } from "./wizard-form-store"

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteSection = "basic_info" | "pricing" | "images" | "hookups" | "pets_accessibility" | "blackout_dates"

const SITE_SECTIONS: Array<{ id: SiteSection; label: string; description: string }> = [
  { id: "basic_info", label: "Basic information", description: "Site identification, type, and capacity" },
  { id: "pricing", label: "Pricing & Reservation", description: "Configure pricing for this site" },
  { id: "images", label: "Images", description: "Upload photos of this campsite" },
  { id: "hookups", label: "Hookups & Amenities", description: "Utilities, hookups, and site features" },
  { id: "pets_accessibility", label: "Pets & Accessibility", description: "Pet policy and ADA features" },
  { id: "blackout_dates", label: "Blackout dates", description: "Dates this site cannot be booked" },
]

const SITE_IMAGES_BUCKET = "site-property-images"
const MAX_SITE_IMAGES = 1
const MAX_SITE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
const DEFAULT_SITE_TYPE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "tent", label: "Tent" },
  { value: "rv", label: "RV" },
  { value: "cabin", label: "Cabin" },
  { value: "glamping", label: "Glamping" },
  { value: "yurt", label: "Yurt" },
  { value: "other", label: "Other" },
]
const VALID_SITE_TYPE_VALUES = new Set(DEFAULT_SITE_TYPE_OPTIONS.map((opt) => opt.value))

function normalizeSiteTypeValue(raw: string): string | null {
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return null
  if (VALID_SITE_TYPE_VALUES.has(normalized)) return normalized

  // Common label/value variants from config UI
  if (normalized.includes("rv")) return "rv"
  if (normalized.includes("glamp")) return "glamping"
  if (normalized.includes("tent")) return "tent"
  if (normalized.includes("cabin")) return "cabin"
  if (normalized.includes("yurt")) return "yurt"
  if (normalized.includes("other")) return "other"
  return null
}
const RESERVATION_TYPE_LABELS: Record<
  "nightly" | "weekly" | "monthly" | "seasonal",
  { title: string; description: string }
> = {
  nightly: { title: "Nightly", description: "Short stays (1-6 nights)" },
  weekly: { title: "Weekly", description: "Week-long stays (7-27 nights)" },
  monthly: { title: "Monthly", description: "Extended stays (28+ nights)" },
  seasonal: { title: "Seasonal", description: "Fixed date range with flat rate" },
}

type SiteData = Record<string, unknown> & {
  id: string
  site_number: string
  site_name?: string | null
}

type SitesPanelContextValue = {
  propertyId: string
  sites: SiteData[]
  selectedSiteId: string | null
  isNewSite: boolean
  expandedSites: Set<string>
  currentSection: SiteSection
  loading: boolean
  saving: boolean
  noSiteError: string | null
  hasUnsavedDraftForCurrentProperty: boolean
  unsavedDraftSiteNumber: string
  propertyDefaultsNightlyRate: number | null
  siteTypeOptions: Array<{ value: string; label: string }>
  amenityOptions: Array<{ key: string; label: string }>
  amenitiesLoading: boolean
  form: UseFormReturn<SiteFormData>
  siteImageUrls: string[]
  blackoutDates: string[]
  siteImagesUpload: ReturnType<typeof useSupabaseUpload>
  setSiteImageUrls: React.Dispatch<React.SetStateAction<string[]>>
  setBlackoutDates: React.Dispatch<React.SetStateAction<string[]>>
  completedSections: Record<string, Set<SiteSection>>
  setSelectedSiteId: (id: string) => void
  toggleExpandSite: (id: string) => void
  setCurrentSection: (s: SiteSection) => void
  getUnsavedDraftPropertyIds: () => string[]
  reopenUnsavedDraft: () => void
  handleAddSite: () => void
  handleSaveSite: () => void
  handleDiscardNewSite: () => void
  handleDeleteSite: (siteId: string) => Promise<void>
  removeSiteImage: (url: string) => Promise<void>
}

// ─── Context ──────────────────────────────────────────────────────────────────

export const SitesPanelContext = createContext<SitesPanelContextValue | null>(null)

function useSitesPanelContext() {
  const ctx = useContext(SitesPanelContext)
  if (!ctx) throw new Error("Must be used inside SitesPanelContext.Provider")
  return ctx
}

// ─── Shared state hook ────────────────────────────────────────────────────────

const DEFAULT_SITE_FORM_VALUES: SiteFormData = {
  site_number: "",
  site_name: "",
  site_type: "tent",
  max_occupancy: 4,
  max_vehicles: 1,
  status: "available",
  description: "",
  base_price: 0,
  pricing_source: "property_defaults",
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
}

export function useSitesPanelState(args: {
  property: Property | null
  isActive: boolean
  onSiteConfirmed?: (propertyId: string) => void
}) {
  const { property, isActive, onSiteConfirmed } = args
  const { toast } = useToast()
  const { getDraft } = useWizardFormStore()
  const supabase = useMemo(() => createClient(), [])

  const [sites, setSites] = useState<SiteData[]>([])
  const [selectedSiteId, setSelectedSiteIdRaw] = useState<string | null>(null)
  const [isNewSite, setIsNewSite] = useState(false)
  const [expandedSites, setExpandedSites] = useState<Set<string>>(new Set())
  const [currentSection, setCurrentSection] = useState<SiteSection>("basic_info")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [noSiteError, setNoSiteError] = useState<string | null>(null)
  const [propertyDefaultsNightlyRate, setPropertyDefaultsNightlyRate] = useState<number | null>(null)
  const [allowedSiteTypes, setAllowedSiteTypes] = useState<string[]>([])
  const [propertyAmenities, setPropertyAmenities] = useState<unknown[] | null>(null)
  const [amenitiesLoading, setAmenitiesLoading] = useState(false)
  const [completedSections, setCompletedSections] = useState<Record<string, Set<SiteSection>>>({})
  const [siteImageUrls, setSiteImageUrls] = useState<string[]>([])
  const [blackoutDates, setBlackoutDates] = useState<string[]>([])
  const unsavedDraftsRef = useRef<
    Record<
      string,
      {
        values: SiteFormData
        currentSection: SiteSection
        siteImageUrls: string[]
        blackoutDates: string[]
      }
    >
  >({})
  const previousPropertyIdRef = useRef<string | null>(null)

  const loadingRef = useRef(false)
  const sitesRef = useRef<SiteData[]>([])
  const hasInitializedRef = useRef(false)

  const selectedSite = sites.find((s) => s.id === selectedSiteId) ?? null
  const siteImagesPath =
    selectedSite?.id ? `${property?.id}/${selectedSite.id}` : `${property?.id}/new`

  const siteImagesUpload = useSupabaseUpload({
    bucketName: SITE_IMAGES_BUCKET,
    path: siteImagesPath,
    maxFiles: MAX_SITE_IMAGES,
    maxFileSize: MAX_SITE_IMAGE_SIZE_BYTES,
    allowedMimeTypes: ["image/*"],
    upsert: true,
  })

  const form = useForm<SiteFormData>({
    resolver: zodResolver(siteFormSchema),
    mode: "onChange",
    defaultValues: DEFAULT_SITE_FORM_VALUES,
  })

  const amenityOptions = useMemo(() => {
    const fallback = [
      { key: "fire_pit", label: "Fire Pit" },
      { key: "picnic_table", label: "Picnic Table" },
      { key: "grill", label: "Grill" },
      { key: "shade", label: "Shade" },
      { key: "pet_friendly", label: "Pet Friendly" },
      { key: "lake_view", label: "Lake View" },
      { key: "waterfront", label: "Waterfront" },
    ]

    if (!Array.isArray(propertyAmenities)) return fallback

    const options: { key: string; label: string }[] = []
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

      const keyFromId =
        item && typeof item === "object" && typeof (item as { id?: unknown }).id === "string"
          ? (item as { id: string }).id.trim()
          : ""
      const key = keyFromId || trimmed
      if (!key || seen.has(key)) continue

      seen.add(key)
      options.push({ key, label: trimmed })
    }

    return options.length > 0 ? options : fallback
  }, [propertyAmenities])

  const siteTypeOptions = useMemo(() => {
    if (!Array.isArray(allowedSiteTypes) || allowedSiteTypes.length === 0) {
      return DEFAULT_SITE_TYPE_OPTIONS
    }
    const byValue = new Map(DEFAULT_SITE_TYPE_OPTIONS.map((opt) => [opt.value, opt.label]))
    const seen = new Set<string>()
    const normalizedOptions: Array<{ value: string; label: string }> = []

    for (const raw of allowedSiteTypes) {
      const normalized = normalizeSiteTypeValue(raw)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      normalizedOptions.push({
        value: normalized,
        label: byValue.get(normalized) ?? (normalized.charAt(0).toUpperCase() + normalized.slice(1)),
      })
    }

    return normalizedOptions.length > 0 ? normalizedOptions : DEFAULT_SITE_TYPE_OPTIONS
  }, [allowedSiteTypes])

  useEffect(() => {
    if (!property?.id) {
      setPropertyAmenities(null)
      return
    }

    let cancelled = false

    const fetchPropertyAmenities = async () => {
      setAmenitiesLoading(true)
      try {
        const draftAmenities = getDraft(property.id)?.amenities
        if (Array.isArray(draftAmenities) && draftAmenities.length > 0) {
          setPropertyAmenities(draftAmenities)
          return
        }

        const response = await fetch(`/api/v1/properties/${property.id}`)
        const result = await response.json()
        if (cancelled) return

        if (!response.ok || !result.success) {
          setPropertyAmenities(null)
          return
        }

        const dbAmenities = result.data?.amenities
        setPropertyAmenities(Array.isArray(dbAmenities) ? dbAmenities : null)
      } catch {
        if (!cancelled) {
          setPropertyAmenities(null)
        }
      } finally {
        if (!cancelled) setAmenitiesLoading(false)
      }
    }

    fetchPropertyAmenities()
    return () => {
      cancelled = true
    }
  }, [property?.id, getDraft])

  useEffect(() => {
    if (!property?.id) {
      setAllowedSiteTypes([])
      return
    }

    let cancelled = false

    const loadAllowedSiteTypes = async () => {
      try {
        const draftSiteTypeConfig = getDraft(property.id)?.siteTypeConfig as
          | { allowed_site_types?: unknown }
          | undefined
        const draftAllowed = draftSiteTypeConfig?.allowed_site_types
        if (Array.isArray(draftAllowed) && draftAllowed.length > 0) {
          if (!cancelled) {
            setAllowedSiteTypes(
              draftAllowed
                .filter((v): v is string => typeof v === "string")
                .map((v) => normalizeSiteTypeValue(v))
                .filter((v): v is string => Boolean(v))
            )
          }
          return
        }

        const response = await fetch(`/api/properties/${property.id}/settings`)
        if (!response.ok) {
          if (!cancelled) setAllowedSiteTypes([])
          return
        }
        const result = (await response.json()) as { property?: Record<string, unknown> }
        if (cancelled) return
        const siteTypeConfig = (result.property?.site_type_config ?? null) as
          | { allowed_site_types?: unknown }
          | null
        const allowed = siteTypeConfig?.allowed_site_types
        if (Array.isArray(allowed) && allowed.length > 0) {
          setAllowedSiteTypes(
            allowed
              .filter((v): v is string => typeof v === "string")
              .map((v) => normalizeSiteTypeValue(v))
              .filter((v): v is string => Boolean(v))
          )
        } else {
          setAllowedSiteTypes([])
        }
      } catch {
        if (!cancelled) setAllowedSiteTypes([])
      }
    }

    loadAllowedSiteTypes()
    return () => {
      cancelled = true
    }
  }, [property?.id, getDraft])

  useEffect(() => {
    if (!isNewSite) return
    if (siteTypeOptions.length === 0) return

    const current = form.getValues("site_type")
    const allowedValues = new Set(siteTypeOptions.map((opt) => opt.value))
    if (!allowedValues.has(current)) {
      const first = siteTypeOptions[0]
      if (first) {
        form.setValue("site_type", first.value as SiteFormData["site_type"])
      }
    }
  }, [isNewSite, siteTypeOptions, form])

  const clearCurrentDraftState = useCallback(() => {
    setSelectedSiteIdRaw(null)
    setIsNewSite(false)
    setExpandedSites(new Set())
    setCurrentSection("basic_info")
    setNoSiteError(null)
    form.reset(DEFAULT_SITE_FORM_VALUES)
    setSiteImageUrls([])
    setBlackoutDates([])
  }, [form])

  const persistCurrentUnsavedDraft = useCallback(
    (propertyId: string) => {
      if (!isNewSite) {
        delete unsavedDraftsRef.current[propertyId]
        return
      }

      unsavedDraftsRef.current[propertyId] = {
        values: form.getValues(),
        currentSection,
        siteImageUrls: [...siteImageUrls],
        blackoutDates: [...blackoutDates],
      }
    },
    [isNewSite, form, currentSection, siteImageUrls, blackoutDates]
  )

  const restoreUnsavedDraft = useCallback(
    (propertyId: string): boolean => {
      const draft = unsavedDraftsRef.current[propertyId]
      if (!draft) return false

      setSelectedSiteIdRaw(null)
      setIsNewSite(true)
      setExpandedSites(new Set())
      setCurrentSection(draft.currentSection)
      setNoSiteError(null)
      form.reset(draft.values)
      setSiteImageUrls([...draft.siteImageUrls])
      setBlackoutDates([...draft.blackoutDates])
      return true
    },
    [form]
  )

  // Sync uploaded images into state
  const successes = siteImagesUpload.successes
  useEffect(() => {
    if (successes.length === 0) return
    setSiteImageUrls((prev) => {
      const existing = new Set(prev)
      const next = [...prev]
      for (const name of successes) {
        const { data } = supabase.storage
          .from(SITE_IMAGES_BUCKET)
          .getPublicUrl(`${siteImagesPath}/${name}`)
        if (!existing.has(data.publicUrl) && next.length < MAX_SITE_IMAGES) {
          next.push(data.publicUrl)
          existing.add(data.publicUrl)
        }
      }
      return next.slice(0, MAX_SITE_IMAGES)
    })
  }, [successes, siteImagesPath, supabase])

  const removeSiteImage = useCallback(
    async (url: string) => {
      const marker = `/object/public/${SITE_IMAGES_BUCKET}/`
      const idx = url.indexOf(marker)
      const path = idx !== -1 ? url.slice(idx + marker.length) : null
      if (path) await supabase.storage.from(SITE_IMAGES_BUCKET).remove([path])
      setSiteImageUrls((prev) => prev.filter((u) => u !== url))
    },
    [supabase]
  )

  const selectSite = useCallback(
    (site: SiteData) => {
      if (property?.id && isNewSite && (!!form.getValues("site_number")?.trim() || form.formState.isDirty)) {
        unsavedDraftsRef.current[property.id] = {
          values: form.getValues(),
          currentSection,
          siteImageUrls: [...siteImageUrls],
          blackoutDates: [...blackoutDates],
        }
      }
      setSelectedSiteIdRaw(site.id)
      setIsNewSite(false)
      setCurrentSection("basic_info")
      form.reset(fromApiFormat(site) as SiteFormData)
      const imgs = (site.site_images ?? site.images) as string[] | undefined
      setSiteImageUrls(Array.isArray(imgs) ? [...imgs] : [])
      const rawRules = site.availability_rules as { blackout_dates?: string[] } | undefined
      setBlackoutDates(Array.isArray(rawRules?.blackout_dates) ? [...rawRules.blackout_dates].sort() : [])
    },
    [property?.id, isNewSite, form, currentSection, siteImageUrls, blackoutDates]
  )

  const fetchPropertyDefaults = useCallback(async () => {
    if (!property) return
    try {
      const res = await fetch(`/api/v1/properties/${property.id}/reservation-types`)
      const result = await res.json()
      if (res.ok && result.success) {
        const config = result.data?.reservation_type_config
        setPropertyDefaultsNightlyRate(config?.nightly?.rate_cents ?? null)
      }
    } catch {
      // non-critical
    }
  }, [property?.id])

  const fetchSites = useCallback(async () => {
    if (!property || !isActive) return
    try {
      setLoading(true)
      loadingRef.current = true
      const res = await fetch(`/api/v1/properties/${property.id}/sites`)
      const result = await res.json()
      const rawItems: Record<string, unknown>[] =
        result.success && result.data?.items ? result.data.items : []
      // v1 API returns camelCase (siteNumber, siteName); normalize to snake_case for rendering
      const items: SiteData[] = rawItems.map((s) => ({
        ...(s as SiteData),
        site_number: (s.siteNumber as string | undefined) ?? (s.site_number as string | undefined) ?? "",
        site_name: (s.siteName as string | null | undefined) ?? (s.site_name as string | null | undefined) ?? null,
      }))
      setSites(items)
      sitesRef.current = items
      if (items.length > 0) {
        setNoSiteError(null)
        onSiteConfirmed?.(property.id)
        if (!hasInitializedRef.current && items[0]) {
          hasInitializedRef.current = true
          selectSite(items[0])
          setExpandedSites(new Set([items[0].id]))
        }
      }
    } catch (err) {
      console.error("Error fetching sites:", err)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [property?.id, isActive, selectSite, onSiteConfirmed])

  useEffect(() => {
    if (!isActive) return

    const nextPropertyId = property?.id ?? null
    const previousPropertyId = previousPropertyIdRef.current
    const propertyChanged = previousPropertyId !== nextPropertyId

    // Only react when the selected property actually changes.
    if (!propertyChanged) return

    hasInitializedRef.current = false

    if (previousPropertyId && isNewSite) {
      unsavedDraftsRef.current[previousPropertyId] = {
        values: form.getValues(),
        currentSection,
        siteImageUrls: [...siteImageUrls],
        blackoutDates: [...blackoutDates],
      }
    }

    previousPropertyIdRef.current = nextPropertyId

    const draft = nextPropertyId ? unsavedDraftsRef.current[nextPropertyId] : undefined
    if (draft) {
      setSelectedSiteIdRaw(null)
      setIsNewSite(true)
      setExpandedSites(new Set())
      setCurrentSection(draft.currentSection)
      setNoSiteError(null)
      form.reset(draft.values)
      setSiteImageUrls([...draft.siteImageUrls])
      setBlackoutDates([...draft.blackoutDates])
      hasInitializedRef.current = true
    } else {
      setSelectedSiteIdRaw(null)
      setIsNewSite(false)
      setExpandedSites(new Set())
      setCurrentSection("basic_info")
      setNoSiteError(null)
      form.reset(DEFAULT_SITE_FORM_VALUES)
      setSiteImageUrls([])
      setBlackoutDates([])
    }

    fetchSites()
    fetchPropertyDefaults()
  }, [isActive, property?.id, isNewSite, currentSection, siteImageUrls, blackoutDates, form, fetchSites, fetchPropertyDefaults])

  const setSelectedSiteId = useCallback(
    (id: string) => {
      const site = sites.find((s) => s.id === id)
      if (site) selectSite(site)
    },
    [sites, selectSite]
  )

  const toggleExpandSite = useCallback(
    (id: string) => {
      setExpandedSites((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
          const site = sites.find((s) => s.id === id)
          if (site) selectSite(site)
        }
        return next
      })
    },
    [sites, selectSite]
  )

  const handleAddSite = useCallback(() => {
    if (property?.id) {
      unsavedDraftsRef.current[property.id] = {
        values: DEFAULT_SITE_FORM_VALUES,
        currentSection: "basic_info",
        siteImageUrls: [],
        blackoutDates: [],
      }
    }
    setSelectedSiteIdRaw(null)
    setIsNewSite(true)
    setCurrentSection("basic_info")
    form.reset(DEFAULT_SITE_FORM_VALUES)
    setSiteImageUrls([])
    setBlackoutDates([])
  }, [form, property?.id])

  const handleDiscardNewSite = useCallback(() => {
    if (!property?.id) return
    delete unsavedDraftsRef.current[property.id]
    setNoSiteError(null)

    const first = sitesRef.current[0]
    if (first) {
      selectSite(first)
      setSelectedSiteIdRaw(first.id)
      setIsNewSite(false)
      setExpandedSites((prev) => new Set([...prev, first.id]))
      return
    }

    clearCurrentDraftState()
  }, [property?.id, selectSite, clearCurrentDraftState])

  const handleSaveSite = useCallback(async () => {
    if (!property) return
    const isValid = await form.trigger()
    if (!isValid) return
    const data = form.getValues()
    try {
      setSaving(true)
      const payload = {
        ...toApiFormat(data),
        availability_rules: {
          blackout_dates: blackoutDates,
          blocked_dates: [],
        },
        images: siteImageUrls.length > 0 ? siteImageUrls : undefined,
      }
      let savedSite: SiteData
      if (selectedSiteId && !isNewSite) {
        const res = await fetch(`/api/v1/sites/${selectedSiteId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok || !result.success)
          throw new Error(result.error?.message || "Failed to update site")
        savedSite = result.data
      } else {
        const res = await fetch(`/api/v1/properties/${property.id}/sites`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok || !result.success)
          throw new Error(result.error?.message || "Failed to create site")
        savedSite = result.data
      }
      setCompletedSections((prev) => {
        const existing = new Set(prev[savedSite.id] ?? [])
        existing.add(currentSection)
        return { ...prev, [savedSite.id]: existing }
      })
      toast({
        title: isNewSite ? "Site created" : "Site updated",
        description: `Site ${savedSite.site_number} has been saved.`,
        variant: "success",
      })
      setNoSiteError(null)
      onSiteConfirmed?.(property.id)
      delete unsavedDraftsRef.current[property.id]
      // Re-fetch and re-select the saved site
      hasInitializedRef.current = true
      await fetchSites()
      setSelectedSiteIdRaw(savedSite.id)
      setIsNewSite(false)
      setExpandedSites((prev) => new Set([...prev, savedSite.id]))
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Failed to save site",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }, [
    property,
    selectedSiteId,
    isNewSite,
    form,
    siteImageUrls,
    currentSection,
    blackoutDates,
    toast,
    fetchSites,
    onSiteConfirmed,
  ])

  const handleDeleteSite = useCallback(
    async (siteId: string) => {
      try {
        const res = await fetch(`/api/v1/sites/${siteId}`, { method: "DELETE" })
        const result = await res.json()
        if (!res.ok || !result.success)
          throw new Error(result.error?.message || "Failed to delete site")
        const wasSelected = selectedSiteId === siteId
        toast({
          title: "Site deleted", description: "The site has been removed.",
          variant: "success",
        })
        await fetchSites()
        if (wasSelected) {
          const next = sitesRef.current
          const first = next[0]
          if (first) {
            selectSite(first)
            setSelectedSiteIdRaw(first.id)
            setIsNewSite(false)
            setExpandedSites((prev) => new Set([...prev, first.id]))
          } else {
            setSelectedSiteIdRaw(null)
            setIsNewSite(true)
            setCurrentSection("basic_info")
            form.reset(DEFAULT_SITE_FORM_VALUES)
            setSiteImageUrls([])
            setBlackoutDates([])
          }
        }
        setExpandedSites((prev) => {
          const next = new Set(prev)
          next.delete(siteId)
          return next
        })
      } catch (err) {
        toast({
          title: "Delete failed",
          description: err instanceof Error ? err.message : "Failed to delete site",
          variant: "destructive",
        })
      }
    },
    [selectedSiteId, toast, fetchSites, selectSite, form]
  )

  const canAdvance = useCallback(async (): Promise<boolean> => {
    // Wait for any in-progress load to settle
    await new Promise<void>((r) => {
      const poll = () => (loadingRef.current ? setTimeout(poll, 100) : r())
      poll()
    })

    const currentPropertyId = property?.id
    if (currentPropertyId && isNewSite) {
      persistCurrentUnsavedDraft(currentPropertyId)
    }

    // Block if current property has unsaved site draft
    if (currentPropertyId && unsavedDraftsRef.current[currentPropertyId]) {
      setNoSiteError(null)
      return false
    }

    // Block if no sites have been saved yet
    if (sitesRef.current.length === 0) {
      setNoSiteError(null)
      return false
    }

    setNoSiteError(null)
    return true
  }, [property?.id, form, isNewSite, persistCurrentUnsavedDraft])

  const getUnsavedDraftPropertyIds = useCallback((): string[] => {
    return Object.keys(unsavedDraftsRef.current)
  }, [])

  useEffect(() => {
    const hasUnsavedDrafts = Object.keys(unsavedDraftsRef.current).length > 0
    if (!hasUnsavedDrafts) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Required for some browsers to trigger native confirmation dialog.
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [isNewSite, selectedSiteId, currentSection, siteImageUrls, blackoutDates])

  const hasUnsavedDraftForCurrentProperty = Boolean(
    property?.id && unsavedDraftsRef.current[property.id]
  )
  const unsavedDraftSiteNumber = (() => {
    if (!property?.id) return ""
    const draft = unsavedDraftsRef.current[property.id]
    if (!draft) return ""
    return draft.values.site_number?.trim() ?? ""
  })()

  const reopenUnsavedDraft = useCallback(() => {
    if (!property?.id) return
    restoreUnsavedDraft(property.id)
  }, [property?.id, restoreUnsavedDraft])

  const contextValue: SitesPanelContextValue = {
    propertyId: property?.id ?? "",
    sites,
    selectedSiteId,
    isNewSite,
    expandedSites,
    currentSection,
    loading,
    saving,
    noSiteError,
    hasUnsavedDraftForCurrentProperty,
    unsavedDraftSiteNumber,
    propertyDefaultsNightlyRate,
    siteTypeOptions,
    amenityOptions,
    amenitiesLoading,
    form,
    siteImageUrls,
    blackoutDates,
    siteImagesUpload,
    setSiteImageUrls,
    setBlackoutDates,
    completedSections,
    setSelectedSiteId,
    toggleExpandSite,
    setCurrentSection,
    getUnsavedDraftPropertyIds,
    reopenUnsavedDraft,
    handleAddSite,
    handleSaveSite,
    handleDiscardNewSite,
    handleDeleteSite,
    removeSiteImage,
  }

  return { contextValue, canAdvance }
}

// ─── Sidebar tree component ───────────────────────────────────────────────────

export function SitesSidebarTree() {
  const {
    sites,
    propertyId,
    selectedSiteId,
    isNewSite,
    hasUnsavedDraftForCurrentProperty,
    unsavedDraftSiteNumber,
    expandedSites,
    currentSection,
    loading,
    toggleExpandSite,
    setCurrentSection,
    setSelectedSiteId,
    reopenUnsavedDraft,
    handleDiscardNewSite,
    handleAddSite,
    handleDeleteSite,
    form,
  } = useSitesPanelContext()

  const [siteToDelete, setSiteToDelete] = useState<SiteData | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [unsavedExpanded, setUnsavedExpanded] = useState(true)

  const onConfirmDelete = useCallback(async () => {
    if (!siteToDelete) return
    setDeleting(true)
    try {
      await handleDeleteSite(siteToDelete.id)
      setSiteToDelete(null)
    } finally {
      setDeleting(false)
    }
  }, [siteToDelete, handleDeleteSite])

  // Live-update the new-site label as the user types the site number
  const newSiteNumber = form.watch("site_number")

  return (
    <div className="flex-1 flex flex-col">
      {/* Header row — has its own horizontal padding */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Sites
        </p>
        <button
          type="button"
          onClick={handleAddSite}
          className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Add site
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : sites.length === 0 && !isNewSite ? (
        <div className="text-center px-4 py-6">
          <Tent className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No sites yet.</p>
        </div>
      ) : (
        <nav className="pb-3">
          {sites.map((site) => {
            const isExpanded = expandedSites.has(site.id)
            const isSelected = site.id === selectedSiteId && !isNewSite
            return (
              <div key={site.id}>
                {/* Site-level row — dot is green (saved in DB), delete on right */}
                <div className="flex items-center w-full group">
                  <button
                    type="button"
                    onClick={() => toggleExpandSite(site.id)}
                    className={cn(
                      "flex-1 min-w-0 flex items-center gap-2 pl-4 pr-2 py-2 text-sm transition-colors text-left",
                      isSelected
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span className="h-2 w-2 rounded-full flex-shrink-0 bg-green-500" />
                    <span className="flex-1 truncate">{site.site_number}</span>
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setSiteToDelete(site)
                    }}
                    className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                    aria-label={`Delete site ${site.site_number}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Section rows — deeper indent baked into pl-7, no extra wrapper */}
                {isExpanded && SITE_SECTIONS.map((section) => {
                  const isSectionActive = isSelected && currentSection === section.id
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => {
                        if (!isSelected) setSelectedSiteId(site.id)
                        setCurrentSection(section.id)
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 pl-7 pr-3 py-1.5 text-sm transition-colors text-left",
                        isSectionActive
                          ? "bg-muted text-primary font-medium border-l-[3px] border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full flex-shrink-0",
                          isSectionActive ? "bg-primary" : "bg-muted-foreground/40"
                        )}
                      />
                      <span className="flex-1">{section.label}</span>
                    </button>
                  )
                })}
              </div>
            )
          })}

          {/* New (unsaved) site — amber dot signals not yet saved */}
          {(isNewSite || hasUnsavedDraftForCurrentProperty) && (
            <div>
              <div className="flex items-center w-full group">
                <button
                  type="button"
                  onClick={() => {
                    reopenUnsavedDraft()
                    setUnsavedExpanded((prev) => !prev)
                  }}
                  className="flex-1 min-w-0 flex items-center gap-2 pl-4 pr-2 py-2 text-sm transition-colors text-left text-primary font-medium"
                >
                  <span className="h-2 w-2 rounded-full flex-shrink-0 bg-amber-400" />
                  <span className="flex-1 truncate">
                    {isNewSite
                      ? (newSiteNumber?.trim() || <span className="italic opacity-70">New site</span>)
                      : (unsavedDraftSiteNumber || <span className="italic opacity-70">New site</span>)}
                  </span>
                  {unsavedExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleDiscardNewSite}
                  className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                  aria-label="Discard unsaved site"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {isNewSite && unsavedExpanded && SITE_SECTIONS.map((section) => {
                const active = currentSection === section.id
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setCurrentSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 pl-7 pr-3 py-1.5 text-sm transition-colors text-left",
                      active
                        ? "bg-muted text-primary font-medium border-l-[3px] border-primary"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full flex-shrink-0",
                        active ? "bg-primary" : "bg-muted-foreground/40"
                      )}
                    />
                    <span className="flex-1">{section.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </nav>
      )}

      <AlertDialog open={!!siteToDelete} onOpenChange={(open) => !open && setSiteToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete site {siteToDelete?.site_number}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <strong>{siteToDelete?.site_name || `Site ${siteToDelete?.site_number}`}</strong>? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                onConfirmDelete()
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ─── Content component ────────────────────────────────────────────────────────

export function SitesPanelContent() {
  const {
    currentSection,
    form,
    saving,
    isNewSite,
    selectedSiteId,
    handleSaveSite,
    propertyDefaultsNightlyRate,
    siteTypeOptions,
    amenityOptions,
    amenitiesLoading,
    siteImageUrls,
    setSiteImageUrls,
    siteImagesUpload,
    removeSiteImage,
    sites,
    blackoutDates,
    setBlackoutDates,
  } = useSitesPanelContext()

  const { register, watch, setValue, trigger, formState: { errors } } = form
  const siteType = watch("site_type")
  const hookups = watch("hookups")
  const amenities = watch("amenities")
  const allowPets = watch("allow_pets")
  const adaAccessible = watch("ada_accessible")
  const accessibilityFeatures = watch("accessibility_features")
  const pricingSource = watch("pricing_source")
  const enabledReservationTypesOverride = watch("enabled_reservation_types_override")
  const defaultReservationType = watch("default_reservation_type")
  const siteNumber = watch("site_number")
  const hasSelection = isNewSite || !!selectedSiteId

  const activeSection = SITE_SECTIONS.find((s) => s.id === currentSection)
  const siteLabel = siteNumber?.trim()
    ? `Site ${siteNumber.trim()}`
    : (selectedSiteId
      ? `Site ${sites.find((s) => s.id === selectedSiteId)?.site_number ?? ""}`
      : "New site")

  if (!hasSelection) {
    return (
      <div className="flex h-full min-h-[60vh] flex-col items-center justify-center text-center">
        <Tent className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-base font-semibold mb-1">No site selected</h3>
        {sites.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Click &apos;+ Add site&apos; in the sidebar to create your first campsite.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Add at least one site to continue to the next step.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select a site from the sidebar or add a new one.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Dynamic section header */}
      <div className="pb-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">
              {siteLabel} <span className="mx-1">›</span>{" "}
              <span className="text-primary">{activeSection?.label}</span>
            </p>
            <h2 className="text-lg font-semibold text-primary leading-tight">
              {activeSection?.label}
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeSection?.description}
            </p>
          </div>
          <Button size="sm" onClick={handleSaveSite} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {isNewSite ? "Add Site" : "Save Site"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Basic information — always mounted, shown/hidden via class */}
      <div className={cn("space-y-4", currentSection === "basic_info" ? "block" : "hidden")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="site_number">Site Number *</Label>
            <Input
              id="site_number"
              {...register("site_number")}
              placeholder="A1, B2…"
              className="mt-1"
              disabled={!isNewSite && !!selectedSiteId}
            />
            {errors.site_number && (
              <p className="text-sm text-destructive dark:text-red-300 mt-1">{errors.site_number.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="site_name">Site Name</Label>
            <Input
              id="site_name"
              {...register("site_name")}
              placeholder="Lakeside Premium (optional)"
              className="mt-1"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="site_type">Site Type *</Label>
            <Select value={siteType} onValueChange={(v) => setValue("site_type", v as typeof siteType)}>
              <SelectTrigger id="site_type" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {siteTypeOptions.map((typeOption) => (
                  <SelectItem key={typeOption.value} value={typeOption.value}>
                    {typeOption.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="max_occupancy">Max Occupancy *</Label>
            <Input
              id="max_occupancy"
              type="number"
              min="1"
              {...register("max_occupancy")}
              className="mt-1"
            />
            {errors.max_occupancy && (
              <p className="text-sm text-destructive dark:text-red-300 mt-1">{errors.max_occupancy.message}</p>
            )}
          </div>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Describe this site…"
            rows={3}
            className="mt-1"
          />
        </div>
      </div>

      {/* Pricing */}
      <div className={cn("space-y-4", currentSection === "pricing" ? "block" : "hidden")}>
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

              const current = enabledReservationTypesOverride ?? []
              if (current.length === 0) {
                setValue("enabled_reservation_types_override", ["nightly"], { shouldDirty: true })
              }
              setValue("default_reservation_type", undefined, { shouldDirty: true })
              await trigger()
            }}
          >
            <SelectTrigger id="pricing_source">
              <SelectValue placeholder="Select pricing source" />
            </SelectTrigger>
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

              {(["nightly", "weekly", "monthly", "seasonal"] as const).map((type) => {
                const isEnabled = enabledReservationTypesOverride?.includes(type) || false
                return (
                  <div
                    key={type}
                    className={cn(
                      "p-4 border rounded-lg space-y-3",
                      isEnabled ? "border-primary/50 bg-primary/5" : ""
                    )}
                  >
                    <div className="flex items-center space-x-3">
                      <Checkbox
                        id={`res-type-${type}`}
                        checked={isEnabled}
                        onCheckedChange={() => {
                          const current = enabledReservationTypesOverride ?? []
                          const next = current.includes(type)
                            ? current.filter((t) => t !== type)
                            : [...current, type]
                          setValue(
                            "enabled_reservation_types_override",
                            next.length > 0 ? next : undefined,
                            { shouldDirty: true }
                          )
                        }}
                      />
                      <div className="flex-1">
                        <Label htmlFor={`res-type-${type}`} className="cursor-pointer font-medium">
                          {RESERVATION_TYPE_LABELS[type].title}
                        </Label>
                        <p className="text-xs text-muted-foreground">{RESERVATION_TYPE_LABELS[type].description}</p>
                      </div>
                    </div>

                    {isEnabled && type === "nightly" && (
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
                          {errors.base_price && <p className="text-xs text-destructive dark:text-red-300 mt-1">{errors.base_price.message}</p>}
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

                    {isEnabled && type === "weekly" && (
                      <div className="pt-2 pl-7 max-w-xs">
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
                    )}

                    {isEnabled && type === "monthly" && (
                      <div className="pt-2 pl-7 max-w-xs">
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
                    )}

                    {isEnabled && type === "seasonal" && (
                      <div className="pt-2 pl-7 max-w-xs">
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
                    )}
                  </div>
                )
              })}
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
                  onValueChange={(value) =>
                    setValue(
                      "default_reservation_type",
                      value === "__inherit__" ? undefined : (value as SiteFormData["default_reservation_type"]),
                      { shouldDirty: true }
                    )
                  }
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
                <p className="text-xs text-muted-foreground">Suggested reservation type when guests book this site</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Images */}
      <div className={cn("space-y-4", currentSection === "images" ? "block" : "hidden")}>
        {isNewSite ? (
          <p className="text-sm text-muted-foreground">
            Save the site first, then you can upload images.
          </p>
        ) : (
          <>
            <Dropzone
              {...siteImagesUpload}
              uploadedCount={siteImageUrls.length}
              className={cn(
                "h-40 flex flex-col overflow-hidden",
                siteImageUrls.length >= MAX_SITE_IMAGES && siteImagesUpload.files.length === 0
                  ? "opacity-60 pointer-events-none"
                  : ""
              )}
            >
              {siteImagesUpload.files.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <DropzoneEmptyState />
                </div>
              ) : (
                <div className="w-full h-full overflow-y-auto p-2">
                  <DropzoneContent layout="grid" className="mt-0" />
                </div>
              )}
            </Dropzone>

            {siteImageUrls.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {siteImageUrls.map((url) => {
                  const fileName = url.split("/").pop() ?? "Image"
                  return (
                    <div
                      key={url}
                      className="relative h-24 rounded-lg overflow-hidden bg-muted group"
                    >
                      <img
                        src={url}
                        alt={fileName}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeSiteImage(url)}
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded flex items-center justify-center bg-black/50 hover:bg-destructive/90 text-white transition"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hookups */}
      <div className={cn("space-y-4", currentSection === "hookups" ? "block" : "hidden")}>
        <div>
          <Label className="text-sm font-medium mb-3 block">Utility Hookups</Label>
          <div className="space-y-3">
            {(
              [
                { id: "hookup_water", field: "hookups.water" as const, label: "Water", checked: hookups?.water },
                { id: "hookup_electric", field: "hookups.electric" as const, label: "Electric", checked: hookups?.electric },
                { id: "hookup_sewer", field: "hookups.sewer" as const, label: "Sewer", checked: hookups?.sewer },
              ] as const
            ).map(({ id, field, label, checked }) => (
              <div key={id} className="flex items-center gap-2">
                <Checkbox
                  id={id}
                  checked={checked ?? false}
                  onCheckedChange={(c) => setValue(field, c as boolean)}
                />
                <Label htmlFor={id} className="font-normal cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>
        </div>
        <div>
          <Label className="text-sm font-medium mb-3 block">Amenities</Label>
          {amenitiesLoading ? (
            <div className="py-2 text-sm text-muted-foreground">Loading amenities...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {amenityOptions.map(({ key, label }) => {
                const id = `amenity_${key}`
                const checked = Boolean((amenities as Record<string, boolean> | undefined)?.[key])
                return (
                  <div key={id} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={(c) => setValue(`amenities.${key}` as any, c as boolean)}
                    />
                    <Label htmlFor={id} className="font-normal cursor-pointer">
                      {label}
                    </Label>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Pets & Accessibility */}
      <div className={cn("space-y-4", currentSection === "pets_accessibility" ? "block" : "hidden")}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="allow_pets"
              checked={allowPets ?? false}
              onCheckedChange={(c) => setValue("allow_pets", c as boolean)}
            />
            <Label htmlFor="allow_pets" className="font-medium cursor-pointer">
              Allow Pets
            </Label>
          </div>
          {allowPets && (
            <div className="max-w-xs">
              <Label htmlFor="pet_fee">Pet Fee (one-time)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
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
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ada_accessible"
              checked={adaAccessible ?? false}
              onCheckedChange={(c) => setValue("ada_accessible", c as boolean)}
            />
            <Label htmlFor="ada_accessible" className="font-medium cursor-pointer">
              ADA Accessible
            </Label>
          </div>
          {adaAccessible && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 ml-2">
              {(
                [
                  { id: "accessibility_wheelchair", field: "accessibility_features.wheelchair_accessible" as const, label: "Wheelchair Accessible", checked: accessibilityFeatures?.wheelchair_accessible },
                  { id: "accessibility_wide_paths", field: "accessibility_features.wide_paths" as const, label: "Wide Paths", checked: accessibilityFeatures?.wide_paths },
                  { id: "accessibility_table", field: "accessibility_features.accessible_table" as const, label: "Accessible Table", checked: accessibilityFeatures?.accessible_table },
                  { id: "accessibility_restroom", field: "accessibility_features.accessible_restroom" as const, label: "Accessible Restroom", checked: accessibilityFeatures?.accessible_restroom },
                  { id: "accessibility_handrails", field: "accessibility_features.handrails" as const, label: "Handrails", checked: accessibilityFeatures?.handrails },
                  { id: "accessibility_level_ground", field: "accessibility_features.level_ground" as const, label: "Level Ground", checked: accessibilityFeatures?.level_ground },
                ] as const
              ).map(({ id, field, label, checked }) => (
                <div key={id} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={checked ?? false}
                    onCheckedChange={(c) => setValue(field, c as boolean)}
                  />
                  <Label htmlFor={id} className="font-normal cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Blackout dates */}
      <div className={cn("space-y-4", currentSection === "blackout_dates" ? "block" : "hidden")}>
        <BlackoutDatesPicker
          variant="dashboard"
          label="Blackout dates"
          value={blackoutDates}
          onChange={setBlackoutDates}
          numberOfMonths={1}
        />
        {blackoutDates.length > 0 ? (
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
        ) : (
          <p className="text-sm text-muted-foreground">No blackout dates configured for this site.</p>
        )}
      </div>
    </div>
  )
}

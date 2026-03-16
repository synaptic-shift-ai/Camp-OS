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
import { Switch } from "@/components/ui/switch"
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
import { useSupabaseUpload } from "@/hooks/use-supabase-upload"
import { createClient } from "@/lib/supabase/client"

// ─── Types ────────────────────────────────────────────────────────────────────

type SiteSection = "basic_info" | "pricing" | "images" | "hookups"

const SITE_SECTIONS: Array<{ id: SiteSection; label: string; description: string }> = [
  { id: "basic_info", label: "Basic information", description: "Site identification, type, and capacity" },
  { id: "pricing", label: "Pricing & reservation", description: "Configure pricing for this site" },
  { id: "images", label: "Images", description: "Upload photos of this campsite" },
  { id: "hookups", label: "Hookups & amenities", description: "Utilities, hookups, and site features" },
]

const SITE_IMAGES_BUCKET = "site-property-images"
const MAX_SITE_IMAGES = 1
const MAX_SITE_IMAGE_SIZE_BYTES = 5 * 1024 * 1024

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
  propertyDefaultsNightlyRate: number | null
  form: UseFormReturn<SiteFormData>
  siteImageUrls: string[]
  siteImagesUpload: ReturnType<typeof useSupabaseUpload>
  setSiteImageUrls: React.Dispatch<React.SetStateAction<string[]>>
  completedSections: Record<string, Set<SiteSection>>
  setSelectedSiteId: (id: string) => void
  toggleExpandSite: (id: string) => void
  setCurrentSection: (s: SiteSection) => void
  handleAddSite: () => void
  handleSaveSite: () => void
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
  const [completedSections, setCompletedSections] = useState<Record<string, Set<SiteSection>>>({})
  const [siteImageUrls, setSiteImageUrls] = useState<string[]>([])

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
      setSelectedSiteIdRaw(site.id)
      setIsNewSite(false)
      setCurrentSection("basic_info")
      form.reset(fromApiFormat(site) as SiteFormData)
      const imgs = (site.site_images ?? site.images) as string[] | undefined
      setSiteImageUrls(Array.isArray(imgs) ? [...imgs] : [])
    },
    [form]
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
    if (isActive) {
      hasInitializedRef.current = false
      fetchSites()
      fetchPropertyDefaults()
    }
  }, [isActive, fetchSites, fetchPropertyDefaults])

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
    setSelectedSiteIdRaw(null)
    setIsNewSite(true)
    setCurrentSection("basic_info")
    form.reset(DEFAULT_SITE_FORM_VALUES)
    setSiteImageUrls([])
  }, [form])

  const handleSaveSite = useCallback(async () => {
    if (!property) return
    const isValid = await form.trigger()
    if (!isValid) return
    const data = form.getValues()
    try {
      setSaving(true)
      const payload = {
        ...toApiFormat(data),
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
      })
      setNoSiteError(null)
      onSiteConfirmed?.(property.id)
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
        toast({ title: "Site deleted", description: "The site has been removed." })
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

    // Block if there's an unsaved new site with data entered
    if (isNewSite && form.getValues("site_number")?.trim()) {
      setNoSiteError("Please save the current site before continuing.")
      return false
    }

    // Block if no sites have been saved yet
    if (sitesRef.current.length === 0) {
      setNoSiteError(
        `"${property?.name}" has no sites yet. Please add at least one campsite.`
      )
      return false
    }

    setNoSiteError(null)
    return true
  }, [property?.name, form, isNewSite])

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
    propertyDefaultsNightlyRate,
    form,
    siteImageUrls,
    siteImagesUpload,
    setSiteImageUrls,
    completedSections,
    setSelectedSiteId,
    toggleExpandSite,
    setCurrentSection,
    handleAddSite,
    handleSaveSite,
    handleDeleteSite,
    removeSiteImage,
  }

  return { contextValue, canAdvance }
}

// ─── Sidebar tree component ───────────────────────────────────────────────────

export function SitesSidebarTree() {
  const {
    sites,
    selectedSiteId,
    isNewSite,
    expandedSites,
    currentSection,
    loading,
    toggleExpandSite,
    setCurrentSection,
    setSelectedSiteId,
    handleAddSite,
    handleDeleteSite,
    form,
  } = useSitesPanelContext()

  const [siteToDelete, setSiteToDelete] = useState<SiteData | null>(null)
  const [deleting, setDeleting] = useState(false)

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
          {isNewSite && (
            <div>
              <div className="w-full flex items-center gap-2 pl-4 pr-3 py-2 text-sm text-primary font-medium bg-muted border-l-[3px] border-primary">
                <span className="h-2 w-2 rounded-full flex-shrink-0 bg-amber-400" />
                <span className="flex-1 truncate">
                  {newSiteNumber?.trim() || <span className="italic opacity-70">New site</span>}
                </span>
              </div>
              {SITE_SECTIONS.map((section) => {
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
    noSiteError,
    isNewSite,
    selectedSiteId,
    propertyDefaultsNightlyRate,
    siteImageUrls,
    setSiteImageUrls,
    siteImagesUpload,
    removeSiteImage,
    sites,
  } = useSitesPanelContext()

  const { register, watch, setValue, formState: { errors } } = form
  const siteType = watch("site_type")
  const hookups = watch("hookups")
  const usePropertyDefaults = watch("use_property_reservation_types")
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
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Tent className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-base font-semibold mb-1">No site selected</h3>
        <p className="text-sm text-muted-foreground">
          {sites.length === 0
            ? "Click '+ Add site' in the sidebar to create your first campsite."
            : "Select a site from the sidebar or add a new one."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Dynamic section header */}
      <div className="pb-4 border-b border-border">
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

      {noSiteError && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{noSiteError}</span>
        </div>
      )}

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
              <p className="text-sm text-destructive mt-1">{errors.site_number.message}</p>
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
                {["tent", "rv", "cabin", "glamping", "yurt", "other"].map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
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
              <p className="text-sm text-destructive mt-1">{errors.max_occupancy.message}</p>
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
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <Label className="font-medium">Use Property Defaults</Label>
            <p className="text-sm text-muted-foreground mt-0.5">
              Inherit pricing from property settings
              {propertyDefaultsNightlyRate
                ? ` ($${(propertyDefaultsNightlyRate / 100).toFixed(2)}/night)`
                : ""}
            </p>
          </div>
          <Switch
            checked={usePropertyDefaults}
            onCheckedChange={(v) => setValue("use_property_reservation_types", v)}
          />
        </div>
        {!usePropertyDefaults && (
          <div>
            <Label htmlFor="base_price">Nightly Rate *</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                $
              </span>
              <Input
                id="base_price"
                type="number"
                step="0.01"
                min="0"
                className="pl-7"
                {...register("base_price", { valueAsNumber: true })}
                placeholder="45.00"
              />
            </div>
            {errors.base_price && (
              <p className="text-sm text-destructive mt-1">{errors.base_price.message}</p>
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
      </div>
    </div>
  )
}

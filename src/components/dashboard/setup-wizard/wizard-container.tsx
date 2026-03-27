"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronDown, Eye, Loader2, Menu, Rocket } from "lucide-react"
import { cn } from "@/lib/utils"
import { useProperty } from "@/components/property-context"
import { WIZARD_STEPS, type WizardStep } from "./wizard-progress-bar"
import { useWizardFormStore, type PropertyDetailsDraft } from "./wizard-form-store"
import { Button } from "@/components/ui/button"
import {
  useSitesPanelState,
  SitesPanelContext,
  SitesSidebarTree,
  SitesPanelContent,
} from "./wizard-sites-panel"
import { StripeConnectStep } from "./stripe-connect-step"
import { ReviewLaunchStep } from "./review-launch-step"
import { WizardPropertyDetailsSections } from "./wizard-property-details-sections"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type PropertySection =
  | "location"
  | "images"
  | "operating_hours"
  | "booking_rules"
  | "property_amenities"
  | "taxes"
  | "additional_charges"
  | "rate_types"
  | "site_types_rates"
  | "deposits"
  | "terms_policies"
  | "discounts"

const PROPERTY_SECTIONS: Array<{ id: PropertySection; label: string }> = [
  { id: "location", label: "Location" },
  { id: "images", label: "Images" },
  { id: "operating_hours", label: "Operating hours" },
  { id: "booking_rules", label: "Booking rules" },
  { id: "property_amenities", label: "Property amenities" },
  { id: "taxes", label: "Taxes" },
  { id: "additional_charges", label: "Additional charges" },
  { id: "rate_types", label: "Rate types" },
  { id: "site_types_rates", label: "Site types rates" },
  { id: "deposits", label: "Deposits" },
  { id: "terms_policies", label: "Terms & policies" },
  { id: "discounts", label: "Discounts" },
]

const STEP_SECTION_MAP: Record<WizardStep, Array<{ id: string; label: string }>> = {
  property_details: PROPERTY_SECTIONS,
  sites_setup: [{ id: "sites", label: "Sites" }],
  stripe_connect: [{ id: "payment", label: "Payment" }],
  review_launch: [{ id: "review", label: "Review" }],
}

const US_TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Phoenix", label: "Mountain Time - Arizona (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
]

const propertyDetailsSchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(2, "State is required"),
  zipCode: z.string().min(5, "ZIP code is required"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().min(10, "Phone number is required").optional().or(z.literal("")),
  description: z.string().optional(),
  timezone: z.string().default("America/New_York"),
  checkInTime: z.string().default("15:00"),
  checkOutTime: z.string().default("11:00"),
  termsAndConditions: z.string().optional(),
  cancellationPolicy: z.string().optional(),
  customRules: z.string().optional(),
  minStayNights: z.coerce.number().int().min(1).default(1),
  maxStayNights: z.coerce.number().int().min(1).optional().or(z.literal("")),
  bookingLeadTimeDays: z.coerce.number().int().min(0).default(365),
})

type PropertyDetailsFormData = z.infer<typeof propertyDetailsSchema>

interface WizardContainerProps {
  initialPropertyId?: string | null
  initialStep?: WizardStep | "dashboard_tour" | null
}

type PropertySettingsConfig = {
  propertyId: string
  pricing_config: Record<string, unknown> | null
  reservation_type_config: unknown
  enabled_reservation_types: unknown
  site_type_config: { allowed_site_types?: string[]; site_type_rates?: Record<string, unknown> } | null
  deposit_config: Record<string, unknown> | null
  rate_discounts_config: Record<string, unknown> | null
}

export function WizardContainer({ initialPropertyId, initialStep }: WizardContainerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    properties,
    selectedProperty,
    selectedPropertyId,
    selectProperty,
    incompleteProperties,
    refreshProperties,
    isLoading,
  } = useProperty()

  const stepFromUrl = searchParams.get("step") as WizardStep | null
  const normalizedInitialStep = initialStep === "dashboard_tour" ? "stripe_connect" : initialStep
  const validStepFromUrl = stepFromUrl && WIZARD_STEPS.some((s) => s.id === stepFromUrl) ? stepFromUrl : null
  const validInitialStep =
    normalizedInitialStep && WIZARD_STEPS.some((s) => s.id === normalizedInitialStep)
      ? normalizedInitialStep
      : null

  const [currentStep, setCurrentStep] = useState<WizardStep>(
    validStepFromUrl || validInitialStep || "property_details"
  )
  const [currentSection, setCurrentSection] = useState<string>("location")
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set())
  const [workingPropertyId, setWorkingPropertyId] = useState<string | null>(initialPropertyId ?? null)
  const [isCompleting, setIsCompleting] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [footerError, setFooterError] = useState<string | null>(null)
  const [footerIssueKind, setFooterIssueKind] = useState<"unsaved" | "error" | null>(null)
  const [footerIssueDetails, setFooterIssueDetails] = useState<string[]>([])
  const [showFooterIssueDetails, setShowFooterIssueDetails] = useState(false)
  const [propertySiteConfirmed, setPropertySiteConfirmed] = useState<Set<string>>(() => new Set())
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [reviewLaunchReady, setReviewLaunchReady] = useState(false)
  const [propertySettingsConfig, setPropertySettingsConfig] = useState<PropertySettingsConfig | null>(null)
  const mobileNavSelectionRef = useRef({ section: "location", propertyId: selectedPropertyId })
  const desktopPropertyDropdownRef = useRef<HTMLDivElement | null>(null)
  const mobilePropertyDropdownRef = useRef<HTMLDivElement | null>(null)

  const stepInitializedRef = useRef(false)

  // Close mobile sheet when user selects a different section or property
  useEffect(() => {
    if (!mobileNavOpen) return
    const prev = mobileNavSelectionRef.current
    if (prev.section !== currentSection || prev.propertyId !== selectedPropertyId) {
      mobileNavSelectionRef.current = { section: currentSection, propertyId: selectedPropertyId ?? "" }
      setMobileNavOpen(false)
    }
  }, [mobileNavOpen, currentSection, selectedPropertyId])

  useEffect(() => {
    if (!showPropertyDropdown) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return

      const inDesktop = desktopPropertyDropdownRef.current?.contains(target) ?? false
      const inMobile = mobilePropertyDropdownRef.current?.contains(target) ?? false
      if (!inDesktop && !inMobile) {
        setShowPropertyDropdown(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowPropertyDropdown(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleEscape)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [showPropertyDropdown])

  const openMobileNav = useCallback(() => {
    mobileNavSelectionRef.current = { section: currentSection, propertyId: selectedPropertyId ?? "" }
    setMobileNavOpen(true)
  }, [currentSection, selectedPropertyId])

  const handleSiteConfirmed = useCallback((propertyId: string) => {
    setPropertySiteConfirmed((prev) => new Set(prev).add(propertyId))
  }, [])

  const { contextValue: sitesPanelContext, canAdvance: sitesPanelCanAdvance } =
    useSitesPanelState({
      property: selectedProperty ?? null,
      isActive: currentStep === "sites_setup",
      onSiteConfirmed: handleSiteConfirmed,
    })
  const initialSelectionDoneRef = useRef(false)

  const sortedIncompleteProperties = [...incompleteProperties].sort((a, b) => {
    const aTime = (a as { createdAt?: string }).createdAt
      ? new Date((a as { createdAt: string }).createdAt).getTime()
      : null
    const bTime = (b as { createdAt?: string }).createdAt
      ? new Date((b as { createdAt: string }).createdAt).getTime()
      : null
    if (aTime !== null && bTime !== null) return aTime - bTime
    return (a.name ?? "").localeCompare(b.name ?? "")
  })

  const { saveDraft, getDraft, clearDraft, drafts: allPropertyDrafts } = useWizardFormStore()
  const currentPropertyDraft = selectedProperty ? allPropertyDrafts[selectedProperty.id] : undefined

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    setValue,
    watch,
    reset,
    getValues,
    setError,
    clearErrors,
  } = useForm<PropertyDetailsFormData>({
    resolver: zodResolver(propertyDetailsSchema),
    defaultValues: {
      address: "",
      city: "",
      state: "",
      zipCode: "",
      email: "",
      phone: "",
      description: "",
      timezone: "America/New_York",
      checkInTime: "15:00",
      checkOutTime: "11:00",
      termsAndConditions: "",
      cancellationPolicy: "",
      customRules: "",
      minStayNights: 1,
      maxStayNights: "",
      bookingLeadTimeDays: 365,
    },
  })

  const timezone = watch("timezone")

  useEffect(() => {
    if (!selectedProperty) return
    const draft = getDraft(selectedProperty.id)
    reset({
      address: draft?.address ?? selectedProperty.address ?? "",
      city: draft?.city ?? selectedProperty.city ?? "",
      state: draft?.state ?? selectedProperty.state ?? "",
      zipCode: draft?.zipCode ?? selectedProperty.zipCode ?? "",
      email: draft?.email ?? selectedProperty.email ?? "",
      phone: draft?.phone ?? selectedProperty.phone ?? "",
      description: draft?.description ?? selectedProperty.description ?? "",
      timezone: draft?.timezone ?? selectedProperty.settings?.timezone ?? "America/New_York",
      checkInTime: draft?.checkInTime ?? selectedProperty.settings?.checkInTime ?? "15:00",
      checkOutTime: draft?.checkOutTime ?? selectedProperty.settings?.checkOutTime ?? "11:00",
      termsAndConditions: draft?.termsAndConditions ?? ((selectedProperty as unknown as Record<string, unknown>).terms_and_conditions as string | null) ?? "",
      cancellationPolicy: draft?.cancellationPolicy ?? selectedProperty.settings?.cancellationPolicy ?? "",
      customRules: draft?.customRules ?? selectedProperty.settings?.customRules ?? "",
      minStayNights: draft?.minStayNights ?? selectedProperty.settings?.minStayNights ?? 1,
      maxStayNights: draft?.maxStayNights ?? selectedProperty.settings?.maxStayNights ?? "",
      bookingLeadTimeDays: draft?.bookingLeadTimeDays ?? selectedProperty.settings?.bookingLeadTimeDays ?? 365,
    })
  }, [selectedProperty?.id, reset, getDraft])

  useEffect(() => {
    if (!selectedProperty) {
      setPropertySettingsConfig(null)
      return
    }

    const propertyId = selectedProperty.id
    setPropertySettingsConfig(null)

    let cancelled = false

    const loadPropertySettings = async () => {
      try {
        const response = await fetch(`/api/properties/${propertyId}/settings`)
        if (!response.ok) return
        const result = (await response.json()) as { property?: Record<string, unknown> }
        const property = result.property
        if (cancelled || !property) return

        setPropertySettingsConfig({
          propertyId,
          pricing_config: (property.pricing_config ?? null) as Record<string, unknown> | null,
          reservation_type_config: property.reservation_type_config ?? null,
          enabled_reservation_types: property.enabled_reservation_types ?? null,
          site_type_config: (property.site_type_config ?? null) as
            | { allowed_site_types?: string[]; site_type_rates?: Record<string, unknown> }
            | null,
          deposit_config: (property.deposit_config ?? null) as Record<string, unknown> | null,
          rate_discounts_config: (property.rate_discounts_config ?? null) as Record<string, unknown> | null,
        })
      } catch (error) {
        console.error("Failed to load property settings:", error)
      }
    }

    loadPropertySettings()

    return () => {
      cancelled = true
    }
  }, [selectedProperty?.id])

  // Eagerly fetch site counts for ALL incomplete properties so the Sites step
  // warning is accurate without requiring each property to be manually selected first.
  useEffect(() => {
    if (incompleteProperties.length === 0) return

    // First pass: use whatever count is already on the object (avoids redundant fetches
    // when the API happens to include siteCount).
    setPropertySiteConfirmed((prev) => {
      const next = new Set(prev)
      incompleteProperties.forEach((p) => {
        const count =
          (p as { siteCount?: number }).siteCount ??
          (p as { totalSites?: number }).totalSites ??
          0
        if (count > 0) next.add(p.id)
      })
      return next
    })

    // Second pass: for properties where count was 0 / unknown, fetch from API.
    let cancelled = false

    const fetchCounts = async () => {
      const toCheck = incompleteProperties.filter((p) => {
        const count =
          (p as { siteCount?: number }).siteCount ??
          (p as { totalSites?: number }).totalSites ??
          0
        return count === 0
      })

      await Promise.all(
        toCheck.map(async (p) => {
          try {
            const res = await fetch(`/api/v1/properties/${p.id}/sites?per_page=1`)
            if (cancelled) return
            if (!res.ok) return
            const result = await res.json()
            const total: number =
              result.data?.pagination?.total ??
              result.data?.total ??
              (Array.isArray(result.data?.items) ? result.data.items.length : 0) ??
              0
            if (total > 0) {
              setPropertySiteConfirmed((prev) => new Set([...prev, p.id]))
            }
          } catch {
            // ignore — warning will just remain visible for now
          }
        })
      )
    }

    fetchCounts()

    return () => {
      cancelled = true
    }
  }, [incompleteProperties])

  useEffect(() => {
    if (initialSelectionDoneRef.current) return
    if (selectedPropertyId) {
      initialSelectionDoneRef.current = true
      return
    }
    if (initialPropertyId) {
      selectProperty(initialPropertyId)
      setWorkingPropertyId(initialPropertyId)
      initialSelectionDoneRef.current = true
    } else if (incompleteProperties.length > 0) {
      const firstIncomplete = sortedIncompleteProperties[0]
      if (firstIncomplete) {
        selectProperty(firstIncomplete.id)
        setWorkingPropertyId(firstIncomplete.id)
        initialSelectionDoneRef.current = true
      }
    }
  }, [
    initialPropertyId,
    incompleteProperties,
    sortedIncompleteProperties,
    selectedPropertyId,
    selectProperty,
  ])

  useEffect(() => {
    if (!selectedProperty) return
    const progress = selectedProperty.wizard_progress ?? {}
    const backendCompleted = new Set<WizardStep>()
    Object.entries(progress).forEach(([step, isComplete]) => {
      if (isComplete) backendCompleted.add(step as WizardStep)
    })
    setCompletedSteps((prev) => {
      const merged = new Set(prev)
      backendCompleted.forEach((s) => merged.add(s))
      return merged
    })
    if (stepInitializedRef.current) return
    stepInitializedRef.current = true
    if (validStepFromUrl) { setCurrentStep(validStepFromUrl); return }
    if (validInitialStep) { setCurrentStep(validInitialStep); return }
    const firstIncomplete = WIZARD_STEPS.find((step) => !backendCompleted.has(step.id))
    if (firstIncomplete) {
      setCurrentStep(firstIncomplete.id)
    } else if (backendCompleted.size > 0) {
      const lastStep = WIZARD_STEPS[WIZARD_STEPS.length - 1]
      if (lastStep) setCurrentStep(lastStep.id)
    }
  }, [selectedProperty, validStepFromUrl, validInitialStep])

  useEffect(() => {
    const sections = STEP_SECTION_MAP[currentStep]
    if (sections.length > 0 && sections[0]) {
      setCurrentSection(sections[0].id)
    }
    setFooterError(null)
    setFooterIssueKind(null)
    setFooterIssueDetails([])
    setShowFooterIssueDetails(false)
  }, [currentStep])

  useEffect(() => {
    if (currentStep !== "sites_setup") return

    const unsavedDraftPropertyIds = sitesPanelContext.getUnsavedDraftPropertyIds()
    if (unsavedDraftPropertyIds.length === 0) {
      if (footerIssueKind === "unsaved") {
        setFooterError(null)
        setFooterIssueKind(null)
        setFooterIssueDetails([])
        setShowFooterIssueDetails(false)
      }
      return
    }

    const detail = "Property: Save or remove the draft site before continuing."

    const alreadyShowingSameUnsavedIssue =
      footerIssueKind === "unsaved" &&
      footerError === "You have unsaved changes." &&
      footerIssueDetails.length === 1 &&
      footerIssueDetails[0] === detail

    if (alreadyShowingSameUnsavedIssue) return

    setFooterError("You have unsaved changes.")
    setFooterIssueKind("unsaved")
    setFooterIssueDetails([detail])
    setShowFooterIssueDetails(false)
  }, [currentStep, sitesPanelContext, properties, footerIssueKind, footerError, footerIssueDetails])

  useEffect(() => {
    if (currentStep !== "property_details" || !selectedProperty) return;

    const hasPropertyDraft = Boolean(
      currentPropertyDraft &&
      Object.values(currentPropertyDraft).some((value) => value !== undefined)
    );
    const hasUnsavedPropertyChanges = isDirty || hasPropertyDraft;
    const propertyName = selectedProperty.name?.trim() || "Unnamed property";
    const detail = `${propertyName}: Save & Next to keep your latest property changes.`;

    if (!hasUnsavedPropertyChanges) {
      const isShowingThisPropertyUnsaved =
        footerIssueKind === "unsaved" &&
        footerError === "You have unsaved changes." &&
        footerIssueDetails.length === 1 &&
        footerIssueDetails[0] === detail;

      if (isShowingThisPropertyUnsaved) {
        setFooterError(null);
        setFooterIssueKind(null);
        setFooterIssueDetails([]);
        setShowFooterIssueDetails(false);
      }
      return;
    }

    const alreadyShowingSameUnsavedIssue =
      footerIssueKind === "unsaved" &&
      footerError === "You have unsaved changes." &&
      footerIssueDetails.length === 1 &&
      footerIssueDetails[0] === detail;

    if (alreadyShowingSameUnsavedIssue) return;

    setFooterError("You have unsaved changes.");
    setFooterIssueKind("unsaved");
    setFooterIssueDetails([detail]);
    setShowFooterIssueDetails(false);
  }, [
    currentStep,
    selectedProperty?.id,
    isDirty,
    currentPropertyDraft,
    footerIssueKind,
    footerError,
    footerIssueDetails,
  ]);

  useEffect(() => {
    const hasAnyPropertyDraft = Object.values(allPropertyDrafts).some(
      (draft) => draft && Object.values(draft).some((value) => value !== undefined)
    )
    const hasUnsavedSiteDrafts = sitesPanelContext.getUnsavedDraftPropertyIds().length > 0
    const hasUnsavedChanges = hasAnyPropertyDraft || hasUnsavedSiteDrafts

    if (!hasUnsavedChanges) return

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      // Required by some browsers to trigger the native confirmation dialog.
      event.returnValue = ""
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload)
    }
  }, [allPropertyDrafts, sitesPanelContext])

  const savePropertyDetails = useCallback(
    async (data: PropertyDetailsFormData): Promise<boolean> => {
      if (!selectedProperty) return false
      try {
        // Read draft INSIDE the function, at save time (not at render time)
        const propertyDraft = getDraft(selectedProperty.id) as PropertyDetailsDraft | undefined
        setIsSaving(true)
        setFooterError(null)

        // 1. Save core property fields
        const response = await fetch(`/api/v1/properties/${selectedProperty.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            address: data.address,
            city: data.city,
            state: data.state,
            zipCode: data.zipCode,
            email: data.email || null,
            phone: data.phone || null,
            description: data.description || null,
            amenities: propertyDraft?.amenities,
            settings: {
              timezone: data.timezone,
              checkInTime: data.checkInTime,
              checkOutTime: data.checkOutTime,
              cancellationPolicy: data.cancellationPolicy || null,
              customRules: data.customRules || null,
              minStayNights: data.minStayNights || 1,
              maxStayNights: data.maxStayNights || null,
              bookingLeadTimeDays: data.bookingLeadTimeDays ?? 365,
            },
            terms_and_conditions: data.termsAndConditions || null,
          }),
        })
        const result = await response.json()
        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || "Failed to save property details")
        }

        // 2. Save settings: merge draft over server config for THIS property only.
        // Never send explicit nulls — updatePropertyConfigSchema uses .optional() and Zod rejects null.
        // After switching properties, baseline may be unloaded briefly; only include keys we have data for.
        const baseline =
          propertySettingsConfig?.propertyId === selectedProperty.id ? propertySettingsConfig : null

        const settingsPayload: Record<string, unknown> = {}
        const putIfValue = (key: string, draftVal: unknown, baselineVal: unknown) => {
          const v = draftVal !== undefined ? draftVal : baselineVal
          if (v !== undefined && v !== null) {
            settingsPayload[key] = v
          }
        }

        putIfValue("pricing_config", propertyDraft?.pricingConfig, baseline?.pricing_config)
        putIfValue("reservation_type_config", propertyDraft?.reservationTypeConfig, baseline?.reservation_type_config)
        putIfValue("enabled_reservation_types", propertyDraft?.enabledReservationTypes, baseline?.enabled_reservation_types)
        putIfValue("site_type_config", propertyDraft?.siteTypeConfig, baseline?.site_type_config)
        putIfValue("deposit_config", propertyDraft?.depositConfig, baseline?.deposit_config)
        putIfValue("rate_discounts_config", propertyDraft?.rateDiscountsConfig, baseline?.rate_discounts_config)

        const hasAnySettings = Object.keys(settingsPayload).length > 0
        if (hasAnySettings) {
          const settingsResponse = await fetch(`/api/properties/${selectedProperty.id}/settings`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(settingsPayload),
          })

          if (!settingsResponse.ok) {
            throw new Error("Failed to save property settings")
          }

          const settingsResult = (await settingsResponse.json()) as {
            property?: Record<string, unknown>
          }
          if (settingsResult.property) {
            const property = settingsResult.property
            setPropertySettingsConfig({
              propertyId: selectedProperty.id,
              pricing_config: (property.pricing_config ?? null) as Record<string, unknown> | null,
              reservation_type_config: property.reservation_type_config ?? null,
              enabled_reservation_types: property.enabled_reservation_types ?? null,
              site_type_config: (property.site_type_config ?? null) as
                | { allowed_site_types?: string[]; site_type_rates?: Record<string, unknown> }
                | null,
              deposit_config: (property.deposit_config ?? null) as Record<string, unknown> | null,
              rate_discounts_config: (property.rate_discounts_config ?? null) as Record<string, unknown> | null,
            })
          }
        }

        await refreshProperties()
        clearDraft(selectedProperty.id)
        return true
      } catch (err) {
        setFooterError(err instanceof Error ? err.message : "Failed to save property details")
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [selectedProperty, refreshProperties, clearDraft, getDraft, propertySettingsConfig]
  )

  const handleWizardComplete = useCallback(async () => {
    if (properties.length === 0) return
    try {
      setIsCompleting(true)
      const toComplete = properties.filter((p) => !p.onboardingCompleted)
      for (const property of toComplete) {
        const response = await fetch(`/api/v1/properties/${property.id}/complete-onboarding`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error?.message ?? "Failed to complete onboarding")
        }
      }
      try {
        await fetch("/api/onboarding/company-progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingStep: "completed", onboardingCompleted: true }),
        })
      } catch (err) {
        console.error("Failed to save company onboarding complete:", err)
      }
      const firstProperty = [...properties].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )[0]
      router.push(
        firstProperty
          ? `/dashboard/${firstProperty.id}?setup=complete&quick_tour=1`
          : "/dashboard?setup=complete&quick_tour=1"
      )
      refreshProperties()
    } catch (error) {
      console.error("Failed to complete wizard:", error)
      setIsCompleting(false)
    }
  }, [properties, router, refreshProperties])

  const advanceStep = useCallback(async () => {
    const newCompleted = new Set(completedSteps)
    newCompleted.add(currentStep)
    setCompletedSteps(newCompleted)
    if (selectedProperty) {
      try {
        await fetch(`/api/v1/properties/${selectedProperty.id}/wizard-progress`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ step: currentStep, completed: true }),
        })
      } catch (error) {
        console.error("Failed to save wizard progress:", error)
      }
    }
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
    const nextStepId =
      currentIndex >= 0 && currentIndex < WIZARD_STEPS.length - 1
        ? WIZARD_STEPS[currentIndex + 1]?.id
        : null
    if (nextStepId) {
      try {
        await fetch("/api/onboarding/company-progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingStep: nextStepId }),
        })
      } catch (error) {
        console.error("Failed to save company onboarding step:", error)
      }
    }
    if (currentIndex < WIZARD_STEPS.length - 1) {
      const nextStep = WIZARD_STEPS[currentIndex + 1]
      if (nextStep) setCurrentStep(nextStep.id)
    } else {
      await handleWizardComplete()
    }
  }, [currentStep, completedSteps, selectedProperty, handleWizardComplete])

  const handleSaveAndNext = useCallback(async () => {
    if (currentStep === "property_details") {
      // Check every incomplete property, not just the currently loaded one
      const propertiesToCheck =
        sortedIncompleteProperties.length > 0
          ? sortedIncompleteProperties
          : selectedProperty
            ? [selectedProperty]
            : []

      const propertiesMissingFields: Array<{ id: string; name: string; missingFields: string[] }> = []

      const formatFieldList = (fields: string[]): string => {
        if (fields.length === 1) return fields[0]!
        if (fields.length === 2) return `${fields[0]!} and ${fields[1]!}`
        return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]!}`
      }

      for (const property of propertiesToCheck) {
        const missingFields: string[] = []
        if (property.id === selectedPropertyId) {
          const v = getValues()
          if (!v.address?.trim()) missingFields.push("Street Address")
          if (!v.city?.trim()) missingFields.push("City")
          if (!v.state?.trim()) missingFields.push("State")
          if (!v.zipCode || v.zipCode.trim().length < 5) missingFields.push("ZIP")
        } else {
          const draft = getDraft(property.id)
          const address = draft?.address ?? property.address
          const city = draft?.city ?? property.city
          const state = draft?.state ?? property.state
          const zipCode = draft?.zipCode ?? property.zipCode
          if (!address?.trim()) missingFields.push("Street Address")
          if (!city?.trim()) missingFields.push("City")
          if (!state?.trim()) missingFields.push("State")
          if (!zipCode || zipCode.trim().length < 5) missingFields.push("ZIP")
        }
        if (missingFields.length > 0) {
          propertiesMissingFields.push({
            id: property.id,
            name: property.name ?? "Unnamed property",
            missingFields,
          })
        }
      }

      if (propertiesMissingFields.length > 0) {
        // Set inline field errors for whichever property is currently loaded
        const currentHasError = propertiesMissingFields.some((p) => p.id === selectedPropertyId)
        if (currentHasError) {
          const v = getValues()
          if (!v.address?.trim()) setError("address", { type: "manual", message: "Address is required" })
          if (!v.city?.trim()) setError("city", { type: "manual", message: "City is required" })
          if (!v.state?.trim()) setError("state", { type: "manual", message: "State is required" })
          if (!v.zipCode || v.zipCode.trim().length < 5) setError("zipCode", { type: "manual", message: "ZIP code is required" })
          setCurrentSection("location")
        }
        setFooterError(null)
        setFooterIssueKind("error")
        setFooterIssueDetails(
          propertiesMissingFields.map(
            (p) =>
              `${p.name}: ${formatFieldList(p.missingFields)} ${p.missingFields.length === 1 ? "is" : "are"} required`
          )
        )
        setShowFooterIssueDetails(false)
        return
      }

      clearErrors(["address", "city", "state", "zipCode"])
      setFooterError(null)
      setFooterIssueKind(null)
      setFooterIssueDetails([])
      setShowFooterIssueDetails(false)
      const formData = await new Promise<PropertyDetailsFormData | null>((resolve) => {
        handleSubmit(
          (data) => resolve(data),
          () => resolve(null)
        )()
      })
      if (!formData) return
      const saved = await savePropertyDetails(formData)
      if (!saved) return
      await advanceStep()
      return
    }

    if (currentStep === "sites_setup") {
      setFooterError(null)
      setFooterIssueKind(null)
      setFooterIssueDetails([])
      setShowFooterIssueDetails(false)
      const currentOk = await sitesPanelCanAdvance()
      const unsavedDraftPropertyIds = sitesPanelContext.getUnsavedDraftPropertyIds()
      if (unsavedDraftPropertyIds.length > 0) {
        setFooterError("You have unsaved changes.")
        setFooterIssueKind("unsaved")
        setFooterIssueDetails([
          "Property: Save or remove the draft site before continuing.",
        ])
        setShowFooterIssueDetails(false)
        return
      }

      const propertiesWithoutSites = sortedIncompleteProperties.filter((p) => {
        if (p.id === selectedProperty?.id) {
          return sitesPanelContext.sites.length === 0
        }
        return !propertySiteConfirmed.has(p.id)
      })

      if (propertiesWithoutSites.length > 0) {
        const names = propertiesWithoutSites.map((p) => `"${p.name}"`).join(", ")
        setFooterError(`${propertiesWithoutSites.length} error${propertiesWithoutSites.length === 1 ? "" : "s"} to fix`)
        setFooterIssueKind("error")
        setFooterIssueDetails([
          `Property error: ${names}. Needed action: Add at least one site to each property.`,
        ])
        setShowFooterIssueDetails(false)
        return
      }

      if (!currentOk) {
        setFooterError("You have unsaved changes.")
        setFooterIssueKind("unsaved")
        setFooterIssueDetails(["Property: Save or remove the draft site before continuing."])
        setShowFooterIssueDetails(false)
        return
      }
      setFooterError(null)
      setFooterIssueKind(null)
      setFooterIssueDetails([])
      setShowFooterIssueDetails(false)
      await advanceStep()
      return
    }

    await advanceStep()
  }, [
    currentStep,
    handleSubmit,
    getValues,
    setError,
    clearErrors,
    getDraft,
    savePropertyDetails,
    advanceStep,
    sortedIncompleteProperties,
    selectedPropertyId,
    propertySiteConfirmed,
    selectedProperty,
    sitesPanelCanAdvance,
    sitesPanelContext,
    properties,
  ])

  const handleBack = useCallback(() => {
    const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
    if (stepIndex > 0) {
      const prevStep = WIZARD_STEPS[stepIndex - 1]
      if (prevStep) setCurrentStep(prevStep.id)
    }
  }, [currentStep])

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="text-muted-foreground">Loading property data...</p>
          {!isLoading && properties.length === 0 && (
            <div className="text-sm text-destructive">
              <p>No properties found.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => refreshProperties()}
              >
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const selectedPropertyDb = selectedProperty as unknown as Record<string, unknown>
  const settingsSource =
    propertySettingsConfig?.propertyId === selectedProperty.id ? propertySettingsConfig : selectedPropertyDb
  const pricingConfig = (settingsSource.pricing_config ?? null) as Record<string, unknown> | null
  const reservationTypeConfigRaw = settingsSource.reservation_type_config ?? null
  const enabledReservationTypesRaw = settingsSource.enabled_reservation_types ?? null
  const siteTypeConfigRaw = (settingsSource.site_type_config ?? null) as
    | { allowed_site_types?: string[]; site_type_rates?: Record<string, unknown> }
    | null
  const siteTypeRatesFromConfig = (siteTypeConfigRaw?.site_type_rates ?? {}) as Record<string, unknown>
  const allowedSiteTypesFromConfig =
    Array.isArray(siteTypeConfigRaw?.allowed_site_types) && siteTypeConfigRaw.allowed_site_types.length > 0
      ? siteTypeConfigRaw.allowed_site_types
      : []
  const siteTypes = allowedSiteTypesFromConfig.map((siteType) => ({ siteType }))
  const depositConfig = (settingsSource.deposit_config ?? null) as Record<string, unknown> | null
  const rateDiscountsConfig = (settingsSource.rate_discounts_config ?? null) as Record<string, unknown> | null

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
  const currentStepConfig = WIZARD_STEPS[currentStepIndex]
  const currentSections = STEP_SECTION_MAP[currentStep]
  const isFirstStep = currentStepIndex === 0

  // Real-time required-field watch for warnings
  const addressVal = watch("address")
  const cityVal = watch("city")
  const stateVal = watch("state")
  const zipCodeVal = watch("zipCode")
  const locationIncomplete = !addressVal || !cityVal || !stateVal || !zipCodeVal

  const sectionWarnings: Record<string, string | undefined> = {
    location: locationIncomplete ? "Street address, City, State, and ZIP are required" : undefined,
  }

  function getPropertyWarning(property: { id: string; address?: string | null; city?: string | null; state?: string | null; zipCode?: string | null }): string | undefined {
    const propertyDraft = allPropertyDrafts[property.id]
    const hasUnsavedPropertyDraft = Boolean(
      propertyDraft &&
      Object.values(propertyDraft).some((value) => value !== undefined)
    )

    if (currentStep === "property_details" && hasUnsavedPropertyDraft) {
      return "Unsaved property changes"
    }

    if (currentStep === "sites_setup") {
      return propertySiteConfirmed.has(property.id)
        ? undefined
        : "At least one site is required to continue"
    }

    if (property.id === selectedPropertyId) {
      return locationIncomplete ? "Location section has required fields" : undefined
    }
    const addr = propertyDraft?.address ?? property.address
    const cty = propertyDraft?.city ?? property.city
    const st = propertyDraft?.state ?? property.state
    const zip = propertyDraft?.zipCode ?? property.zipCode
    return !addr || !cty || !st || !zip ? "Location section has required fields" : undefined
  }

  return (
    <div className="h-screen min-h-screen overflow-hidden bg-background flex flex-col">
      {/* Top header with progress */}
      <header className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4">
          <div className="mb-3">
            <h1 className="text-xl sm:text-2xl font-heading font-semibold tracking-tight">
              Property Setup Wizard
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure your property to start accepting bookings
            </p>
          </div>
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <nav className="flex-1 min-w-0 overflow-x-auto overflow-y-hidden">
              <ol className="flex items-center min-w-max md:min-w-0">
                {WIZARD_STEPS.map((step, stepIdx) => {
                  const isCompleted = completedSteps.has(step.id)
                  const isCurrent = step.id === currentStep
                  const showAsCompleted = isCompleted && !isCurrent

                  return (
                    <li key={step.id} className="relative flex-1 flex justify-center">
                      {stepIdx !== 0 && (
                        <div
                          className="absolute left-[-50%] top-[1.125rem] z-0 h-0.5 w-full -translate-y-1/2"
                          aria-hidden="true"
                        >
                          <div
                            className={cn(
                              "h-full w-full transition-colors duration-300",
                              stepIdx <= currentStepIndex ? "bg-primary" : "bg-muted"
                            )}
                          />
                        </div>
                      )}
                      <div className="relative z-10 flex flex-col items-center">
                        <span>
                          {showAsCompleted ? (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                              <Check className="h-5 w-5 text-primary-foreground" />
                            </span>
                          ) : isCurrent ? (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-background">
                              <span className="text-sm font-semibold text-primary">{stepIdx + 1}</span>
                            </span>
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-muted bg-background">
                              <span className="text-sm text-muted-foreground">{stepIdx + 1}</span>
                            </span>
                          )}
                        </span>
                        <span className="mt-1.5 flex flex-col items-center">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              isCurrent
                                ? "text-primary"
                                : showAsCompleted
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                            )}
                          >
                            {step.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground hidden lg:block">
                            {step.description}
                          </span>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </nav>
          </div>
        </div>
      </header>

      {/* Main body — min-h-0 so flex child can shrink and only inner content scrolls */}
      <div className="flex-1 min-h-0 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 md:py-6 overflow-hidden flex flex-col">
        {/* Unified card: sidebar + content in one border */}
        <SitesPanelContext.Provider value={sitesPanelContext}>
          <div className="flex-1 min-h-0 rounded-lg border border-border bg-card overflow-hidden flex flex-col md:flex-row">
            {/* Sidebar — hidden on Payment Setup and Review & Launch (single section, not needed) */}
            {currentStep !== "stripe_connect" && currentStep !== "review_launch" && (
              <aside className="w-60 flex-shrink-0 hidden md:flex border-r border-border">
                <div className="w-full flex flex-col">
                  {/* Current property selector */}
                  <div className="p-4 border-b border-border">
                    <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-3">
                      Current Property
                    </p>
                    <div ref={desktopPropertyDropdownRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setShowPropertyDropdown(!showPropertyDropdown)}
                        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                          <span className="truncate">{selectedProperty.name}</span>
                        </span>
                        <span className="flex items-center gap-1 flex-shrink-0">
                          {getPropertyWarning(selectedProperty) && (
                            <span className="relative group/ptip flex-shrink-0">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                              <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-max max-w-[180px] rounded bg-popover border border-border px-2 py-1 text-xs text-popover-foreground shadow-md opacity-0 group-hover/ptip:opacity-100 transition-opacity z-30">
                                {getPropertyWarning(selectedProperty)}
                              </span>
                            </span>
                          )}
                          {sortedIncompleteProperties.length > 1 && (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                      </button>
                      {showPropertyDropdown && sortedIncompleteProperties.length > 1 && (
                        <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-md border border-border bg-popover shadow-md">
                          {sortedIncompleteProperties.map((property) => {
                            const propWarning = getPropertyWarning(property)
                            return (
                              <button
                                key={property.id}
                                type="button"
                                onClick={() => {
                                  if (selectedProperty) {
                                    const existingDraft = getDraft(selectedProperty.id) ?? {}
                                    saveDraft(selectedProperty.id, {
                                      ...existingDraft,
                                      ...(getValues() as PropertyDetailsDraft),
                                    })
                                  }
                                  selectProperty(property.id)
                                  setWorkingPropertyId(property.id)
                                  setShowPropertyDropdown(false)
                                  setCurrentSection("location")
                                }}
                                className={cn(
                                  "w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center gap-2",
                                  property.id === selectedPropertyId && "bg-accent"
                                )}
                              >
                                <span
                                  className={cn(
                                    "h-2 w-2 rounded-full flex-shrink-0",
                                    property.id === selectedPropertyId
                                      ? "bg-primary"
                                      : "bg-muted-foreground/40"
                                  )}
                                />
                                <span className="flex-1 truncate">{property.name}</span>
                                {propWarning && (
                                  <span className="relative group/ptip flex-shrink-0">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                    <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-max max-w-[180px] rounded bg-popover border border-border px-2 py-1 text-xs text-popover-foreground shadow-md opacity-0 group-hover/ptip:opacity-100 transition-opacity z-30">
                                      {propWarning}
                                    </span>
                                  </span>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section navigation — sites step uses its own tree */}
                  {currentStep === "sites_setup" ? (
                    <SitesSidebarTree />
                  ) : (
                    <div className="py-4 flex-1">
                      <p className="px-4 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-3">
                        Sections
                      </p>
                      <nav className="space-y-0.5">
                        {currentSections.map((section) => {
                          const isActive = section.id === currentSection
                          const warning = sectionWarnings[section.id]
                          return (
                            <button
                              key={section.id}
                              type="button"
                              onClick={() => setCurrentSection(section.id)}
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-1.5 text-sm transition-colors text-left",
                                isActive
                                  ? "bg-muted text-primary font-medium border-l-[3px] border-primary"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                              )}
                            >
                              <span
                                className={cn(
                                  "h-1.5 w-1.5 rounded-full flex-shrink-0",
                                  isActive ? "bg-primary" : "bg-muted-foreground/40"
                                )}
                              />
                              <span className="flex-1">{section.label}</span>
                              {warning && (
                                <span className="relative group/tip flex-shrink-0">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                                  <span className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-max max-w-[180px] rounded bg-popover border border-border px-2 py-1 text-xs text-popover-foreground shadow-md opacity-0 group-hover/tip:opacity-100 transition-opacity z-30">
                                    {warning}
                                  </span>
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </nav>
                    </div>
                  )}

                </div>
              </aside>
            )}

            {/* Main content */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {/* Mobile: menu button to open sidebar in sheet — hidden on Payment Setup and Review & Launch */}
              {currentStep !== "stripe_connect" && currentStep !== "review_launch" && (
                <div className="md:hidden flex items-center gap-2 px-4 py-3 border-b border-border flex-shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={openMobileNav}
                    className="gap-2"
                  >
                    <Menu className="h-4 w-4" />
                    Menu
                  </Button>
                  <span className="text-sm text-muted-foreground truncate">
                    {currentStep === "sites_setup"
                      ? "Sites"
                      : currentSections.find((s) => s.id === currentSection)?.label ?? currentStepConfig?.label}
                  </span>
                </div>
              )}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto">
                {/* Section header — hidden on property_details and steps with own headers */}
                {currentStep !== "property_details" &&
                  currentStep !== "sites_setup" &&
                  currentStep !== "stripe_connect" &&
                  currentStep !== "review_launch" && (
                    <div className="mb-6">
                      <h2 className="text-lg font-semibold">
                        {currentSections.find((s) => s.id === currentSection)?.label ??
                          currentStepConfig?.label}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {currentStepConfig?.description}
                      </p>
                    </div>
                  )}

                {currentStep === "property_details" && (
                  <WizardPropertyDetailsSections
                    currentSection={currentSection}
                    selectedProperty={selectedProperty}
                    register={register}
                    errors={errors}
                    setValue={setValue}
                    timezone={timezone}
                    usTimezones={US_TIMEZONES}
                    pricingConfig={pricingConfig}
                    reservationTypeConfigRaw={reservationTypeConfigRaw}
                    enabledReservationTypesRaw={enabledReservationTypesRaw}
                    siteTypes={siteTypes}
                    allowedSiteTypesFromConfig={allowedSiteTypesFromConfig}
                    siteTypeRatesFromConfig={siteTypeRatesFromConfig}
                    depositConfig={depositConfig}
                    rateDiscountsConfig={rateDiscountsConfig}
                  />
                )}

                {/* Sites Setup */}
                {currentStep === "sites_setup" && <SitesPanelContent />}

                {/* Stripe Connect */}
                {currentStep === "stripe_connect" && (
                  <StripeConnectStep
                    property={selectedProperty}
                    onComplete={advanceStep}
                    onSkip={advanceStep}
                  />
                )}

                {/* Review & Launch */}
                {currentStep === "review_launch" && (
                  <ReviewLaunchStep
                    property={selectedProperty}
                    onComplete={handleWizardComplete}
                    onBack={handleBack}
                    onReadyChange={setReviewLaunchReady}
                    onFixNow={() => setCurrentStep("stripe_connect")}
                  />
                )}
              </div>

              {/* Navigation footer — pinned to bottom of content column */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 md:px-6 py-3 border-t border-border flex-shrink-0">
                {/* Left: error message and, on sites step, Save Site */}
                <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap order-2 sm:order-1">
                  {footerError && footerIssueDetails.length === 0 && (
                    <p className="flex items-center gap-1.5 rounded-md border border-red-500/35 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-700 dark:text-red-300">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-300" />
                      <span>{footerError}</span>
                    </p>
                  )}
                  {footerIssueDetails.length > 0 && (
                    <>
                      <Popover open={showFooterIssueDetails} onOpenChange={setShowFooterIssueDetails}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs",
                              footerIssueKind === "unsaved"
                                ? "border border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                : "border border-red-500/35 bg-red-500/10 text-destructive dark:text-red-300"
                            )}
                          >
                            <Eye className="h-3.5 w-3.5 flex-shrink-0" />
                            {footerIssueKind === "unsaved"
                              ? "You have unsaved changes"
                              : `View ${footerIssueDetails.length === 1 ? "Issue" : "Issues"}`}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="start"
                          side="top"
                          className={cn(
                            "w-[min(92vw,34rem)] text-xs",
                            footerIssueKind === "unsaved"
                              ? "border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
                              : "border border-red-300 bg-red-100 text-destructive dark:border-red-700 dark:bg-red-950 dark:text-red-100"
                          )}
                        >
                          <p className="mb-2 font-medium">
                            {footerIssueKind === "unsaved" ? "You have unsaved changes" : "Error Details"}
                          </p>
                          <div className="space-y-1">
                            {footerIssueDetails.map((detail, idx) => (
                              <p key={`${idx}-${detail}`} className="flex items-start gap-1.5">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                                <span>{detail}</span>
                              </p>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
                {/* Right: navigation buttons */}
                <div className="flex items-center gap-2 flex-shrink-0 order-1 sm:order-2">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={isFirstStep || isSaving || isCompleting}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  {currentStep === "review_launch" ? (
                    <Button
                      onClick={handleWizardComplete}
                      disabled={!reviewLaunchReady || isCompleting}
                    >
                      {isCompleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Completing...
                        </>
                      ) : (
                        <>
                          <Rocket className="mr-2 h-4 w-4" />
                          Complete Setup
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button onClick={handleSaveAndNext} disabled={isSaving || isCompleting}>
                      {isSaving || isCompleting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          {(currentStep === "sites_setup" || currentStep === "stripe_connect") ? "Next" : "Save & Next"}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile sidebar sheet */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetContent side="left" className="w-[min(85vw,20rem)] p-0 flex flex-col">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <div className="flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-border">
                  <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-3">
                    Current Property
                  </p>
                  <div ref={mobilePropertyDropdownRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPropertyDropdown(!showPropertyDropdown)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-md bg-muted/50 hover:bg-muted text-sm font-medium transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                        <span className="truncate">{selectedProperty.name}</span>
                      </span>
                      {sortedIncompleteProperties.length > 1 && (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                    </button>
                    {showPropertyDropdown && sortedIncompleteProperties.length > 1 && (
                      <div className="absolute top-full mt-1 left-0 right-0 z-20 rounded-md border border-border bg-popover shadow-md overflow-hidden">
                        {sortedIncompleteProperties.map((property) => (
                          <button
                            key={property.id}
                            type="button"
                            onClick={() => {
                              if (selectedProperty) {
                                const existingDraft = getDraft(selectedProperty.id) ?? {}
                                saveDraft(selectedProperty.id, {
                                  ...existingDraft,
                                  ...(getValues() as PropertyDetailsDraft),
                                })
                              }
                              selectProperty(property.id)
                              setWorkingPropertyId(property.id)
                              setShowPropertyDropdown(false)
                              setCurrentSection("location")
                            }}
                            className={cn(
                              "w-full px-3 py-2 text-sm text-left hover:bg-accent transition-colors flex items-center gap-2",
                              property.id === selectedPropertyId && "bg-accent"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full flex-shrink-0",
                                property.id === selectedPropertyId ? "bg-primary" : "bg-muted-foreground/40"
                              )}
                            />
                            <span className="flex-1 truncate">{property.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {currentStep === "sites_setup" ? (
                  <div className="flex-1 overflow-y-auto">
                    <SitesSidebarTree />
                  </div>
                ) : (
                  <div className="p-4 flex-1 overflow-y-auto">
                    <p className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase mb-3">
                      Sections
                    </p>
                    <nav className="space-y-0.5">
                      {currentSections.map((section) => {
                        const isActive = section.id === currentSection
                        return (
                          <button
                            key={section.id}
                            type="button"
                            onClick={() => setCurrentSection(section.id)}
                            className={cn(
                              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left",
                              isActive
                                ? "bg-primary/10 text-primary font-medium border-l-2 border-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            )}
                          >
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full flex-shrink-0",
                                isActive ? "bg-primary" : "bg-muted-foreground/40"
                              )}
                            />
                            <span className="flex-1">{section.label}</span>
                          </button>
                        )
                      })}
                    </nav>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </SitesPanelContext.Provider>
      </div>
    </div>
  )
}

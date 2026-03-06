"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Circle, Loader2, Check } from "lucide-react"
import { useProperty } from "@/components/property-context"
import { WizardProgressBar, WIZARD_STEPS, type WizardStep } from "./wizard-progress-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { PropertyDetailsStep, type PropertyDetailsStepHandle } from "./property-details-step"
import { SitesSetupStep, type SitesSetupStepHandle } from "./sites-setup-step"
import { StripeConnectStep } from "./stripe-connect-step"
import { ReviewLaunchStep } from "./review-launch-step"

interface WizardContainerProps {
  initialPropertyId?: string | null
  initialStep?: WizardStep | "dashboard_tour" | null
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
  const normalizedInitialStep =
    initialStep === "dashboard_tour" ? "stripe_connect" : initialStep
  const validStepFromUrl =
    stepFromUrl && WIZARD_STEPS.some((s) => s.id === stepFromUrl) ? stepFromUrl : null
  const validInitialStep =
    normalizedInitialStep && WIZARD_STEPS.some((s) => s.id === normalizedInitialStep)
      ? normalizedInitialStep
      : null

  const [currentStep, setCurrentStep] = useState<WizardStep>(
    validStepFromUrl || validInitialStep || "property_details"
  )
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set())
  const [workingPropertyId, setWorkingPropertyId] = useState<string | null>(
    initialPropertyId ?? null
  )
  const [_isCompleting, setIsCompleting] = useState(false)
  const [isSavingStep, setIsSavingStep] = useState(false)
  const [propertyDetailsSavedIds, setPropertyDetailsSavedIds] = useState<Set<string>>(
    () => new Set()
  )
  const [propertySiteConfirmed, setPropertySiteConfirmed] = useState<Set<string>>(() => new Set())

  const propertyDetailsRef = useRef<PropertyDetailsStepHandle>(null)
  const sitesStepRef = useRef<SitesSetupStepHandle>(null)

  const sortedIncompleteProperties = [...incompleteProperties].sort((a, b) => {
    const aTime = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : null
    const bTime = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : null
    if (aTime !== null && bTime !== null) return aTime - bTime
    return (a.name ?? "").localeCompare(b.name ?? "")
  })

  const initialSelectionDoneRef = useRef(false)
  const { toast } = useToast()

  useEffect(() => {
    setPropertyDetailsSavedIds((prev) => {
      const next = new Set(prev)
      incompleteProperties.forEach((p) => {
        if (p.address?.trim() && p.city?.trim() && p.state?.trim() && p.zipCode?.trim()) {
          next.add(p.id)
        }
      })
      return next
    })
  }, [incompleteProperties])

  useEffect(() => {
    setPropertySiteConfirmed((prev) => {
      const next = new Set(prev)
      incompleteProperties.forEach((p) => {
        const count = (p as any).siteCount ?? (p as any).totalSites ?? 0
        if (count > 0) next.add(p.id)
      })
      return next
    })
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
  }, [initialPropertyId, incompleteProperties, sortedIncompleteProperties, selectedPropertyId, selectProperty])

  const stepInitializedRef = useRef(false)

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

    if (validStepFromUrl) {
      setCurrentStep(validStepFromUrl)
      return
    }
    if (validInitialStep) {
      setCurrentStep(validInitialStep)
      return
    }

    const firstIncompleteStep = WIZARD_STEPS.find((step) => !backendCompleted.has(step.id))
    if (firstIncompleteStep) {
      setCurrentStep(firstIncompleteStep.id)
    } else if (backendCompleted.size > 0) {
      const lastStep = WIZARD_STEPS[WIZARD_STEPS.length - 1]
      if (lastStep) setCurrentStep(lastStep.id)
    }
  }, [selectedProperty, validStepFromUrl, validInitialStep])

  const handleWizardComplete = useCallback(async () => {
    if (!selectedProperty) return
    try {
      setIsCompleting(true)
      const response = await fetch(
        `/api/v1/properties/${selectedProperty.id}/complete-onboarding`,
        { method: "POST", headers: { "Content-Type": "application/json" } }
      )
      const result = await response.json()
      if (!result.success) throw new Error(result.error?.message || "Failed to complete onboarding")

      try {
        await fetch("/api/onboarding/company-progress", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ onboardingStep: "completed", onboardingCompleted: true }),
        })
      } catch (err) {
        console.error("Failed to save company onboarding complete:", err)
      }

      await refreshProperties()
      router.push("/dashboard?setup=complete&quick_tour=1")
    } catch (error) {
      console.error("Failed to complete wizard:", error)
      setIsCompleting(false)
    }
  }, [selectedProperty, router, refreshProperties])

  const handlePropertyDetailsSaved = useCallback((propertyId: string) => {
    setPropertyDetailsSavedIds((prev) => new Set(prev).add(propertyId))
    selectProperty(propertyId)
    setWorkingPropertyId(propertyId)
  }, [selectProperty])

  const handleSiteConfirmed = useCallback((propertyId: string) => {
    setPropertySiteConfirmed((prev) => new Set(prev).add(propertyId))
  }, [])

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

  const handleNext = useCallback(async () => {
    // ── Step 1: Property Details
    if (currentStep === "property_details") {
      // Check all properties have required details saved before advancing
      if (incompleteProperties.length > 1) {
        const allSaved = incompleteProperties.every((p) => propertyDetailsSavedIds.has(p.id))
        if (!allSaved) {
          toast({
            title: "Complete all properties",
            description: "Fill and save required details for every property before continuing.",
            variant: "destructive",
          })
          return
        }
      }

      setIsSavingStep(true)
      const success = await propertyDetailsRef.current?.submitForm()
      setIsSavingStep(false)

      if (!success) return
      await advanceStep()
      return
    }

    // ── Step 2: Sites Setup
    if (currentStep === "sites_setup") {
      // Always validate the currently visible property via the ref first.
      // canAdvance() is async — it waits for any in-progress fetchSites to finish.
      const currentOk = await sitesStepRef.current?.canAdvance()
      if (!currentOk) return

      if (sortedIncompleteProperties.length > 1) {
        const propertiesWithoutSites = sortedIncompleteProperties.filter(
          (p) =>
            p.id !== selectedProperty?.id &&
            !propertySiteConfirmed.has(p.id)
        )

        if (propertiesWithoutSites.length > 0) {
          const names = propertiesWithoutSites.map((p) => `"${p.name}"`).join(", ")
          toast({
            title: "Sites required for all properties",
            description: `${propertiesWithoutSites.length > 1 ? "These properties have" : "This property has"} no sites yet: ${names}. Please switch to ${propertiesWithoutSites.length > 1 ? "each tab" : "that tab"} and add at least one site.`,
            variant: "destructive",
          })
          return
        }
      }

      await advanceStep()
      return
    }

    // ── All other steps
    await advanceStep()
  }, [
    currentStep,
    sortedIncompleteProperties,
    incompleteProperties,
    propertyDetailsSavedIds,
    propertySiteConfirmed,
    selectedProperty,
    toast,
    advanceStep,
  ])

  const handlePrevious = () => {
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
    if (currentIndex <= 0) return
    const prevStep = WIZARD_STEPS[currentIndex - 1]
    if (prevStep) setCurrentStep(prevStep.id)
  }

  const handleStepClick = (step: WizardStep) => setCurrentStep(step)

  const handlePropertySwitch = (propertyId: string) => {
    setWorkingPropertyId(propertyId)
    selectProperty(propertyId)
    if (currentStep !== "property_details" && currentStep !== "sites_setup") {
      setCurrentStep("property_details")
    }
  }

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Loading property data...</p>
          {!isLoading && properties.length === 0 && (
            <div className="text-sm text-destructive">
              <p>No properties found. Please check the browser console for errors.</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => refreshProperties()}>
                Retry
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
  const isFirstStep = currentStepIndex === 0

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-semibold tracking-tight">
            Property Setup Wizard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure your property to start accepting bookings
          </p>
        </div>

        {/* Progress Bar */}
        <WizardProgressBar
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={handleStepClick}
        />

        {/* Step Content */}
        <Card>
          <CardContent className="pt-6">
            {/* Property tabs — only on steps that are per-property */}
            {sortedIncompleteProperties.length > 1 &&
              (currentStep === "property_details" || currentStep === "sites_setup") && (
                <div className="mb-6">
                  <Tabs
                    value={selectedPropertyId ?? workingPropertyId ?? ""}
                    onValueChange={(value) => {
                      if (value) handlePropertySwitch(value)
                    }}
                    className="w-full"
                  >
                    <TabsList
                      className="w-full grid"
                      style={{
                        gridTemplateColumns: `repeat(${Math.min(sortedIncompleteProperties.length, 4)}, 1fr)`,
                      }}
                    >
                      {sortedIncompleteProperties.map((property) => (
                        <TabsTrigger key={property.id} value={property.id} className="relative">
                          <span className="flex items-center gap-2">
                            {property.onboardingCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                            <span className="truncate">{property.name}</span>
                            {propertySiteConfirmed.has(property.id) && (
                              <Check className="h-4 w-4 text-white ml-1" />
                            )}
                          </span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}

            {currentStep === "property_details" && selectedProperty && (
              <PropertyDetailsStep
                key={selectedProperty.id}
                ref={propertyDetailsRef}
                property={selectedProperty}
                onComplete={advanceStep}
                onSkip={advanceStep}
                onSaveStateChange={setIsSavingStep}
                onPropertyDetailsSaved={handlePropertyDetailsSaved}
              />
            )}

            {currentStep === "sites_setup" && selectedProperty && (
              <SitesSetupStep
                key={selectedProperty.id}
                ref={sitesStepRef}
                property={selectedProperty}
                onComplete={advanceStep}
                onSkip={advanceStep}
                onSiteConfirmed={handleSiteConfirmed}
              />
            )}

            {currentStep === "stripe_connect" && (
              <StripeConnectStep
                property={selectedProperty}
                onComplete={advanceStep}
                onSkip={advanceStep}
              />
            )}

            {currentStep === "review_launch" && (
              <ReviewLaunchStep
                property={selectedProperty}
                onComplete={handleWizardComplete}
                onBack={handlePrevious}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        {currentStep !== "review_launch" && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep || isSavingStep}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>

            <span className="text-sm text-muted-foreground">
              Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
            </span>

            <Button onClick={handleNext} disabled={isSavingStep}>
              {isSavingStep ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
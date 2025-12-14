"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, CheckCircle2, Circle } from "lucide-react"
import { useProperty, type Property } from "@/components/property-context"
import { WizardProgressBar, WIZARD_STEPS, type WizardStep } from "./wizard-progress-bar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"

// Step components (will be implemented in subsequent phases)
import { PropertyDetailsStep } from "./property-details-step"
import { SitesSetupStep } from "./sites-setup-step"
import { DashboardTourStep } from "./dashboard-tour-step"
import { StripeConnectStep } from "./stripe-connect-step"
import { ReviewLaunchStep } from "./review-launch-step"

interface WizardContainerProps {
  initialPropertyId?: string | null
}

export function WizardContainer({ initialPropertyId }: WizardContainerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { properties, selectedProperty, selectProperty, incompleteProperties, refreshProperties, isLoading } =
    useProperty()

  // Check for step parameter from URL (used by Stripe OAuth callback)
  const stepFromUrl = searchParams.get("step") as WizardStep | null
  const validStepFromUrl = stepFromUrl && WIZARD_STEPS.some(s => s.id === stepFromUrl) ? stepFromUrl : null

  // Use local state for step tracking (no URL sync to avoid navigation issues)
  const [currentStep, setCurrentStep] = useState<WizardStep>(validStepFromUrl || "property_details")
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set())
  const [workingPropertyId, setWorkingPropertyId] = useState<string | null>(
    initialPropertyId || null
  )
  const [isCompleting, setIsCompleting] = useState(false)

  // Select property on mount
  useEffect(() => {
    if (initialPropertyId) {
      selectProperty(initialPropertyId)
      setWorkingPropertyId(initialPropertyId)
    } else if (incompleteProperties.length > 0) {
      const firstIncomplete = incompleteProperties[0]
      if (firstIncomplete) {
        selectProperty(firstIncomplete.id)
        setWorkingPropertyId(firstIncomplete.id)
      }
    }
  }, [initialPropertyId, incompleteProperties, selectProperty])

  // Load wizard progress from current property and determine starting step
  useEffect(() => {
    if (!selectedProperty) return

    const progress = selectedProperty.wizard_progress ?? {}
    const completed = new Set<WizardStep>()

    // Build completed steps set
    Object.entries(progress).forEach(([step, isComplete]) => {
      if (isComplete) {
        completed.add(step as WizardStep)
      }
    })

    setCompletedSteps(completed)

    // If URL has a valid step parameter (e.g., from Stripe OAuth callback), use it
    if (validStepFromUrl) {
      setCurrentStep(validStepFromUrl)
      return
    }

    // Otherwise, find first incomplete step to start on
    const firstIncompleteStep = WIZARD_STEPS.find((step) => !completed.has(step.id))
    if (firstIncompleteStep) {
      setCurrentStep(firstIncompleteStep.id)
    } else if (completed.size > 0) {
      // All steps completed - start at last step for review
      const lastStep = WIZARD_STEPS[WIZARD_STEPS.length - 1]
      if (lastStep) {
        setCurrentStep(lastStep.id)
      }
    }
  }, [selectedProperty, validStepFromUrl])

  // Note: We intentionally don't sync step to URL to avoid navigation issues
  // The wizard uses local state for step tracking - only ?wizard=true is needed in URL
  // for middleware exception handling

  const handleWizardComplete = useCallback(async () => {
    if (!selectedProperty) return

    // Mark property onboarding as complete
    try {
      setIsCompleting(true) // Prevent URL updates during completion

      // Migrated to v1 API (Phase 4, Week 13-14)
      const response = await fetch(`/api/v1/properties/${selectedProperty.id}/complete-onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error?.message || "Failed to complete onboarding")
      }

      // Redirect to dashboard - SetupCheckGate will handle showing setup modal if more properties need setup
      router.push("/dashboard?setup=complete")
    } catch (error) {
      console.error("Failed to complete wizard:", error)
      setIsCompleting(false) // Reset on error
    }
  }, [selectedProperty, router])

  const handleStepComplete = useCallback(async () => {
    // Mark current step as completed
    const newCompleted = new Set(completedSteps)
    newCompleted.add(currentStep)
    setCompletedSteps(newCompleted)

    // Save progress to backend
    if (selectedProperty) {
      try {
        // Migrated to v1 API (Phase 4, Week 13-14)
        await fetch(`/api/v1/properties/${selectedProperty.id}/wizard-progress`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            step: currentStep,
            completed: true,
          }),
        })
      } catch (error) {
        console.error("Failed to save wizard progress:", error)
      }
    }

    // Move to next step
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
    if (currentIndex < WIZARD_STEPS.length - 1) {
      const nextStep = WIZARD_STEPS[currentIndex + 1]
      if (nextStep) {
        setCurrentStep(nextStep.id)
      }
    } else {
      // Wizard complete for this property
      await handleWizardComplete()
    }
  }, [currentStep, completedSteps, selectedProperty, handleWizardComplete])

  const handlePrevious = () => {
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
    if (currentIndex <= 0) return

    // Smart back: skip over completed steps to find last incomplete step
    for (let i = currentIndex - 1; i >= 0; i--) {
      const step = WIZARD_STEPS[i]
      if (step && !completedSteps.has(step.id)) {
        setCurrentStep(step.id)
        return
      }
    }

    // If all previous steps are completed, just go back one step
    const prevStep = WIZARD_STEPS[currentIndex - 1]
    if (prevStep) {
      setCurrentStep(prevStep.id)
    }
  }

  const handleStepClick = (step: WizardStep) => {
    setCurrentStep(step)
  }

  const handlePropertySwitch = (propertyId: string) => {
    setWorkingPropertyId(propertyId)
    selectProperty(propertyId)
    setCurrentStep("property_details")
  }

  const handleExit = () => {
    router.push("/dashboard")
  }

  if (!selectedProperty) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Loading property data...</p>
          {!isLoading && properties.length === 0 && (
            <div className="text-sm text-destructive">
              <p>No properties found. Please check the browser console for errors.</p>
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

  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
  const isFirstStep = currentStepIndex === 0
  const isLastStep = currentStepIndex === WIZARD_STEPS.length - 1

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Property Setup Wizard</h1>
          <p className="text-muted-foreground">
            Configure your property to start accepting bookings
          </p>
        </div>
        <Button variant="ghost" onClick={handleExit}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Exit Setup
        </Button>
      </div>

      {/* Multi-Property Selector */}
      {incompleteProperties.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Property</CardTitle>
            <CardDescription>Configure one property at a time</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={workingPropertyId || ""}
              onValueChange={handlePropertySwitch}
              className="w-full"
            >
              <TabsList
                className="w-full grid"
                style={{
                  gridTemplateColumns: `repeat(${Math.min(incompleteProperties.length, 4)}, 1fr)`,
                }}
              >
                {incompleteProperties.map((property) => (
                  <TabsTrigger
                    key={property.id}
                    value={property.id}
                    className="relative"
                  >
                    <span className="flex items-center gap-2">
                      {property.onboardingCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      <span className="truncate">{property.name}</span>
                      {property.siteCount !== undefined && property.siteCount > 0 && (
                        <Badge variant="outline" className="ml-1">
                          {property.siteCount}
                        </Badge>
                      )}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Progress Bar */}
      <WizardProgressBar
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={handleStepClick}
      />

      {/* Step Content */}
      <Card className="min-h-[500px]">
        <CardContent className="pt-6">
          {currentStep === "property_details" && (
            <PropertyDetailsStep
              property={selectedProperty}
              onComplete={handleStepComplete}
              onSkip={handleStepComplete}
            />
          )}
          {currentStep === "sites_setup" && (
            <SitesSetupStep
              property={selectedProperty}
              onComplete={handleStepComplete}
              onSkip={handleStepComplete}
            />
          )}
          {currentStep === "dashboard_tour" && (
            <DashboardTourStep
              onComplete={handleStepComplete}
              onSkip={handleStepComplete}
            />
          )}
          {currentStep === "stripe_connect" && (
            <StripeConnectStep
              property={selectedProperty}
              onComplete={handleStepComplete}
              onSkip={handleStepComplete}
            />
          )}
          {currentStep === "review_launch" && (
            <ReviewLaunchStep
              property={selectedProperty}
              onComplete={handleWizardComplete}
            />
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons - Hidden on Review & Launch step which has its own Complete button */}
      {currentStep !== "review_launch" && (
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={isFirstStep}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>

          <div className="text-sm text-muted-foreground">
            Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
          </div>

          <Button onClick={handleStepComplete}>
            Next
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}

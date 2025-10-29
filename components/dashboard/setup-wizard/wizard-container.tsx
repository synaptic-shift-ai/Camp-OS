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
  const { properties, selectedProperty, selectProperty, incompleteProperties, refreshProperties } =
    useProperty()

  // Get initial step from URL or default to first step
  const urlStep = searchParams.get("step") as WizardStep | null
  const initialStep = urlStep && WIZARD_STEPS.find((s) => s.id === urlStep) ? urlStep : "property_details"

  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep)
  const [completedSteps, setCompletedSteps] = useState<Set<WizardStep>>(new Set())
  const [workingPropertyId, setWorkingPropertyId] = useState<string | null>(
    initialPropertyId || null
  )

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

  // Load wizard progress from current property
  useEffect(() => {
    if (selectedProperty) {
      const progress = selectedProperty.wizard_progress || {}
      const completed = new Set<WizardStep>()

      Object.entries(progress).forEach(([step, isComplete]) => {
        if (isComplete) {
          completed.add(step as WizardStep)
        }
      })

      setCompletedSteps(completed)

      // Set current step based on progress
      const lastCompletedStep = selectedProperty.wizard_step_completed
      if (lastCompletedStep && lastCompletedStep !== "not_started" && lastCompletedStep !== "complete") {
        const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === lastCompletedStep)
        if (currentStepIndex >= 0 && currentStepIndex < WIZARD_STEPS.length - 1) {
          const nextStep = WIZARD_STEPS[currentStepIndex + 1]
          if (nextStep) {
            setCurrentStep(nextStep.id)
          }
        } else if (WIZARD_STEPS.some((s) => s.id === lastCompletedStep)) {
          setCurrentStep(lastCompletedStep as WizardStep)
        }
      }
    }
  }, [selectedProperty])

  // Update URL when step changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    params.set("wizard", "true")  // Keep wizard mode active
    params.set("step", currentStep)
    if (workingPropertyId) {
      params.set("propertyId", workingPropertyId)
    }
    router.replace(`/dashboard/sites?${params.toString()}`, { scroll: false })
  }, [currentStep, workingPropertyId, router, searchParams])

  const handleStepComplete = useCallback(async () => {
    // Mark current step as completed
    const newCompleted = new Set(completedSteps)
    newCompleted.add(currentStep)
    setCompletedSteps(newCompleted)

    // Save progress to backend
    if (selectedProperty) {
      try {
        await fetch(`/api/dashboard/properties/${selectedProperty.id}/wizard-progress`, {
          method: "POST",
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
  }, [currentStep, completedSteps, selectedProperty])

  const handleWizardComplete = async () => {
    if (!selectedProperty) return

    // Mark property onboarding as complete
    try {
      await fetch(`/api/onboarding/update-property`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          onboardingCompleted: true,
        }),
      })

      // Refresh properties list
      await refreshProperties()

      // Check if there are more incomplete properties
      const remainingIncomplete = incompleteProperties.filter((p) => p.id !== selectedProperty.id)

      if (remainingIncomplete.length > 0) {
        // Show "continue to next property" modal or auto-switch
        const nextProperty = remainingIncomplete[0]
        if (nextProperty) {
          selectProperty(nextProperty.id)
          setWorkingPropertyId(nextProperty.id)
          setCurrentStep("property_details")
          setCompletedSteps(new Set())
        }
      } else {
        // All properties complete! Redirect to dashboard
        router.push("/dashboard?setup=complete")
      }
    } catch (error) {
      console.error("Failed to complete wizard:", error)
    }
  }

  const handlePrevious = () => {
    const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)
    if (currentIndex > 0) {
      const prevStep = WIZARD_STEPS[currentIndex - 1]
      if (prevStep) {
        setCurrentStep(prevStep.id)
      }
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
        <div className="text-center">
          <p className="text-muted-foreground">Loading property data...</p>
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
                      {property.onboarding_completed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      <span className="truncate">{property.name}</span>
                      {property.site_count !== undefined && property.site_count > 0 && (
                        <Badge variant="outline" className="ml-1">
                          {property.site_count}
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

      {/* Navigation Buttons */}
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
          {isLastStep ? "Complete Setup" : "Next"}
          {!isLastStep && <ArrowRight className="ml-2 h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}

"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ChevronLeft, ChevronRight, Check, ExternalLink } from "lucide-react"
import Link from "next/link"
import { DASHBOARD_TOUR_STEPS, QUICK_TIPS } from "./dashboard-tour-config"

export interface DashboardTourProps {
  propertyId?: string | null
  onComplete: () => void
  onSkip: () => void
}

function buildTourPath(stepPath: string, propertyId: string | null | undefined): string {
  if (!stepPath?.startsWith("/dashboard")) return stepPath
  if (!propertyId) return stepPath
  const afterDashboard = stepPath.replace(/^\/dashboard\/?/, "") || ""
  return `/dashboard/${propertyId}${afterDashboard ? `/${afterDashboard}` : ""}`
}

export function DashboardTour({ propertyId, onComplete, onSkip }: DashboardTourProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const currentStep = DASHBOARD_TOUR_STEPS[currentStepIndex]
  const progress = ((currentStepIndex + 1) / DASHBOARD_TOUR_STEPS.length) * 100
  const isLastStep = currentStepIndex === DASHBOARD_TOUR_STEPS.length - 1

  const handleNext = () => {
    if (isLastStep) {
      onComplete()
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, DASHBOARD_TOUR_STEPS.length - 1))
    }
  }

  const handlePrevious = () => {
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0))
  }

  const handleStepClick = (index: number) => {
    setCurrentStepIndex(index)
  }

  if (!currentStep) return null

  const Icon = currentStep.icon

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Step {currentStepIndex + 1} of {DASHBOARD_TOUR_STEPS.length}
          </span>
          <span className="font-medium">{Math.round(progress)}% Complete</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Step Navigation Pills */}
      <div className="flex flex-wrap gap-2">
        {DASHBOARD_TOUR_STEPS.map((step, index) => {
          const StepIcon = step.icon
          const isActive = index === currentStepIndex
          const isCompleted = index < currentStepIndex

          return (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${isActive
                ? "bg-primary text-primary-foreground border-primary"
                : isCompleted
                  ? "bg-green-100 text-green-800 border-green-300"
                  : "bg-muted hover:bg-muted/80 border-muted-foreground/20"
                }`}
            >
              {isCompleted ? (
                <Check className="h-4 w-4" />
              ) : (
                <StepIcon className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-sm font-medium">{step.title}</span>
            </button>
          )
        })}
      </div>

      {/* Main Content Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl font-semibold">{currentStep.title}</CardTitle>
              <CardDescription className="mt-2 text-sm">
                {currentStep.description}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Features List */}
          <div>
            <h4 className="text-sm font-semibold mb-3">Key Features:</h4>
            <ul className="space-y-2">
              {currentStep.features.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Button (if applicable) */}
          {currentStep.path && (
            <div className="pt-4 border-t">
              <Link href={buildTourPath(currentStep.path, propertyId)} target="_blank">
                <Button variant="outline" className="w-full sm:w-auto">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {currentStep.action || `Visit ${currentStep.title}`}
                </Button>
              </Link>
              <p className="text-xs text-muted-foreground mt-2">
                Opens in a new tab so you can explore without losing your progress
              </p>
            </div>
          )}

          {/* Quick Tips (on last step) */}
          {isLastStep && (
            <div className="pt-4 border-t space-y-4">
              <h4 className="text-sm font-semibold">Quick Tips to Get Started:</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {QUICK_TIPS.map((tip, index) => {
                  const TipIcon = tip.icon
                  return (
                    <Card key={index} className="border-dashed">
                      <CardContent className="p-4 space-y-2">
                        <TipIcon className="h-6 w-6 text-primary" />
                        <h5 className="font-medium text-sm">{tip.title}</h5>
                        <p className="text-xs text-muted-foreground">{tip.description}</p>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          onClick={handlePrevious}
          disabled={currentStepIndex === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>

        <Button variant="ghost" onClick={onSkip}>
          Skip Tour
        </Button>

        <Button onClick={handleNext}>
          {isLastStep ? (
            <>
              Complete Tour
              <Check className="ml-2 h-4 w-4" />
            </>
          ) : (
            <>
              Next
              <ChevronRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

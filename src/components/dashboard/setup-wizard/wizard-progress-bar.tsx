"use client"

import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export type WizardStep =
  | "property_details"
  | "sites_setup"
  | "dashboard_tour"
  | "stripe_connect"
  | "review_launch"

export interface WizardStepConfig {
  id: WizardStep
  label: string
  description: string
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  {
    id: "property_details",
    label: "Property Details",
    description: "Basic information and images",
  },
  {
    id: "sites_setup",
    label: "Sites Setup",
    description: "Add and configure campsites",
  },
  {
    id: "dashboard_tour",
    label: "Dashboard Tour",
    description: "Learn the platform",
  },
  {
    id: "stripe_connect",
    label: "Payment Setup",
    description: "Connect Stripe",
  },
  {
    id: "review_launch",
    label: "Review & Launch",
    description: "Finalize and go live",
  },
]

interface WizardProgressBarProps {
  currentStep: WizardStep
  completedSteps: Set<WizardStep>
  onStepClick?: (step: WizardStep) => void
}

export function WizardProgressBar({
  currentStep,
  completedSteps,
  onStepClick,
}: WizardProgressBarProps) {
  const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === currentStep)

  return (
    <div className="w-full">
      {/* Desktop: Horizontal stepper */}
      <div className="hidden md:block">
        <nav aria-label="Progress">
          <ol className="flex items-center justify-between">
            {WIZARD_STEPS.map((step, stepIdx) => {
              const isCompleted = completedSteps.has(step.id)
              const isCurrent = step.id === currentStep
              const isClickable = onStepClick && (isCompleted || stepIdx <= currentStepIndex)

              return (
                <li key={step.id} className="relative flex-1">
                  {/* Connector line */}
                  {stepIdx !== 0 && (
                    <div
                      className="absolute left-0 top-4 -ml-px mt-0.5 h-0.5 w-full"
                      aria-hidden="true"
                    >
                      <div
                        className={cn(
                          "h-full w-full",
                          stepIdx <= currentStepIndex
                            ? "bg-primary"
                            : "bg-muted"
                        )}
                      />
                    </div>
                  )}

                  {/* Step button */}
                  <button
                    type="button"
                    onClick={() => isClickable && onStepClick?.(step.id)}
                    disabled={!isClickable}
                    className={cn(
                      "group relative flex flex-col items-center",
                      isClickable ? "cursor-pointer" : "cursor-default"
                    )}
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 bg-background relative z-10">
                      {isCompleted ? (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                          <Check className="h-5 w-5 text-primary-foreground" aria-hidden="true" />
                        </span>
                      ) : isCurrent ? (
                        <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-background">
                          <span className="h-3 w-3 rounded-full bg-primary" />
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-full border-2",
                            stepIdx < currentStepIndex
                              ? "border-primary bg-primary/10"
                              : "border-muted bg-background"
                          )}
                        >
                          <span className="text-sm font-medium text-muted-foreground">
                            {stepIdx + 1}
                          </span>
                        </span>
                      )}
                    </span>
                    <span className="mt-2 flex flex-col items-center">
                      <span
                        className={cn(
                          "text-sm font-medium",
                          isCurrent
                            ? "text-primary"
                            : isCompleted
                            ? "text-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        {step.label}
                      </span>
                      <span className="text-xs text-muted-foreground hidden lg:block">
                        {step.description}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>
      </div>

      {/* Mobile: Compact progress */}
      <div className="md:hidden">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">
            Step {currentStepIndex + 1} of {WIZARD_STEPS.length}
          </span>
          <span className="text-sm text-muted-foreground">
            {Math.round(((currentStepIndex + 1) / WIZARD_STEPS.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStepIndex + 1) / WIZARD_STEPS.length) * 100}%` }}
          />
        </div>
        <p className="mt-2 text-sm font-medium">{WIZARD_STEPS[currentStepIndex]?.label || ""}</p>
        <p className="text-xs text-muted-foreground">
          {WIZARD_STEPS[currentStepIndex]?.description || ""}
        </p>
      </div>
    </div>
  )
}

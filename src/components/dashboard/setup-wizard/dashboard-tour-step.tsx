"use client"

import { Compass } from "lucide-react"
import { DashboardTour } from "./dashboard-tour"

interface DashboardTourStepProps {
  onComplete: () => void
  onSkip: () => void
}

export function DashboardTourStep({ onComplete, onSkip }: DashboardTourStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Compass className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold">Dashboard Tour</h2>
          <p className="text-muted-foreground">
            Learn how to navigate and use your CampOS dashboard
          </p>
        </div>
      </div>

      <DashboardTour onComplete={onComplete} onSkip={onSkip} />
    </div>
  )
}

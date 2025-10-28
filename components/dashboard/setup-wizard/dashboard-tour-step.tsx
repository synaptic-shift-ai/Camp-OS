"use client"

import { Button } from "@/components/ui/button"
import { Compass } from "lucide-react"

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
          <h2 className="text-2xl font-bold">Dashboard Tour</h2>
          <p className="text-muted-foreground">
            Learn how to navigate and use the CampgroundOps platform
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-muted-foreground">
          Interactive dashboard tour will be implemented in Phase 5
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This will include: guided tour with spotlight effects and tooltips
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={onComplete}>Continue to Payment Setup</Button>
        <Button variant="outline" onClick={onSkip}>
          Skip Tour
        </Button>
      </div>
    </div>
  )
}

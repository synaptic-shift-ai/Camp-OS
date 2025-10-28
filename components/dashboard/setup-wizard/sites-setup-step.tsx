"use client"

import type { Property } from "@/components/property-context"
import { Button } from "@/components/ui/button"
import { Tent } from "lucide-react"

interface SitesSetupStepProps {
  property: Property
  onComplete: () => void
  onSkip: () => void
}

export function SitesSetupStep({ property, onComplete, onSkip }: SitesSetupStepProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Tent className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Sites Setup</h2>
          <p className="text-muted-foreground">
            Add and configure campsites for {property.name}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-muted-foreground/25 p-8 text-center">
        <p className="text-muted-foreground">
          Sites setup form will be implemented in Phase 4
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This will include: site details, amenities, pricing, images, and availability rules
        </p>
      </div>

      <div className="flex gap-2">
        <Button onClick={onComplete}>Continue to Dashboard Tour</Button>
        <Button variant="outline" onClick={onSkip}>
          Skip for Now
        </Button>
      </div>
    </div>
  )
}

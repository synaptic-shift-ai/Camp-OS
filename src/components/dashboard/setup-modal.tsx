"use client"

import { Rocket, CheckCircle2, Building2, MapPin } from "lucide-react"
import type { Property } from "@/components/property-context"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface SetupModalProps {
  open: boolean
  onStartSetup: () => void
  onDismiss: () => void
  properties: Property[]
}

export function SetupModal({ open, onStartSetup, onDismiss, properties }: SetupModalProps) {
  const totalProperties = properties.length
  const totalSites = properties.reduce((sum, p) => sum + (p.siteCount || 0), 0)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onDismiss()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Rocket className="h-6 w-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Welcome to CampgroundOps!</DialogTitle>
              <DialogDescription>Let's get your properties set up</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            You're almost ready to start accepting bookings. We just need to complete the setup for your {totalProperties === 1 ? "property" : "properties"}.
          </p>

          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="h-4 w-4 text-primary" />
              <span>Properties to Configure: {totalProperties}</span>
            </div>

            <div className="space-y-2">
              {properties.map((property) => (
                <div
                  key={property.id}
                  className="flex items-center justify-between bg-background rounded-md p-3 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{property.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="text-xs">
                      {property.siteCount || 0} {property.siteCount === 1 ? "site" : "sites"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-900">
            <div className="flex-shrink-0 mt-0.5">
              <svg
                className="h-5 w-5 text-blue-600 dark:text-blue-400"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                Quick Setup Process
              </p>
              <p className="text-blue-700 dark:text-blue-300 text-xs">
                This will take about 10-15 minutes per property. You'll configure property details,
                add sites, set pricing, and connect payment processing.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onDismiss} className="w-full sm:w-auto" disabled>
            I'll do this later
          </Button>
          <Button onClick={onStartSetup} className="w-full sm:w-auto">
            <Rocket className="mr-2 h-4 w-4" />
            Start Setup
          </Button>
        </DialogFooter>

        <p className="text-xs text-center text-muted-foreground mt-2">
          Setup must be completed before you can accept bookings
        </p>
      </DialogContent>
    </Dialog>
  )
}

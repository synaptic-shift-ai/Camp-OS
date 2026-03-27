"use client"

import { PropertyImagesSection } from "@/components/dashboard/property-images-section"

interface Props {
  propertyId: string
  initialCoverUrl?: string | null
}

export function ImagesSection({ propertyId, initialCoverUrl }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-lg font-semibold">Images</h3>
        <p className="text-sm text-muted-foreground">Upload photos for your property listing</p>
      </div>
      <PropertyImagesSection propertyId={propertyId} initialCoverUrl={initialCoverUrl} />
    </div>
  )
}

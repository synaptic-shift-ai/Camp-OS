"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ImageIcon } from "lucide-react"
import {
  Dropzone,
  DropzoneContent,
  DropzoneCoverContent,
  DropzoneCoverEmptyState,
  DropzoneEmptyState,
  DropzoneUploadedContent,
} from "@/components/dropzone"
import { useSupabaseUpload } from "@/hooks/use-supabase-upload"

const MAX_PROPERTY_IMAGES = 9
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

function CoverDropzoneSection({
  propertyId,
  coverUrl,
  onUploaded,
  onDeleted,
  allowEditing,
}: {
  propertyId: string
  coverUrl: string | null
  onUploaded: (url: string, name: string) => void
  onDeleted: () => void
  allowEditing: boolean
}) {
  const coverUpload = useSupabaseUpload({
    bucketName: "cover-property-images",
    path: `${propertyId}/cover`,
    maxFiles: 1,
    maxFileSize: MAX_IMAGE_SIZE_BYTES,
    allowedMimeTypes: ["image/*"],
    upsert: true,
  })

  return (
    <Dropzone
      {...coverUpload}
      className="relative h-48 p-6 flex items-center justify-center overflow-hidden"
    >
      {!coverUrl && coverUpload.files.length === 0 && (
        <DropzoneCoverEmptyState />
      )}
      <DropzoneCoverContent
        propertyId={propertyId}
        currentCoverUrl={coverUrl}
        onUploaded={onUploaded}
        onDeleted={onDeleted}
        allowEditing={allowEditing}
      />
    </Dropzone>
  )
}

export type PropertyImagesSectionProps = {
  propertyId: string
  initialCoverUrl?: string | null
  canEdit?: boolean
}

export function PropertyImagesSection({
  propertyId,
  initialCoverUrl,
  canEdit = true,
}: PropertyImagesSectionProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(initialCoverUrl ?? null)
  const [uploadedGalleryCount, setUploadedGalleryCount] = useState(0)
  const [coverKey, setCoverKey] = useState(0)

  const galleryUpload = useSupabaseUpload({
    bucketName: "property-images",
    path: `${propertyId}/gallery`,
    maxFiles: MAX_PROPERTY_IMAGES,
    maxFileSize: MAX_IMAGE_SIZE_BYTES,
    allowedMimeTypes: ["image/*"],
  })

  const galleryAtMax =
    uploadedGalleryCount >= MAX_PROPERTY_IMAGES && galleryUpload.files.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ImageIcon className="h-4 w-4" />
          Property images
        </CardTitle>
        <CardDescription className="text-sm">
          Upload a cover photo and gallery images for your property.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit ? (
          <>
            <div className="flex flex-col sm:flex-row gap-4 items-start">
              <div className="w-full sm:w-64 sm:shrink-0 flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Cover photo</p>
                <CoverDropzoneSection
                  key={coverKey}
                  propertyId={propertyId}
                  coverUrl={coverUrl}
                  allowEditing
                  onUploaded={(url) => setCoverUrl(url)}
                  onDeleted={() => {
                    setCoverUrl(null)
                    setCoverKey((k) => k + 1)
                  }}
                />
              </div>

              <div className="w-full sm:flex-1 sm:min-w-0 flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Gallery images</p>
                <Dropzone
                  {...galleryUpload}
                  uploadedCount={uploadedGalleryCount}
                  className={
                    galleryAtMax
                      ? "h-48 flex flex-col overflow-hidden opacity-60 pointer-events-none"
                      : "h-48 flex flex-col overflow-hidden"
                  }
                >
                  {galleryUpload.files.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <DropzoneEmptyState />
                    </div>
                  ) : (
                    <div className="w-full h-full overflow-y-auto p-2">
                      <DropzoneContent layout="grid" className="mt-0" />
                    </div>
                  )}
                </Dropzone>
              </div>
            </div>

            <DropzoneUploadedContent
              propertyId={propertyId}
              upload={galleryUpload}
              onPersistedCountChange={setUploadedGalleryCount}
            />
          </>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="w-full sm:w-64 sm:shrink-0 flex flex-col">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Cover photo</p>
              <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                ) : (
                  <p className="px-2 text-center text-sm text-muted-foreground">No cover photo</p>
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1 flex flex-col">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Gallery images</p>
              <DropzoneUploadedContent
                propertyId={propertyId}
                upload={galleryUpload}
                allowEditing={false}
                onPersistedCountChange={setUploadedGalleryCount}
              />
              {uploadedGalleryCount === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">No gallery images uploaded.</p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

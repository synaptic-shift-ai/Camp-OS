"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export type PropertyAmenityEditPayload = {
  name: string
  description: string
  icon_url?: string | null
}

type PropertyAmenity = {
  id: string
  name: string
  description: string
  icon_url?: string | null
}

type EditPropertyAmenitiesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  amenityToEdit: PropertyAmenity | null
  onSave: (payload: PropertyAmenityEditPayload) => void
}

export function EditPropertyAmenitiesDialog({
  open,
  onOpenChange,
  amenityToEdit,
  onSave,
}: EditPropertyAmenitiesDialogProps) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [iconUrl, setIconUrl] = useState("")

  useEffect(() => {
    if (!open || !amenityToEdit) return
    setName(amenityToEdit.name)
    setDescription(amenityToEdit.description)
    setIconUrl(amenityToEdit.icon_url ?? "")
  }, [open, amenityToEdit])

  const canSave = name.trim().length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Property Amenity</DialogTitle>
          <DialogDescription>Update name, description, and SVG icon URL.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-property-amenity-name">Name</Label>
            <Input
              id="edit-property-amenity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter amenity name"
              className="bg-card/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-property-amenity-description">Description</Label>
            <Textarea
              id="edit-property-amenity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Amenity details (optional)"
              className="min-h-24 bg-card/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-property-amenity-icon-url">SVG Icon URL</Label>
            <Input
              id="edit-property-amenity-icon-url"
              value={iconUrl}
              onChange={(e) => setIconUrl(e.target.value)}
              placeholder="https://example.com/icon.svg (optional)"
              className="bg-card/50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave({
                name: name.trim(),
                description: description.trim(),
                icon_url: iconUrl.trim() || null,
              })
              onOpenChange(false)
            }}
            disabled={!canSave}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useEffect, useMemo, useState } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const amenityPresets = [
  "Fire Pit",
  "Picnic Table",
  "Grill",
  "Shade",
  "Pet Friendly",
  "Lake View",
  "Waterfront",
] as const

type AmenityPreset = (typeof amenityPresets)[number] | "Other"

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
  const [preset, setPreset] = useState<AmenityPreset | "">("")
  const [customName, setCustomName] = useState("")
  const [description, setDescription] = useState("")
  const [iconUrl, setIconUrl] = useState("")

  useEffect(() => {
    if (!open || !amenityToEdit) return
    const matchingPreset = amenityPresets.find((option) => option === amenityToEdit.name)
    if (matchingPreset) {
      setPreset(matchingPreset)
      setCustomName("")
    } else {
      setPreset("Other")
      setCustomName(amenityToEdit.name)
    }
    setDescription(amenityToEdit.description)
    setIconUrl(amenityToEdit.icon_url ?? "")
  }, [open, amenityToEdit])

  const name = useMemo(() => {
    if (!preset) return ""
    if (preset !== "Other") return preset
    return customName.trim()
  }, [customName, preset])

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
            <Select
              value={preset}
              onValueChange={(value) => setPreset(value as AmenityPreset)}
            >
              <SelectTrigger id="edit-property-amenity-name" className="bg-card/50">
                <SelectValue placeholder="Select an amenity" />
              </SelectTrigger>
              <SelectContent>
                {amenityPresets.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Custom</SelectItem>
              </SelectContent>
            </Select>

            {preset === "Other" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-property-amenity-custom-name" className="text-xs text-muted-foreground">
                  New site amenity name
                </Label>
                <Input
                  id="edit-property-amenity-custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter site amenity name"
                  className="bg-card/50"
                />
              </div>
            )}
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
            <span className="text-sm text-muted-foreground">
              Need an SVG icon? Browse icons at{' '}
              <a
                href="https://icones.js.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-foreground"
              >
                icones.js.org
              </a>
              .
            </span>
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

"use client"

import { useEffect, useMemo, useRef, useState } from "react"
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
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"

const propertyAmenityPresets = [
  "Free Wifi",
  "Hot Shower",
  "Fire Pits",
  "Lake Access",
  "Camp Store",
  "Hiking Trails",
] as const

type PropertyAmenityPreset = (typeof propertyAmenityPresets)[number] | "Other"

export type PropertyAmenityEditPayload = {
  name: string
  description: string
  icon_url?: string | null
}

type PropertyAmenity = {
  id: string
  name: string
  description: string | null
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
  const [preset, setPreset] = useState<PropertyAmenityPreset | "">("")
  const [customName, setCustomName] = useState("")
  const [description, setDescription] = useState("")
  const [iconUrl, setIconUrl] = useState("")
  const cleanFormRef = useRef<string>("")

  useEffect(() => {
    if (!open || !amenityToEdit) return
    const matchingPreset = propertyAmenityPresets.find((option) => option === amenityToEdit.name)
    let initialPreset: PropertyAmenityPreset
    let initialCustomName: string
    if (matchingPreset) {
      initialPreset = matchingPreset
      initialCustomName = ""
    } else {
      initialPreset = "Other"
      initialCustomName = amenityToEdit.name
    }
    setPreset(initialPreset)
    setCustomName(initialCustomName)
    setDescription(amenityToEdit.description ?? "")
    setIconUrl(amenityToEdit.icon_url ?? "")
    cleanFormRef.current = JSON.stringify({ preset: initialPreset, customName: initialCustomName, description: amenityToEdit.description ?? "", iconUrl: amenityToEdit.icon_url ?? "" })
  }, [open, amenityToEdit])

  const name = useMemo(() => {
    if (!preset) return ""
    if (preset !== "Other") return preset
    return customName.trim()
  }, [customName, preset])

  const canSave = name.trim().length > 0
  const isDirty = JSON.stringify({ preset, customName, description, iconUrl }) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({ isDirty, open, onOpenChange })

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
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
              onValueChange={(value) => setPreset(value as PropertyAmenityPreset)}
            >
              <SelectTrigger id="edit-property-amenity-name" className="bg-card/50">
                <SelectValue placeholder="Select an amenity" />
              </SelectTrigger>
              <SelectContent>
                {propertyAmenityPresets.map((option) => (
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
                  New property amenity name
                </Label>
                <Input
                  id="edit-property-amenity-custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter property amenity name"
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
          <Button type="button" variant="outline" onClick={() => guardedOnOpenChange(false)}>
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
    {unsavedChangesDialog}
    </>
  )
}

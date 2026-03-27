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

const propertyAmenityPresets = [
  "Free Wifi",
  "Hot Shower",
  "Fire Pits",
  "Lake Access",
  "Camp Store",
  "Hiking Trails"
] as const

type PropertyAmenityPreset = (typeof propertyAmenityPresets)[number] | "Other"

type AddPropertyAmenitiesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddPropertyAmenity?: (amenity: { name: string; description: string; icon_url?: string | null }) => void
  existingPropertyAmenityNames: string[]
}

export function AddPropertyAmenitiesDialog({
  open,
  onOpenChange,
  onAddPropertyAmenity,
  existingPropertyAmenityNames,
}: AddPropertyAmenitiesDialogProps) {
  const [preset, setPreset] = useState<PropertyAmenityPreset | "">("")
  const [customName, setCustomName] = useState("")
  const [description, setDescription] = useState("")
  const [iconUrl, setIconUrl] = useState("")

  useEffect(() => {
    if (open) return
    setPreset("")
    setCustomName("")
    setDescription("")
    setIconUrl("")
  }, [open])

  const name = useMemo(() => {
    if (!preset) return ""
    if (preset !== "Other") return preset
    return customName.trim()
  }, [customName, preset])

  const canSave = name.length > 0

  // const existingSet = useMemo(() => {
  //   return new Set(
  //       existingPropertyAmenityNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
  //   )
  // }, [existingPropertyAmenityNames])

  // const filteredPresets = propertyAmenityPresets.filter(
  //   (p) => !existingSet.has(p.toLowerCase())
  // )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Property Amenity</DialogTitle>
          <DialogDescription>Add a new amenity to your property.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="property-amenity-name">Name</Label>
            <Select
              value={preset}
              onValueChange={(value) => setPreset(value as PropertyAmenityPreset)}
            >
              <SelectTrigger id="property-amenity-name" className="bg-card/50">
                <SelectValue placeholder="Select a property amenity" />
              </SelectTrigger>
              <SelectContent>
                {propertyAmenityPresets.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
                <SelectItem value="Other">New Property Amenity</SelectItem>
              </SelectContent>
            </Select>

            {preset === "Other" && (
              <div className="grid gap-2">
                <Label htmlFor="property-amenity-custom-name" className="text-xs text-muted-foreground">
                  New Property Amenity Name
                </Label>
                <Input
                  id="property-amenity-custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter property amenity name"
                  className="bg-card/50"
                />
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="property-amenity-description">Description</Label>
            <Textarea
              id="property-amenity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add property amenity details (optional)"
              className="min-h-24 bg-card/50"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="property-amenity-icon-url">SVG Icon URL</Label>
            <Input
              id="property-amenity-icon-url"
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
            disabled={!canSave}
            onClick={() => {
              onAddPropertyAmenity?.({
                name,
                description: description.trim(),
                icon_url: iconUrl.trim() || null,
              })
              onOpenChange(false)
            }}
          >
            Add Property Amenity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
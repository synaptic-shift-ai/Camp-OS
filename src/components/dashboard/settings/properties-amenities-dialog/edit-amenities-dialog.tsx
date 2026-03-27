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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type AmenityEditPayload = {
  name: string
  description: string
}

type Amenity = {
  id: string
  name: string
  description: string
}

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

type EditAmenitiesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  amenityToEdit: Amenity | null
  onSave: (payload: AmenityEditPayload) => void
}

export function EditAmenitiesDialog({
  open,
  onOpenChange,
  amenityToEdit,
  onSave,
}: EditAmenitiesDialogProps) {
  const [preset, setPreset] = useState<AmenityPreset | "">("")
  const [customName, setCustomName] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (!open) return
    if (!amenityToEdit) return
    const matchingPreset = amenityPresets.find(
      (p) => p.toLowerCase() === amenityToEdit.name.trim().toLowerCase()
    )
    if (matchingPreset) {
      setPreset(matchingPreset)
      setCustomName("")
    } else {
      setPreset("Other")
      setCustomName(amenityToEdit.name)
    }
    setDescription(amenityToEdit.description)
  }, [open, amenityToEdit])

  const name = preset === "Other" ? customName.trim() : preset
  const canSave = Boolean(name && name.trim().length > 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onOpenChange(false)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Amenity</DialogTitle>
          <DialogDescription>Update the amenity name and description.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-amenity-name">Name</Label>
            <Select
              value={preset}
              onValueChange={(value) => setPreset(value as AmenityPreset)}
            >
              <SelectTrigger id="edit-amenity-name" className="bg-card/50">
                <SelectValue placeholder="Select an amenity" />
              </SelectTrigger>
              <SelectContent>
                {amenityPresets.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
                <SelectItem value="Other">New Site Amenity</SelectItem>
              </SelectContent>
            </Select>

            {preset === "Other" && (
              <div className="grid gap-2">
                <Label htmlFor="edit-amenity-custom-name" className="text-xs text-muted-foreground">
                  New amenity name
                </Label>
                <Input
                  id="edit-amenity-custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter amenity name"
                  className="bg-card/50"
                />
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-amenity-description">Description</Label>
            <Textarea
              id="edit-amenity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Amenity details (optional)"
              className="min-h-24 bg-card/50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => {
              onSave({
                name: name.trim(),
                description: description.trim(),
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

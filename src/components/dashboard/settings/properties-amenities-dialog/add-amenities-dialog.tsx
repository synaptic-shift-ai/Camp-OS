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

type AddAmenitiesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddAmenity?: (amenity: { name: string; description: string }) => void
  existingAmenityNames: string[]
}

export function AddAmenitiesDialog({
  open,
  onOpenChange,
  onAddAmenity,
  existingAmenityNames,
}: AddAmenitiesDialogProps) {
  const [preset, setPreset] = useState<AmenityPreset | "">("")
  const [customName, setCustomName] = useState("")
  const [description, setDescription] = useState("")
  const cleanFormRef = useRef<string>(
    JSON.stringify({ preset: "", customName: "", description: "" })
  )

  useEffect(() => {
    if (open) return
    setPreset("")
    setCustomName("")
    setDescription("")
    cleanFormRef.current = JSON.stringify({ preset: "", customName: "", description: "" })
  }, [open])

  const name = useMemo(() => {
    if (!preset) return ""
    if (preset !== "Other") return preset
    return customName.trim()
  }, [customName, preset])

  const canSave = name.length > 0

  const isDirty = JSON.stringify({ preset, customName, description }) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({ isDirty, open, onOpenChange })

  const existingSet = useMemo(() => {
    return new Set(
        existingAmenityNames.map((n) => n.trim().toLowerCase()).filter(Boolean),
    )
  }, [existingAmenityNames])

  const filteredPresets = amenityPresets.filter(
    (p) => !existingSet.has(p.toLowerCase())
  )

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Site Amenity</DialogTitle>
          <DialogDescription>Add a new amenity to your property.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amenity-name">Name</Label>
            <Select
              value={preset}
              onValueChange={(value) => setPreset(value as AmenityPreset)}
            >
              <SelectTrigger id="amenity-name" className="bg-card/50">
                <SelectValue placeholder="Select an amenity" />
              </SelectTrigger>
              <SelectContent>
                {filteredPresets.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Custom</SelectItem>
              </SelectContent>
            </Select>

            {preset === "Other" && (
              <div className="grid gap-2">
                <Label htmlFor="amenity-custom-name" className="text-xs text-muted-foreground">
                  New site amenity name
                </Label>
                <Input
                  id="amenity-custom-name"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Enter site amenity name"
                  className="bg-card/50"
                />
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amenity-description">Description</Label>
            <Textarea
              id="amenity-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add site amenity details (optional)"
              className="min-h-24 bg-card/50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => guardedOnOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => {
              onAddAmenity?.({
                name,
                description: description.trim(),
              })
              onOpenChange(false)
            }}
          >
            Add Site Amenity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {unsavedChangesDialog}
    </>
  )
}
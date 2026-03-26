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

export type AmenityEditPayload = {
  name: string
  description: string
}

type Amenity = {
  id: string
  name: string
  description: string
}

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
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  useEffect(() => {
    if (!open) return
    if (!amenityToEdit) return
    setName(amenityToEdit.name)
    setDescription(amenityToEdit.description)
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
          <DialogTitle>Edit Amenity</DialogTitle>
          <DialogDescription>Update the amenity name and description.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-amenity-name">Name</Label>
            <Input
              id="edit-amenity-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Amenity name"
              className="bg-card/50"
            />
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

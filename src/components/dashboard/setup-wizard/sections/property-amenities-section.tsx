"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useWizardFormStore } from "../wizard-form-store"
import { AddAmenitiesDialog } from "@/components/dashboard/settings/properties-amenities-dialog/add-amenities-dialog"
import { EditAmenitiesDialog, type AmenityEditPayload } from "@/components/dashboard/settings/properties-amenities-dialog/edit-amenities-dialog"
import { DeleteAmenitiesConfirmationDialog } from "@/components/dashboard/settings/properties-amenities-dialog/delete-amenities-confirmation-dialog"

type Amenity = { id: string; name: string; description: string }

interface Props {
  propertyId: string
}

export function PropertyAmenitiesSection({ propertyId }: Props) {
  const { saveDraft, getDraft } = useWizardFormStore()

  const [amenities, setAmenities] = useState<Amenity[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Amenity | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Amenity | null>(null)

  const pushDraft = (next: Amenity[]) => {
    const draft = getDraft(propertyId) ?? {}
    saveDraft(propertyId, { ...draft, amenities: next })
  }

  useEffect(() => {
    const draftAmenities = getDraft(propertyId)?.amenities
    if (draftAmenities) {
      setAmenities(draftAmenities)
      return
    }

    let cancelled = false
    setIsLoading(true)
    fetch(`/api/v1/properties/${propertyId}`)
      .then((r) => r.json())
      .then((result) => {
        if (cancelled) return
        const db = result.data?.amenities
        const next = Array.isArray(db) ? db : []
        setAmenities(next)
      })
      .catch(() => { })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const handleAdd = (amenity: { name: string; description: string }) => {
    const name = amenity.name.trim()
    if (!name) return
    const next = [...amenities, { id: crypto.randomUUID(), name, description: amenity.description.trim() }]
    setAmenities(next)
    pushDraft(next)
  }

  const handleEditSave = (payload: AmenityEditPayload) => {
    if (!editTarget) return
    const name = payload.name.trim()
    if (!name) return
    const next = amenities.map((a) => a.id === editTarget.id ? { ...a, name, description: payload.description.trim() } : a)
    setAmenities(next)
    pushDraft(next)
  }

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return
    const next = amenities.filter((a) => a.id !== deleteTarget.id)
    setAmenities(next)
    setIsDeleteOpen(false)
    setDeleteTarget(null)
    pushDraft(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1.5">
          <h3 className="text-lg font-semibold">Property amenities</h3>
          <p className="text-sm text-muted-foreground">Manage amenity options for this property</p>
        </div>
        <Button type="button" onClick={() => setIsAddOpen(true)} className="shrink-0">
          <Plus className="h-4 w-4" />
          Add Amenity
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : amenities.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="text-sm">No amenities added yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {amenities.map((amenity) => (
            <div key={amenity.id} className="rounded-md border border-border/80 bg-card/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{amenity.name}</p>
                  {amenity.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{amenity.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setEditTarget(amenity); setIsEditOpen(true) }} aria-label={`Edit ${amenity.name}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setDeleteTarget(amenity); setIsDeleteOpen(true) }} aria-label={`Delete ${amenity.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddAmenitiesDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onAddAmenity={handleAdd}
        existingAmenityNames={amenities.map((a) => a.name)}
      />
      <EditAmenitiesDialog
        open={isEditOpen}
        onOpenChange={(o) => { setIsEditOpen(o); if (!o) setEditTarget(null) }}
        amenityToEdit={editTarget}
        onSave={handleEditSave}
      />
      <DeleteAmenitiesConfirmationDialog
        open={isDeleteOpen}
        onOpenChange={(o) => { setIsDeleteOpen(o); if (!o) setDeleteTarget(null) }}
        amenityName={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Pencil, Trash2 } from "lucide-react"
import Image from "next/image"
import { useWizardFormStore } from "../wizard-form-store"
import { AddPropertyAmenitiesDialog } from "@/components/dashboard/settings/properties-amenities-dialog/add-property-amenities-dialog"
import {
  EditPropertyAmenitiesDialog,
  type PropertyAmenityEditPayload,
} from "@/components/dashboard/settings/properties-amenities-dialog/edit-property-amenities-dialog"
import { DeletePropertyAmenitiesDialog } from "@/components/dashboard/settings/properties-amenities-dialog/delete-property-amenities-dialog"

type Amenity = { id: string; name: string; description: string | null; icon_url?: string | null }

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

  const handleAdd = (amenity: { name: string; description: string; icon_url?: string | null }) => {
    const name = amenity.name.trim()
    if (!name) return
    const next = [...amenities, {
      id: crypto.randomUUID(),
      name,
      description: (amenity.description ?? "").trim() || null,
      icon_url: amenity.icon_url?.trim() || null,
    }]
    setAmenities(next)
    pushDraft(next)
  }

  const handleEditSave = (payload: PropertyAmenityEditPayload) => {
    if (!editTarget) return
    const name = payload.name.trim()
    if (!name) return
    const next = amenities.map((a) =>
      a.id === editTarget.id
        ? { ...a, name, description: (payload.description ?? "").trim() || null, icon_url: payload.icon_url?.trim() || null }
        : a,
    )
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
          <p className="text-sm text-muted-foreground">Configure the amenities available at your property.</p>
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
        <div className="rounded-md border border-dashed border-border/80 py-6 text-center text-muted-foreground">
          <p className="text-sm">No amenities added yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-border/60 overflow-hidden rounded-md border border-border/80 bg-card/50">
          {amenities.map((amenity) => (
            <div
              key={amenity.id}
              className="group flex items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-accent/40"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                {amenity.icon_url ? (
                  <Image
                    src={amenity.icon_url}
                    alt=""
                    width={18}
                    height={18}
                    className="shrink-0"
                  />
                ) : null}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium leading-tight">{amenity.name}</p>
                  {amenity.description && (
                    <p className="truncate text-xs text-muted-foreground">{amenity.description}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { setEditTarget(amenity); setIsEditOpen(true) }}
                  aria-label={`Edit ${amenity.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => { setDeleteTarget(amenity); setIsDeleteOpen(true) }}
                  aria-label={`Delete ${amenity.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddPropertyAmenitiesDialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onAddPropertyAmenity={handleAdd}
        existingPropertyAmenityNames={amenities.map((a) => a.name)}
      />
      <EditPropertyAmenitiesDialog
        open={isEditOpen}
        onOpenChange={(o) => { setIsEditOpen(o); if (!o) setEditTarget(null) }}
        amenityToEdit={editTarget}
        onSave={handleEditSave}
      />
      <DeletePropertyAmenitiesDialog
        open={isDeleteOpen}
        onOpenChange={(o) => { setIsDeleteOpen(o); if (!o) setDeleteTarget(null) }}
        amenityName={deleteTarget?.name}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

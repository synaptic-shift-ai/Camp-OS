"use client"

import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AddAmenitiesDialog } from "./properties-amenities-dialog/add-amenities-dialog"
import { EditAmenitiesDialog, type AmenityEditPayload } from "./properties-amenities-dialog/edit-amenities-dialog"
import { AddPropertyAmenitiesDialog } from "./properties-amenities-dialog/add-property-amenities-dialog"
import {
    EditPropertyAmenitiesDialog,
    type PropertyAmenityEditPayload,
} from "./properties-amenities-dialog/edit-property-amenities-dialog"
import {
    DeleteAmenitiesConfirmationDialog,
} from "./properties-amenities-dialog/delete-amenities-confirmation-dialog"
import { DeletePropertyAmenitiesDialog } from "./properties-amenities-dialog/delete-property-amenities-dialog"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"

type Amenity = {
    id: string
    name: string
    description: string
}

type PropertyAmenity = {
    id: string
    name: string
    description: string
    icon_url?: string | null
}

type PropertiesAmenitiesProps = {
    propertyId: string
}

export function PropertiesAmenities({ propertyId }: PropertiesAmenitiesProps) {
    const [isAddAmenitiesDialogOpen, setIsAddAmenitiesDialogOpen] = useState(false)
    const [isAddPropertyAmenitiesDialogOpen, setIsAddPropertyAmenitiesDialogOpen] = useState(false)
    const [amenities, setAmenities] = useState<Amenity[]>([])
    const [propertyAmenities, setPropertyAmenities] = useState<PropertyAmenity[]>([])
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
    const [amenityToEdit, setAmenityToEdit] = useState<Amenity | null>(null)
    const [isPropertyEditDialogOpen, setIsPropertyEditDialogOpen] = useState(false)
    const [propertyAmenityToEdit, setPropertyAmenityToEdit] = useState<PropertyAmenity | null>(null)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [amenityToDelete, setAmenityToDelete] = useState<Amenity | null>(null)
    const [isPropertyDeleteDialogOpen, setIsPropertyDeleteDialogOpen] = useState(false)
    const [propertyAmenityToDelete, setPropertyAmenityToDelete] = useState<PropertyAmenity | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
    const [isLoadingAmenities, setIsLoadingAmenities] = useState(false)

    const handleAddAmenitiesDialogOpenChange = (open: boolean) => {
        setIsAddAmenitiesDialogOpen(open)
    }

    const handleAddPropertyAmenitiesDialogOpenChange = (open: boolean) => {
        setIsAddPropertyAmenitiesDialogOpen(open)
    }

    const handleAddPropertyAmenity = (propertyAmenity: { name: string; description: string; icon_url?: string | null }) => {
        const normalizedName = propertyAmenity.name.trim()
        if (!normalizedName) return

        setPropertyAmenities((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                name: normalizedName,
                description: propertyAmenity.description.trim(),
                icon_url: propertyAmenity.icon_url?.trim() || null,
            },
        ])
    }

    const handleAddAmenity = (amenity: { name: string; description: string }) => {
        const normalizedName = amenity.name.trim()
        if (!normalizedName) return

        setAmenities((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                name: normalizedName,
                description: amenity.description.trim(),
            },
        ])
    }

    const handleEditDialogOpenChange = (open: boolean) => {
        setIsEditDialogOpen(open)
        if (!open) setAmenityToEdit(null)
    }

    const handleEditSave = (payload: AmenityEditPayload) => {
        if (!amenityToEdit) return

        const normalizedName = payload.name.trim()
        if (!normalizedName) return

        setAmenities((prev) =>
            prev.map((amenity) =>
                amenity.id === amenityToEdit.id
                    ? {
                        ...amenity,
                        name: normalizedName,
                        description: payload.description.trim(),
                    }
                    : amenity,
            ),
        )
        setPropertyAmenities((prev) =>
            prev,
        )
    }

    const openEditDialog = (amenity: Amenity) => {
        setAmenityToEdit(amenity)
        setIsEditDialogOpen(true)
    }

    const handlePropertyEditDialogOpenChange = (open: boolean) => {
        setIsPropertyEditDialogOpen(open)
        if (!open) setPropertyAmenityToEdit(null)
    }

    const handlePropertyEditSave = (payload: PropertyAmenityEditPayload) => {
        if (!propertyAmenityToEdit) return

        const normalizedName = payload.name.trim()
        if (!normalizedName) return

        setPropertyAmenities((prev) =>
            prev.map((amenity) =>
                amenity.id === propertyAmenityToEdit.id
                    ? {
                        ...amenity,
                        name: normalizedName,
                        description: payload.description.trim(),
                        icon_url: payload.icon_url?.trim() || null,
                    }
                    : amenity,
            ),
        )
    }

    const openPropertyEditDialog = (amenity: PropertyAmenity) => {
        setPropertyAmenityToEdit(amenity)
        setIsPropertyEditDialogOpen(true)
    }

    const handleDeleteDialogOpenChange = (open: boolean) => {
        setIsDeleteDialogOpen(open)
        if (!open) setAmenityToDelete(null)
    }

    const openDeleteDialog = (amenity: Amenity) => {
        setAmenityToDelete(amenity)
        setIsDeleteDialogOpen(true)
    }

    const handlePropertyDeleteDialogOpenChange = (open: boolean) => {
        setIsPropertyDeleteDialogOpen(open)
        if (!open) setPropertyAmenityToDelete(null)
    }

    const openPropertyDeleteDialog = (amenity: PropertyAmenity) => {
        setPropertyAmenityToDelete(amenity)
        setIsPropertyDeleteDialogOpen(true)
    }

    const handleDeleteConfirm = () => {
        if (!amenityToDelete) return

        setAmenities((prev) => prev.filter((amenity) => amenity.id !== amenityToDelete.id))
        setIsDeleteDialogOpen(false)
        setAmenityToDelete(null)
    }

    const handlePropertyDeleteConfirm = () => {
        if (!propertyAmenityToDelete) return

        setPropertyAmenities((prev) => prev.filter((amenity) => amenity.id !== propertyAmenityToDelete.id))
        setIsPropertyDeleteDialogOpen(false)
        setPropertyAmenityToDelete(null)
    }

    const handleSaveAmenities = async () => {
        if (isSaving) return
        setIsSaving(true)
        setSaveMessage(null)

        try {
            const payload = {
                amenities: propertyAmenities.map((amenity) => ({
                    id: amenity.id,
                    name: amenity.name,
                    description: amenity.description.trim() || null,
                    icon_url: amenity.icon_url?.trim() || null,
                })),

                site_amenities: amenities.map((amenity) => ({
                    id: amenity.id,
                    name: amenity.name,
                    description: amenity.description.trim() || null,
                })),
            }

            const response = await fetch(`/api/v1/properties/${propertyId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            })

            const result = await response.json()
            if (!response.ok || !result.success) {
                throw new Error(result.error?.message ?? "Failed to save amenities")
            }

            setSaveMessage({ type: "success", text: "Amenities saved." })
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to save amenities"
            setSaveMessage({ type: "error", text: message })
        } finally {
            setIsSaving(false)
        }
    }

    useEffect(() => {
        let cancelled = false

        const fetchAmenities = async () => {
            setIsLoadingAmenities(true)
            try {
                const response = await fetch(`/api/v1/properties/${propertyId}`)
                const result = await response.json()

                if (cancelled) return

                if (response.ok && result.success) {
                    const dbPropertyAmenities = result.data?.amenities
                    const dbSiteAmenities = result.data?.site_amenities

                    setPropertyAmenities(Array.isArray(dbPropertyAmenities) ? dbPropertyAmenities : [])
                    setAmenities(Array.isArray(dbSiteAmenities) ? dbSiteAmenities : [])
                } else {
                    throw new Error(result.error?.message ?? "Failed to fetch amenities")
                }
            } catch (err) {
                if (cancelled) return
                throw new Error(err instanceof Error ? err.message : "Failed to fetch amenities")
            } finally {
                if (!cancelled) setIsLoadingAmenities(false)
            }
        }

        fetchAmenities()

        return () => {
            cancelled = true
        }
    }, [propertyId])
    
    return (
        <>
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Property Amenities</CardTitle>
                            <CardDescription>Configure the amenities available at your property.</CardDescription>
                        </div>
                        <Button onClick={() => setIsAddPropertyAmenitiesDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add Property Amenity
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {saveMessage ? (
                        <Alert variant={saveMessage.type === "error" ? "destructive" : "default"} className="mb-3">
                            <AlertDescription>{saveMessage.text}</AlertDescription>
                        </Alert>
                    ) : null}
                    {isLoadingAmenities ? (
                        <div className="flex items-center justify-center py-10">
                            <div
                                className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
                                aria-busy="true"
                                aria-label="Loading amenities"
                            />
                        </div>
                    ) : propertyAmenities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No amenities added yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {propertyAmenities.map((amenity) => (
                                <div
                                    key={amenity.id}
                                    className="rounded-md border border-border/80 bg-card/50 p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold">{amenity.name}</p>
                                            {amenity.description ? (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {amenity.description}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="flex shrink-0 gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openPropertyEditDialog(amenity)}
                                                aria-label={`Edit ${amenity.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openPropertyDeleteDialog(amenity)}
                                                aria-label={`Delete ${amenity.name}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Site Amenities</CardTitle>
                            <CardDescription>Configure the amenities available at your sites.</CardDescription>
                        </div>
                        <Button onClick={() => setIsAddAmenitiesDialogOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add Site Amenity
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {saveMessage ? (
                        <Alert variant={saveMessage.type === "error" ? "destructive" : "default"} className="mb-3">
                            <AlertDescription>{saveMessage.text}</AlertDescription>
                        </Alert>
                    ) : null}
                    {isLoadingAmenities ? (
                        <div className="flex items-center justify-center py-10">
                            <div
                                className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
                                aria-busy="true"
                                aria-label="Loading amenities"
                            />
                        </div>
                    ) : amenities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No amenities added yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {amenities.map((amenity) => (
                                <div
                                    key={amenity.id}
                                    className="rounded-md border border-border/80 bg-card/50 p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold">{amenity.name}</p>
                                            {amenity.description ? (
                                                <p className="mt-1 text-xs text-muted-foreground">
                                                    {amenity.description}
                                                </p>
                                            ) : null}
                                        </div>

                                        <div className="flex shrink-0 gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openEditDialog(amenity)}
                                                aria-label={`Edit ${amenity.name}`}
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => openDeleteDialog(amenity)}
                                                aria-label={`Delete ${amenity.name}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button
                    type="button"
                    onClick={handleSaveAmenities}
                    disabled={isSaving}
                >
                    {isSaving ? "Saving..." : "Save Amenities"}
                </Button>
            </div>

            <AddAmenitiesDialog
                open={isAddAmenitiesDialogOpen}
                onOpenChange={handleAddAmenitiesDialogOpenChange}
                onAddAmenity={handleAddAmenity}
                existingAmenityNames={amenities.map((a) => a.name)}
            />

            <AddPropertyAmenitiesDialog
                open={isAddPropertyAmenitiesDialogOpen}
                onOpenChange={handleAddPropertyAmenitiesDialogOpenChange}
                onAddPropertyAmenity={handleAddPropertyAmenity}
                existingPropertyAmenityNames={propertyAmenities.map((a) => a.name)}
            />

            <EditAmenitiesDialog
                open={isEditDialogOpen}
                onOpenChange={handleEditDialogOpenChange}
                amenityToEdit={amenityToEdit}
                onSave={handleEditSave}
            />

            <EditPropertyAmenitiesDialog
                open={isPropertyEditDialogOpen}
                onOpenChange={handlePropertyEditDialogOpenChange}
                amenityToEdit={propertyAmenityToEdit}
                onSave={handlePropertyEditSave}
            />

            <DeleteAmenitiesConfirmationDialog
                open={isDeleteDialogOpen}
                onOpenChange={handleDeleteDialogOpenChange}
                amenityName={amenityToDelete?.name}
                onConfirm={handleDeleteConfirm}
            />

            <DeletePropertyAmenitiesDialog
                open={isPropertyDeleteDialogOpen}
                onOpenChange={handlePropertyDeleteDialogOpenChange}
                amenityName={propertyAmenityToDelete?.name}
                onConfirm={handlePropertyDeleteConfirm}
            />
        </>
    )
}
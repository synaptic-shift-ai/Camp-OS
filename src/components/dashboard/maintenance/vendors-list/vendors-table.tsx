"use client"

import { useState } from "react"
import { MoreHorizontal } from "lucide-react"

import {
  AddVendorDialog,
  type AddVendorInput,
} from "@/components/dashboard/maintenance/maintenance-dialog/add-vendor-dialog"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type VendorRow = {
  id: string
  displayId: string
  name: string
  service: string
  contact: string
  linkedWorkOrders: number | null
}

type VendorsTableProps = {
  propertyId: string
  vendors: VendorRow[]
  isAddVendorDialogOpen: boolean
  onAddVendorDialogOpenChange: (open: boolean) => void
  onVendorCreated?: () => void | Promise<void>
}

type VendorActionsMenuProps = {
  vendorName: string
  onEdit: () => void
  onDelete: () => void
}

function VendorActionsMenu({ vendorName, onEdit, onDelete }: VendorActionsMenuProps) {
  return (
    <div className="flex items-center justify-end">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="xs" aria-label={`Actions for ${vendorName}`} className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onEdit}>Edit vendor</DropdownMenuItem>
          <DropdownMenuItem onClick={onDelete} className="text-red-600 focus:text-red-600">
            Delete vendor
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function VendorsTable({
  propertyId,
  vendors,
  isAddVendorDialogOpen,
  onAddVendorDialogOpenChange,
  onVendorCreated,
}: VendorsTableProps) {
  const { toast } = useToast()
  const [editingVendor, setEditingVendor] = useState<VendorRow | null>(null)
  const [isSubmittingVendor, setIsSubmittingVendor] = useState(false)

  const handleAddVendor = async (input: AddVendorInput) => {
    setIsSubmittingVendor(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/vendors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      })
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to add vendor."
        throw new Error(message)
      }

      if (onVendorCreated) {
        await onVendorCreated()
      }

      toast({
        title: "Vendor added",
        description: "Vendor has been saved and is now available for work orders.",
      })
    } finally {
      setIsSubmittingVendor(false)
    }
  }

  const handleEditVendor = async (input: AddVendorInput) => {
    if (!editingVendor) return

    setIsSubmittingVendor(true)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/vendors/${editingVendor.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
        },
      )
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to update vendor."
        throw new Error(message)
      }

      if (onVendorCreated) {
        await onVendorCreated()
      }

      toast({
        title: "Vendor updated",
        description: "Vendor details were updated successfully.",
      })
    } finally {
      setIsSubmittingVendor(false)
    }
  }

  const handleDeleteVendor = async (vendor: VendorRow) => {
    const shouldDelete = window.confirm(`Delete vendor "${vendor.name}"?`)
    if (!shouldDelete) return

    setIsSubmittingVendor(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/vendors/${vendor.id}`, {
        method: "DELETE",
      })
      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        const message =
          payload?.error?.details?.message ??
          payload?.error?.message ??
          "Failed to delete vendor."
        throw new Error(message)
      }

      if (onVendorCreated) {
        await onVendorCreated()
      }

      toast({
        title: "Vendor deleted",
        description: "Vendor has been removed.",
      })
    } finally {
      setIsSubmittingVendor(false)
    }
  }

  return (
    <section className="space-y-4 rounded-2xl">
      <div className="space-y-2 md:hidden">
        {vendors.length === 0 ? (
          <div className="rounded-md border border-border/80 bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No vendors added yet.
          </div>
        ) : (
          vendors.map((vendor) => (
            <div key={vendor.id} className="rounded-md border border-border/80 bg-card/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold leading-tight text-foreground" title={vendor.name}>
                    {vendor.name}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground" title={vendor.service}>
                    {vendor.service}
                  </p>
                </div>
                <VendorActionsMenu
                  vendorName={vendor.name}
                  onEdit={() => setEditingVendor(vendor)}
                  onDelete={() => void handleDeleteVendor(vendor)}
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{vendor.displayId}</p>
                <p className="truncate text-[11px] text-muted-foreground" title={vendor.contact}>
                  {vendor.contact}
                </p>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/70 pt-2 text-xs">
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground">Linked WOs</p>
                  <p className="mt-1 text-sm text-foreground">{vendor.linkedWorkOrders ?? "—"}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto border border-border/80 bg-card/50 md:block">
        <Table className="w-full min-w-[860px] table-fixed text-xs lg:min-w-0">
          <colgroup>
            <col className="w-[14%]" />
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-[24%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-red-50 uppercase dark:bg-red-950/30">
            <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">ID</TableHead>
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">
                Vendor
              </TableHead>
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">
                Service
              </TableHead>
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">
                Contact
              </TableHead>
              <TableHead className="px-2 py-2 font-medium text-black/90 dark:text-white/90">
                Linked WOs
              </TableHead>
              <TableHead className="px-1 py-2 text-right font-medium text-black/90 dark:text-white/90">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vendors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No vendors added yet.
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((vendor) => (
                <TableRow
                  key={vendor.id}
                  className="border-border/80 hover:bg-muted/30 data-[state=selected]:bg-muted/30"
                >
                  <TableCell className="whitespace-nowrap px-3 py-2 text-sm font-medium text-foreground">
                    {vendor.displayId}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <span className="block truncate text-sm text-foreground" title={vendor.name}>
                      {vendor.name}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                    <span className="block truncate" title={vendor.service}>
                      {vendor.service}
                    </span>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                    <span className="block truncate" title={vendor.contact}>
                      {vendor.contact}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-2 text-sm text-muted-foreground">
                    {vendor.linkedWorkOrders ?? "—"}
                  </TableCell>
                  <TableCell className="px-1 py-2">
                    <VendorActionsMenu
                      vendorName={vendor.name}
                      onEdit={() => setEditingVendor(vendor)}
                      onDelete={() => void handleDeleteVendor(vendor)}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <AddVendorDialog
        open={isAddVendorDialogOpen}
        onOpenChange={onAddVendorDialogOpenChange}
        isSubmitting={isSubmittingVendor}
        onSubmit={handleAddVendor}
      />
      <AddVendorDialog
        open={editingVendor !== null}
        onOpenChange={(open) => {
          if (!open) setEditingVendor(null)
        }}
        isSubmitting={isSubmittingVendor}
        title="Edit Vendor"
        description="Update this vendor's details."
        submitLabel="Save changes"
        submittingLabel="Saving..."
        initialValues={
          editingVendor
            ? {
                name: editingVendor.name,
                serviceType: editingVendor.service,
                email: editingVendor.contact === "—" ? "" : editingVendor.contact,
              }
            : null
        }
        onSubmit={handleEditVendor}
      />
    </section>
  )
}

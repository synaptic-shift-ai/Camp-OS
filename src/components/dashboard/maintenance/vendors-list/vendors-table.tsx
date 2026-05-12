"use client"

import { useState } from "react"
import { Loader2, MoreHorizontal, Trash2 } from "lucide-react"
import { VendorDetailDialog, type VendorDetailDialogTarget } from "@/components/dashboard/maintenance/vendors-list/vendor-detail-dialog"

import {
  AddVendorDialog,
  type AddVendorInput,
} from "@/components/dashboard/maintenance/maintenance-dialog/add-vendor-dialog"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  phone: string | null
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
  const [vendorToDelete, setVendorToDelete] = useState<VendorRow | null>(null)
  const [isDeletingVendor, setIsDeletingVendor] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState<VendorDetailDialogTarget | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  const openVendorDetail = (vendor: VendorRow) => {
    setSelectedVendor({
      id: vendor.id,
      displayId: vendor.displayId,
      name: vendor.name,
      service: vendor.service,
      contact: vendor.contact,
      phone: vendor.phone,
      linkedWorkOrders: vendor.linkedWorkOrders,
    })
    setDetailDialogOpen(true)
  }

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
        variant: "success",
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
        variant: "success",
      })
    } finally {
      setIsSubmittingVendor(false)
    }
  }

  const handleDeleteVendor = async () => {
    if (!vendorToDelete) return

    setIsDeletingVendor(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/vendors/${vendorToDelete.id}`, {
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
        variant: "success",
      })
      setVendorToDelete(null)
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Failed to delete vendor."
      toast({
        title: "Unable to delete vendor",
        description: message,
        variant: "destructive",
      })
    } finally {
      setIsDeletingVendor(false)
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
            <div
              key={vendor.id}
              className="cursor-pointer rounded-md border border-border/80 bg-card/50 p-3 transition-colors hover:bg-muted/50"
              onClick={() => openVendorDetail(vendor)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold leading-tight text-foreground" title={vendor.name}>
                    {vendor.name}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground" title={vendor.service}>
                    {vendor.service}
                  </p>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <VendorActionsMenu
                    vendorName={vendor.name}
                    onEdit={() => setEditingVendor(vendor)}
                    onDelete={() => setVendorToDelete(vendor)}
                  />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{vendor.displayId}</p>
                <p className="truncate text-[11px] text-muted-foreground" title={vendor.contact}>
                  {vendor.contact}
                </p>
              </div>

              <div className="mt-2 flex items-center justify-between gap-4 border-t border-border/70 pt-2 text-xs">
                <div>
                  <p className="uppercase tracking-wide text-muted-foreground">Phone</p>
                  <p className="mt-1 text-sm text-foreground">{vendor.phone ?? "—"}</p>
                </div>
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
        <Table className="w-full min-w-[700px] table-fixed text-xs lg:min-w-0">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[7%]" />
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
              <TableHead className="px-3 py-2 font-medium text-black/90 dark:text-white/90">
                Phone
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
                <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                  No vendors added yet.
                </TableCell>
              </TableRow>
            ) : (
              vendors.map((vendor) => (
                <TableRow
                  key={vendor.id}
                  className="border-border/80 cursor-pointer hover:bg-muted/50 data-[state=selected]:bg-muted/30"
                  onClick={() => openVendorDetail(vendor)}
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
                  <TableCell className="px-3 py-2 text-sm text-muted-foreground">
                    <span className="block truncate" title={vendor.phone ?? undefined}>
                      {vendor.phone ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap px-2 py-2 text-sm text-muted-foreground">
                    {vendor.linkedWorkOrders ?? "—"}
                  </TableCell>
                  <TableCell
                    className="px-1 py-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <VendorActionsMenu
                      vendorName={vendor.name}
                      onEdit={() => setEditingVendor(vendor)}
                      onDelete={() => setVendorToDelete(vendor)}
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
                phone: editingVendor.phone ?? "",
              }
            : null
        }
        onSubmit={handleEditVendor}
      />
      <VendorDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        vendor={selectedVendor}
      />
      <AlertDialog open={vendorToDelete !== null} onOpenChange={(open) => {
        if (!open) setVendorToDelete(null)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete vendor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">{vendorToDelete?.name}</span>.{" "}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingVendor}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteVendor()
              }}
              disabled={isDeletingVendor}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingVendor ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete vendor
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

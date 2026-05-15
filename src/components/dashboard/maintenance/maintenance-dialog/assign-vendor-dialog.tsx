"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Loader2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"

type VendorOption = {
  id: string
  label: string
}

type AssignVendorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  isSubmitting?: boolean
  onSubmit: (vendorId: string) => Promise<void>
}

export function AssignVendorDialog({
  open,
  onOpenChange,
  propertyId,
  isSubmitting = false,
  onSubmit,
}: AssignVendorDialogProps) {
  const [vendorOptions, setVendorOptions] = useState<VendorOption[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  const [isLoadingVendors, setIsLoadingVendors] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cleanFormRef = useRef<string>("")

  useEffect(() => {
    if (!open) return
    setError(null)
    setSelectedVendorId("")
    cleanFormRef.current = JSON.stringify({ selectedVendorId: "" })
    setIsLoadingVendors(true)

    fetch(`/api/v1/properties/${propertyId}/vendors`)
      .then((res) => res.json())
      .then((payload) => {
        if (!payload?.success) return
        const options = payload.data?.vendorOptions as VendorOption[] | undefined
        if (Array.isArray(options)) setVendorOptions(options)
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        setIsLoadingVendors(false)
      })
  }, [open, propertyId])

  const isDirty = JSON.stringify({ selectedVendorId }) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const handleSubmit = async () => {
    if (!selectedVendorId) return
    setError(null)
    try {
      await onSubmit(selectedVendorId)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to assign vendor."
      setError(message)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Assign to Vendor
          </DialogTitle>
          <DialogDescription>
            Select a vendor to assign this work order to. The status will change to
            &ldquo;In Progress (Vendor)&rdquo;.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="vendor-select">Vendor</Label>
          {isLoadingVendors ? (
            <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading vendors…
            </div>
          ) : vendorOptions.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-center text-sm">
              <p className="text-muted-foreground">No vendors available for this property.</p>
              <Link
                href={`/dashboard/${propertyId}/maintenance`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                onClick={() => onOpenChange(false)}
              >
                Add a vendor first
              </Link>
            </div>
          ) : (
            <Select value={selectedVendorId} onValueChange={setSelectedVendorId}>
              <SelectTrigger id="vendor-select">
                <SelectValue placeholder="Choose a vendor…" />
              </SelectTrigger>
              <SelectContent>
                {vendorOptions.map((vendor) => (
                  <SelectItem key={vendor.id} value={vendor.id}>
                    {vendor.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => guardedOnOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!selectedVendorId || isSubmitting || isLoadingVendors || vendorOptions.length === 0}
            onClick={() => void handleSubmit()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning…
              </>
            ) : (
              "Assign"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {unsavedChangesDialog}
    </>
  )
}

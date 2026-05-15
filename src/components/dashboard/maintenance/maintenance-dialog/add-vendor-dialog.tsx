"use client"

import { useEffect, useRef, useState } from "react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export type AddVendorInput = {
  name: string
  serviceType: string
  email?: string | null
  phone?: string | null
}

type AddVendorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  isSubmitting?: boolean
  title?: string
  description?: string
  submitLabel?: string
  submittingLabel?: string
  initialValues?: AddVendorInput | null
  onSubmit: (input: AddVendorInput) => Promise<void>
}

const INITIAL_FORM: AddVendorInput = {
  name: "",
  serviceType: "",
  email: "",
  phone: "",
}

export function AddVendorDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
  title = "Add Vendor",
  description = "Add a property vendor so it can be linked to maintenance work orders.",
  submitLabel = "Add vendor",
  submittingLabel = "Saving...",
  initialValues = null,
}: AddVendorDialogProps) {
  const [form, setForm] = useState<AddVendorInput>(INITIAL_FORM)
  const [error, setError] = useState<string | null>(null)
  const cleanFormRef = useRef<string>("")

  useEffect(() => {
    if (!open) return
    const newForm = initialValues ?? INITIAL_FORM
    setForm(newForm)
    cleanFormRef.current = JSON.stringify(newForm)
    setError(null)
  }, [open, initialValues])

  const isDirty = JSON.stringify(form) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const name = form.name.trim()
    const serviceType = form.serviceType.trim()
    const email = form.email?.trim() ? form.email.trim() : null
    const phone = form.phone?.trim() ? form.phone.trim() : null

    if (!name || !serviceType) {
      setError("Vendor name and service type are required.")
      return
    }

    try {
      await onSubmit({
        name,
        serviceType,
        email,
        phone,
      })
      onOpenChange(false)
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to save vendor."
      setError(message)
    }
  }

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
        <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>
                {description}
                </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit}>
                {error ? (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor="vendor-name">Vendor Name *</Label>
                        <Input
                        id="vendor-name"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder="e.g. PipeRight Plumbing"
                        required
                        disabled={isSubmitting}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="vendor-email">Email</Label>
                        <Input
                        id="vendor-email"
                        type="email"
                        value={form.email ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                        placeholder="dispatch@example.com"
                        disabled={isSubmitting}
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="vendor-phone">Phone</Label>
                    <Input
                        id="vendor-phone"
                        type="tel"
                        value={form.phone ?? ""}
                        onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                        placeholder="(555) 123-4567"
                        disabled={isSubmitting}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="vendor-service-type">Service Type *</Label>
                    <Input
                        id="vendor-service-type"
                        value={form.serviceType}
                        onChange={(event) =>
                        setForm((prev) => ({ ...prev, serviceType: event.target.value }))
                        }
                        placeholder="e.g. Plumbing"
                        required
                        disabled={isSubmitting}
                    />
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
                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? submittingLabel : submitLabel}
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
    </Dialog>
  )
}

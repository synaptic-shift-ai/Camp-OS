'use client'

/**
 * Add Guest Dialog
 *
 * Dialog form to create a new guest. Submits to POST /api/v1/properties/[propertyId]/guests.
 * Required: firstName, lastName, email, phone. Optional: emergency contact, notes.
 */

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { useToast } from '@/hooks/use-toast'
import { useDialogCloseGuard } from '@/hooks/use-dialog-close-guard'
import { Loader2 } from 'lucide-react'

interface AddGuestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  // emergencyContactName: '',
  // emergencyContactPhone: '',
  // notes: '',
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function AddGuestDialog({
  open,
  onOpenChange,
  propertyId,
}: AddGuestDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [form, setForm] = useState(initialForm)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(initialForm)
      setError(null)
    }
  }, [open])

  const cleanFormRef = useRef("")
  useEffect(() => {
    if (open) {
      cleanFormRef.current = JSON.stringify(initialForm)
    }
  }, [open])
  const isDirty = JSON.stringify(form) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const trimmed = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      // emergencyContactName: form.emergencyContactName.trim() || undefined,
      // emergencyContactPhone: form.emergencyContactPhone.trim() || undefined,
      // notes: form.notes.trim() || undefined,
    }
    if (!trimmed.firstName || !trimmed.lastName || !trimmed.email || !trimmed.phone) {
      setError('First name, last name, email, and phone are required.')
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}/guests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmed),
      })
      const data = await response.json()
      if (!response.ok) {
        const message =
          data?.error?.message ?? (typeof data?.error === 'string' ? data.error : 'Failed to create guest')
        throw new Error(message)
      }
      toast({
        title: 'Guest added',
        description: `${trimmed.firstName} ${trimmed.lastName} has been added to your guest list.`,
        className: SEASON_ALERT_TOAST_CLASS,
        variant: "success",
      })
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast({
        title: 'Add guest failed',
        description: err instanceof Error ? err.message : 'Failed to create guest',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Guest</DialogTitle>
          <DialogDescription>
            Add a new guest to your database. All fields marked with * are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name *</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={handleChange('firstName')}
                placeholder="Jane"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name *</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={handleChange('lastName')}
                placeholder="Doe"
                maxLength={100}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="jane@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <PhoneInput
              value={form.phone}
              onChange={(value) => setForm(prev => ({ ...prev, phone: value }))}
              id="phone"
            />
          </div>
          {/* <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="emergencyContactName">Emergency contact name</Label>
              <Input
                id="emergencyContactName"
                value={form.emergencyContactName}
                onChange={handleChange('emergencyContactName')}
                placeholder="John Doe"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergencyContactPhone">Emergency contact phone</Label>
              <Input
                id="emergencyContactPhone"
                type="tel"
                value={form.emergencyContactPhone}
                onChange={handleChange('emergencyContactPhone')}
                placeholder="(555) 987-6543"
                maxLength={20}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={handleChange('notes')}
              placeholder="Optional notes about this guest"
              rows={2}
              maxLength={1000}
              className="resize-none"
            />
          </div> */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                'Add Guest'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    {unsavedChangesDialog}
    </>
  )
}

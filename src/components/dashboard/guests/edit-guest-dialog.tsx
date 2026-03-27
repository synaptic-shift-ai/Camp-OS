'use client'

/**
 * Edit Guest Dialog
 *
 * Dialog form to update an existing guest's information.
 * Submits to PATCH /api/v1/guests/[id].
 */

import { useState, useEffect } from 'react'
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
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'
import type { DashboardGuest } from '@/lib/dashboard/queries'

interface EditGuestDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guest: DashboardGuest
}

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function EditGuestDialog({ open, onOpenChange, guest }: EditGuestDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const nameParts = guest.name.split(' ')
  const [form, setForm] = useState({
    firstName: nameParts[0] ?? '',
    lastName: nameParts.slice(1).join(' ') ?? '',
    email: guest.email,
    phone: guest.phone ?? '',
  })

  useEffect(() => {
    if (open) {
      const parts = guest.name.split(' ')
      setForm({
        firstName: parts[0] ?? '',
        lastName: parts.slice(1).join(' ') ?? '',
        email: guest.email,
        phone: guest.phone ?? '',
      })
      setFormError(null)
    }
  }, [open, guest])

  const handleChange = (field: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const trimmed = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
    }

    if (!trimmed.firstName || !trimmed.lastName || !trimmed.email || !trimmed.phone) {
      setFormError('All fields are required.')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/v1/guests/${guest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmed),
      })
      const data = await response.json()
      if (!response.ok) {
        const message =
          data?.error?.message ?? (typeof data?.error === 'string' ? data.error : 'Failed to update guest')
        throw new Error(message)
      }
      toast({
        title: 'Guest updated',
        description: `${trimmed.firstName} ${trimmed.lastName} has been updated.`,
        className: SEASON_ALERT_TOAST_CLASS,
      })
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast({
        title: 'Update guest failed',
        description: err instanceof Error ? err.message : 'Failed to update guest',
        variant: 'destructive',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Guest</DialogTitle>
          <DialogDescription>
            Update guest information. All fields are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-firstName">First name</Label>
              <Input
                id="edit-firstName"
                value={form.firstName}
                onChange={handleChange('firstName')}
                placeholder="Jane"
                maxLength={100}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-lastName">Last name</Label>
              <Input
                id="edit-lastName"
                value={form.lastName}
                onChange={handleChange('lastName')}
                placeholder="Doe"
                maxLength={100}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              value={form.email}
              onChange={handleChange('email')}
              placeholder="jane@example.com"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              placeholder="(555) 123-4567"
              maxLength={20}
              required
            />
          </div>
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
                  Saving…
                </>
              ) : (
                'Save changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

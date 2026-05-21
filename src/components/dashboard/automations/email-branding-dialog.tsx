"use client"

import { useEffect, useState } from "react"
import { Loader2, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"

type EmailBrandingDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

type BrandingForm = {
  senderName: string
  senderEmail: string
  replyToEmail: string
}

const DEFAULT_FORM: BrandingForm = {
  senderName: "",
  senderEmail: "",
  replyToEmail: "",
}

export function EmailBrandingDialog({
  open,
  onOpenChange,
  propertyId,
}: EmailBrandingDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BrandingForm>(DEFAULT_FORM)
  const [originalForm, setOriginalForm] = useState<BrandingForm>(DEFAULT_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function fetchBranding() {
      try {
        setLoading(true)
        setError(null)

        const res = await fetch(`/api/v1/communications/branding?propertyId=${propertyId}`)
        const json = await res.json()

        if (cancelled) return

        if (!json.success) {
          throw new Error(json.error?.message ?? "Failed to load branding.")
        }

        const branding = json.data.branding
        const loaded = {
          senderName: branding.senderName ?? "",
          senderEmail: branding.senderEmail ?? "",
          replyToEmail: branding.replyToEmail ?? "",
        }

        setForm(loaded)
        setOriginalForm(loaded)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load branding.")
          setForm(DEFAULT_FORM)
          setOriginalForm(DEFAULT_FORM)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchBranding()

    return () => {
      cancelled = true
    }
  }, [open, propertyId])

  const isDirty = JSON.stringify(form) !== JSON.stringify(originalForm)

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
    message: "You have unsaved changes. Would you like to save before leaving?",
  })

  const canSave = form.replyToEmail.trim() !== ""

  async function handleSave() {
    if (!canSave) return

    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`/api/v1/communications/branding?propertyId=${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyToEmail: form.replyToEmail.trim() || null,
        }),
      })
      const json = await res.json()

      if (!json.success) {
        throw new Error(json.error?.message ?? "Could not save branding.")
      }

      const saved = {
        senderName: json.data.branding.senderName ?? form.senderName.trim(),
        senderEmail: json.data.branding.senderEmail ?? form.senderEmail.trim(),
        replyToEmail: json.data.branding.replyToEmail ?? "",
      }

      setForm(saved)
      setOriginalForm(saved)
      toast({
        title: "Reply-to saved",
        description: "Reply-to email has been updated.",
        variant: "success",
      })
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save branding."
      setError(message)
      toast({
        title: "Save failed",
        description: message,
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set Reply To</DialogTitle>
          <DialogDescription>
            Configure the reply-to email address guests use to respond to automated emails.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-2">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="automation-branding-reply-to">
                Reply-to email <span className="text-xs text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="automation-branding-reply-to"
                type="email"
                value={form.replyToEmail}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  replyToEmail: event.target.value,
                }))}
                placeholder="replies@example.com"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => guardedOnOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || saving || !isDirty || !canSave}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {unsavedChangesDialog}
    </>
  )
}

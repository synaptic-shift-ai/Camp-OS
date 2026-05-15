"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import { Palette, RotateCcw, Save, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { ImageUpload } from "@/components/ui/image-upload"
import { PermissionGate } from "@/components/ui/permission-gate"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import {
  DEFAULT_EMAIL_SETTINGS,
  extractEmailSettings,
  wrapWithEmailLayout,
  stripEmailSettings,
  replaceVariables,
} from "@/lib/email/template-renderer"
import { getSampleData } from "@/lib/email/variable-definitions"

const PANEL = "text-stone-900 dark:text-zinc-100"
const CARD = "rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90"

type BrandingForm = {
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
  senderName: string
  senderEmail: string
  replyToEmail: string
}

const SAMPLE_HTML = `<!--email-settings:${typeof window !== "undefined" ? btoa(JSON.stringify(DEFAULT_EMAIL_SETTINGS)) : ""}--><h1 style="font-size:22px;font-weight:bold;margin-bottom:16px;">Welcome, {{guest.first_name}}!</h1><p style="margin-bottom:12px;">Thank you for booking at <strong>{{property.name}}</strong>. We're looking forward to your stay from {{reservation.check_in_date}} to {{reservation.check_out_date}}.</p><p style="margin-bottom:12px;">If you have any questions before your arrival, don't hesitate to reach out.</p><p>Best regards,<br/>{{property.name}} Team</p>`

const DEFAULT_FORM: BrandingForm = {
  logoUrl: null,
  primaryColor: "#000000",
  secondaryColor: "#666666",
  senderName: "",
  senderEmail: "",
  replyToEmail: "",
}

export function EmailBrandingPanel({
  propertyId,
  propertyName,
}: {
  propertyId: string
  propertyName: string
}) {
  const { toast } = useToast()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(400)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BrandingForm>({
    ...DEFAULT_FORM,
    senderName: propertyName,
  })
  const [originalForm, setOriginalForm] = useState<BrandingForm | null>(null)

  // Fetch existing branding
  useEffect(() => {
    let cancelled = false
    async function fetchBranding() {
      try {
        setLoading(true)
        const res = await fetch(`/api/v1/communications/branding?propertyId=${propertyId}`)
        const json = await res.json()
        if (cancelled || !json.success) return

        const b = json.data.branding
        const loaded: BrandingForm = {
          logoUrl: b.logoUrl ?? null,
          primaryColor: b.primaryColor ?? "#000000",
          secondaryColor: b.secondaryColor ?? "#666666",
          senderName: b.senderName ?? propertyName,
          senderEmail: b.senderEmail ?? "",
          replyToEmail: b.replyToEmail ?? "",
        }
        setForm(loaded)
        setOriginalForm(loaded)
      } catch {
        // Branding not configured yet — show empty state
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchBranding()
    return () => { cancelled = true }
  }, [propertyId, propertyName])

  // Live preview
  const srcDoc = useMemo(() => {
    try {
      const settings = extractEmailSettings(SAMPLE_HTML) ?? DEFAULT_EMAIL_SETTINGS
      const content = stripEmailSettings(SAMPLE_HTML)
      const sample = getSampleData()
      const rendered = replaceVariables(content, sample)
      const branded = wrapWithEmailLayout(rendered, settings, {
        logoUrl: form.logoUrl,
        primaryColor: form.primaryColor,
        secondaryColor: form.secondaryColor,
        senderName: form.senderName || propertyName,
        propertyName,
      })
      return branded
    } catch {
      return "<p style='padding:24px;color:#666;'>Unable to render preview</p>"
    }
  }, [form, propertyName])

  // Resize iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!doc) return
    const next = Math.max(
      320,
      Math.ceil(Math.max(doc.body?.scrollHeight ?? 0, doc.documentElement?.scrollHeight ?? 0)),
    )
    setIframeHeight(next)
  }, [srcDoc])

  const handleSave = async () => {
    try {
      setSaving(true)
      const res = await fetch(`/api/v1/communications/branding?propertyId=${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logoUrl: form.logoUrl,
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          senderName: form.senderName,
          senderEmail: form.senderEmail || null,
          replyToEmail: form.replyToEmail || null,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setOriginalForm({ ...form })
        toast({ title: "Branding saved", description: "Email branding updated successfully.", variant: "success" })
      } else {
        toast({ title: "Save failed", description: json.error?.message ?? "Could not save branding.", variant: "destructive" })
      }
    } catch {
      toast({ title: "Save failed", description: "Network error. Please try again.", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (originalForm) {
      setForm({ ...originalForm })
    } else {
      setForm({ ...DEFAULT_FORM, senderName: propertyName })
    }
  }

  const isDirty = JSON.stringify(form) !== JSON.stringify(originalForm ?? { ...DEFAULT_FORM, senderName: propertyName })

  if (loading) {
    return (
      <div className={cn("space-y-6", PANEL)} id="guest-comm-panel-branding" role="tabpanel" aria-labelledby="guest-comm-tab-branding">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-[400px] w-full" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", PANEL)} id="guest-comm-panel-branding" role="tabpanel" aria-labelledby="guest-comm-tab-branding">
      <header className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-50 sm:text-3xl">
          Email branding
        </h2>
        <p className="text-sm text-stone-500 dark:text-zinc-400">
          Customise how your emails look to guests.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left — Form */}
        <PermissionGate permission="guest_comms.configure_branding" fallback={
          <div className={cn(CARD, "flex flex-col items-center justify-center gap-3 py-12")}>
            <Palette className="h-10 w-10 text-stone-400 dark:text-zinc-500" aria-hidden />
            <p className="text-sm font-medium text-stone-600 dark:text-zinc-300">Read-only</p>
            <p className="text-xs text-stone-500 dark:text-zinc-400">
              You don&apos;t have permission to edit branding settings.
            </p>
          </div>
        }>
          <div className="space-y-5">
            {/* Logo */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-stone-700 dark:text-zinc-200">Logo</Label>
              <ImageUpload
                value={form.logoUrl}
                onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
                placeholder="Upload your property logo"
                className="max-w-xs"
              />
            </div>

            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="branding-primary-color" className="text-sm font-medium text-stone-700 dark:text-zinc-200">
                Primary Color
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="branding-primary-color"
                  type="color"
                  value={form.primaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                  className="h-10 w-10 cursor-pointer rounded border border-stone-200 bg-transparent p-1 dark:border-zinc-700"
                />
                <Input
                  value={form.primaryColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setForm((f) => ({ ...f, primaryColor: v }))
                    }
                  }}
                  placeholder="#000000"
                  maxLength={7}
                  className="h-10 flex-1 border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            {/* Secondary Color */}
            <div className="space-y-2">
              <Label htmlFor="branding-secondary-color" className="text-sm font-medium text-stone-700 dark:text-zinc-200">
                Secondary Color
              </Label>
              <div className="flex items-center gap-2">
                <input
                  id="branding-secondary-color"
                  type="color"
                  value={form.secondaryColor}
                  onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                  className="h-10 w-10 cursor-pointer rounded border border-stone-200 bg-transparent p-1 dark:border-zinc-700"
                />
                <Input
                  value={form.secondaryColor}
                  onChange={(e) => {
                    const v = e.target.value
                    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
                      setForm((f) => ({ ...f, secondaryColor: v }))
                    }
                  }}
                  placeholder="#666666"
                  maxLength={7}
                  className="h-10 flex-1 border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            </div>

            {/* Sender Name */}
            <div className="space-y-2">
              <Label htmlFor="branding-sender-name" className="text-sm font-medium text-stone-700 dark:text-zinc-200">
                Sender Name
              </Label>
              <Input
                id="branding-sender-name"
                value={form.senderName}
                onChange={(e) => setForm((f) => ({ ...f, senderName: e.target.value }))}
                placeholder="Property name"
                className="h-10 border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            {/* Sender Email */}
            <div className="space-y-2">
              <Label htmlFor="branding-sender-email" className="text-sm font-medium text-stone-700 dark:text-zinc-200">
                Sender Email
              </Label>
              <Input
                id="branding-sender-email"
                type="email"
                value={form.senderEmail}
                onChange={(e) => setForm((f) => ({ ...f, senderEmail: e.target.value }))}
                placeholder="hello@example.com"
                className="h-10 border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            {/* Reply-To Email */}
            <div className="space-y-2">
              <Label htmlFor="branding-reply-to" className="text-sm font-medium text-stone-700 dark:text-zinc-200">
                Reply-To Email <span className="text-xs text-stone-400">(optional)</span>
              </Label>
              <Input
                id="branding-reply-to"
                type="email"
                value={form.replyToEmail}
                onChange={(e) => setForm((f) => ({ ...f, replyToEmail: e.target.value }))}
                placeholder="replies@example.com"
                className="h-10 border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="h-10 px-5 bg-[hsl(142.1,76.2%,32%)] text-white hover:bg-[hsl(142.1,76.2%,28%)]"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleReset}
                disabled={saving || !isDirty}
                className="h-10 border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </PermissionGate>

        {/* Right — Live Preview */}
        <div className={cn(CARD, "space-y-3")}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-50">Live preview</h3>
            <span className="text-xs text-stone-500 dark:text-zinc-400">Sample email</span>
          </div>
          <div className="overflow-hidden rounded-md border border-border/80 bg-stone-50 dark:bg-zinc-950">
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              sandbox="allow-same-origin"
              title="Branded Email Preview"
              className="w-full border-0"
              style={{ height: `${iframeHeight}px` }}
              onLoad={() => {
                const iframe = iframeRef.current
                if (!iframe) return
                const doc = iframe.contentDocument
                if (!doc) return
                const next = Math.max(
                  320,
                  Math.ceil(Math.max(doc.body?.scrollHeight ?? 0, doc.documentElement?.scrollHeight ?? 0)),
                )
                setIframeHeight(next)
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RichEditor, type RichEditorHandle } from "@/components/ui/rich-editor"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CampaignVariablePanel } from "./campaign-variable-panel"
import { CampaignScheduleDialog } from "./campaign-schedule-dialog"
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  AlertCircle,
  Braces,
  Mail,
  MessageSquare,
  Send,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

type CampaignEditorPageProps = {
  propertyId: string
  companyId: string
  campaign?: Record<string, unknown> | null
}

type CampaignForm = {
  name: string
  channel: "email" | "sms" | "both"
  segment_type: string
  subject: string
  body: string
  smsBody: string
}

type PreviewData = {
  recipient_count: number
  sample_messages: {
    guest_id: string
    guest_name: string
    personalized_subject: string
    personalized_body: string
  }[]
  warnings: string[]
}

// ============================================================================
// Constants
// ============================================================================

const INITIAL_FORM: CampaignForm = {
  name: "",
  channel: "email",
  segment_type: "all_guests",
  subject: "",
  body: "",
  smsBody: "",
}

function resolveTemplateId(
  channel: CampaignForm["channel"],
  selectedEmailTemplateId: string,
  selectedSmsTemplateId: string,
): string | null {
  if (channel === "email") {
    return selectedEmailTemplateId && selectedEmailTemplateId !== "__none__"
      ? selectedEmailTemplateId
      : null
  }
  if (channel === "sms") {
    return selectedSmsTemplateId && selectedSmsTemplateId !== "__none__"
      ? selectedSmsTemplateId
      : null
  }
  return null
}

function buildCampaignPayload(
  form: CampaignForm,
  selectedEmailTemplateId: string,
  selectedSmsTemplateId: string,
  statusOverride?: string,
) {
  return {
    name: form.name,
    channel: form.channel,
    segment_type: form.segment_type,
    subject: form.channel === "sms" ? undefined : form.subject,
    body: form.channel === "sms" ? form.body : form.body,
    template_id: resolveTemplateId(form.channel, selectedEmailTemplateId, selectedSmsTemplateId),
    ...(statusOverride ? { status: statusOverride } : {}),
  }
}

const SEGMENT_TYPES = [
  { value: "all_guests", label: "All Guests" },
  { value: "specific_guest", label: "Specific Guest" },
  { value: "bookings_this_month", label: "Bookings This Month" },
  { value: "by_location", label: "By Location" },
  { value: "by_season", label: "By Season" },
  { value: "upcoming_bookings", label: "Upcoming Bookings" },
  { value: "past_guests", label: "Past Guests" },
  { value: "email_opt_in", label: "Email Opt-In" },
  { value: "sms_opt_in", label: "SMS Opt-In" },
]

// ============================================================================
// Preview sub-components
// ============================================================================

function EmailPreviewFrame({ html }: { html: string; subject?: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const handler = () => {
      const doc = iframe.contentDocument
      if (doc?.body) {
        iframe.style.height = doc.body.scrollHeight + 'px'
      }
    }
    iframe.addEventListener('load', handler)
    return () => iframe.removeEventListener('load', handler)
  }, [html])

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-md border border-border bg-[#f6f9fc]">
      <iframe
        ref={iframeRef}
        srcDoc={html}
        sandbox="allow-same-origin"
        className="block w-full min-w-0 max-w-full border-0 bg-white"
        style={{ minHeight: '200px' }}
        title="Email preview"
      />
    </div>
  )
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function SmsBodyPreview({ text }: { text: string }) {
  const charCount = text.length
  const segments = Math.ceil(charCount / 160) || 1
  const overLimit = charCount > 160

  return (
    <div>
      <p className="whitespace-pre-wrap text-sm text-stone-900 dark:text-zinc-100">
        {text}
      </p>
      <p
        className={cn(
          "mt-1.5 text-xs",
          overLimit
            ? "text-amber-600 dark:text-amber-400"
            : "text-stone-400 dark:text-zinc-500"
        )}
      >
        {charCount} character{charCount !== 1 ? "s" : ""}
        {overLimit && ` · ${segments} segment${segments !== 1 ? "s" : ""}`}
      </p>
    </div>
  )
}

// ============================================================================
// Component
// ============================================================================

export function CampaignEditorPage({
  propertyId,
  companyId,
  campaign,
}: CampaignEditorPageProps) {
  const router = useRouter()
  const isEdit = campaign !== null && campaign !== undefined
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(() =>
    campaign?.id ? String(campaign.id) : null,
  )
  const persistedCampaignId = draftCampaignId

  // ── Form state ──
  const [form, setForm] = useState<CampaignForm>(() => {
    if (campaign) {
      return {
        name: (campaign.name as string) ?? "",
        channel: (campaign.channel as "email" | "sms" | "both") ?? "email",
        segment_type: (campaign.segment_type as string) ?? "all_guests",
        subject: (campaign.subject as string) ?? "",
        body: (campaign.body as string) ?? "",
        smsBody: (campaign.sms_body as string) ?? "",
      }
    }
    return INITIAL_FORM
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  // ── Active field for variable insertion ──
  const [activeField, setActiveField] = useState<"subject" | "body" | "smsBody">("body")
  const [bodyTab, setBodyTab] = useState<"email" | "sms">("email")
  const subjectRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const smsBodyRef = useRef<HTMLTextAreaElement>(null)
  const richEditorRef = useRef<RichEditorHandle>(null)
  const bodyInteractionRef = useRef(false)

  // ── Preview sheet ──
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSheetSide, setPreviewSheetSide] = useState<"bottom" | "right">("right")
  const [previewLoading, setPreviewLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)

  // ── Template selectors ──
  const [selectedEmailTemplateId, setSelectedEmailTemplateId] = useState<string>(() => {
    if (!campaign?.template_id) return ""
    const channel = (campaign.channel as CampaignForm["channel"]) ?? "email"
    return channel === "email" || channel === "both" ? (campaign.template_id as string) : ""
  })
  const [selectedSmsTemplateId, setSelectedSmsTemplateId] = useState<string>(() => {
    if (!campaign?.template_id) return ""
    const channel = (campaign.channel as CampaignForm["channel"]) ?? "email"
    return channel === "sms" || channel === "both" ? (campaign.template_id as string) : ""
  })
  const previousChannelRef = useRef(form.channel)
  const [emailTemplates, setEmailTemplates] = useState<{ id: string; name: string; subject_template: string; html_template: string }[]>([])
  const [smsTemplates, setSmsTemplates] = useState<{ id: string; name: string; body: string }[]>([])

  const isEmailChannel = form.channel === "email" || form.channel === "both"

  // Fetch templates when channel changes
  useEffect(() => {
    if (previousChannelRef.current !== form.channel) {
      setSelectedEmailTemplateId("")
      setSelectedSmsTemplateId("")
      previousChannelRef.current = form.channel
    }

    if (isEmailChannel) {
      fetch(`/api/v1/automations/email-templates?propertyId=${propertyId}`)
        .then((res) => {
          if (!res.ok) return { emailTemplates: [] }
          return res.json().then((d) => d.data ?? d)
        })
        .then((data) => {
          setEmailTemplates(data?.emailTemplates ?? [])
        })
        .catch(() => setEmailTemplates([]))
    } else {
      setEmailTemplates([])
    }

    if (form.channel === "sms" || form.channel === "both") {
      fetch(`/api/v1/automations/sms-templates?propertyId=${propertyId}`)
        .then((res) => {
          if (!res.ok) return { templates: [] }
          return res.json().then((d) => d.data ?? d)
        })
        .then((data) => {
          setSmsTemplates(data?.templates ?? [])
        })
        .catch(() => setSmsTemplates([]))
    } else {
      setSmsTemplates([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.channel, propertyId])

  // ── Variables bottom sheet (mobile) ──
  const [variablesOpen, setVariablesOpen] = useState(false)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)")
    const apply = () => {
      setPreviewSheetSide(media.matches ? "bottom" : "right")
    }
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [])

  // ── Dirty tracking ──
  // The RichEditor wraps the body with email-settings metadata on mount,
  // which fires onChange right after we mount. To avoid showing "Unsaved"
  // before the user has actually edited anything, we keep updating the
  // "clean" snapshot until the user takes a real action (markUserEdited).
  const [cleanForm, setCleanForm] = useState<string | null>(null)
  const [hasUserEdited, setHasUserEdited] = useState(false)

  useEffect(() => {
    setCleanForm(null)
    setHasUserEdited(false)
    bodyInteractionRef.current = false
  }, [campaign])

  useEffect(() => {
    if (hasUserEdited) return
    const id = window.setTimeout(() => {
      setCleanForm(JSON.stringify(form))
    }, 0)
    return () => window.clearTimeout(id)
  }, [form, hasUserEdited])

  const markUserEdited = useCallback(() => {
    setHasUserEdited(true)
  }, [])

  const markBodyInteracted = useCallback(() => {
    bodyInteractionRef.current = true
  }, [])

  const isDirty =
    hasUserEdited && cleanForm !== null && JSON.stringify(form) !== cleanForm

  const { UnsavedChangesDialog, markClean, beginIntentionalNavigation, requestNavigation } =
    useUnsavedChangesGuard(isDirty)

  const resetDirty = useCallback(() => {
    setCleanForm(JSON.stringify(form))
    setHasUserEdited(false)
    bodyInteractionRef.current = false
    markClean()
  }, [form, markClean])

  const exitToCampaignsList = useCallback(() => {
    const target = `/dashboard/${propertyId}/guest-communication?tab=campaigns`
    beginIntentionalNavigation()
    resetDirty()
    requestAnimationFrame(() => {
      router.replace(target)
    })
  }, [beginIntentionalNavigation, resetDirty, router, propertyId])

  const updateForm = useCallback(<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }))
    markUserEdited()
  }, [errors, markUserEdited])

  const updateBodyFromEditor = useCallback((val: string) => {
    setForm((prev) => ({ ...prev, body: val }))
    if (errors.body) setErrors((prev) => ({ ...prev, body: "" }))
    if (bodyInteractionRef.current) {
      markUserEdited()
    }
  }, [errors.body, markUserEdited])

  // ── Variable insertion ──
  const insertVariable = useCallback(
    (path: string) => {
      const insertion = `{{${path}}}`

      if (activeField === "subject") {
        const ref = subjectRef.current
        if (!ref) {
          updateForm("subject", form.subject + insertion)
          return
        }
        const start = ref.selectionStart
        const end = ref.selectionEnd
        const value = ref.value
        const newValue = value.slice(0, start) + insertion + value.slice(end)
        updateForm("subject", newValue)
        requestAnimationFrame(() => {
          ref.focus()
          ref.setSelectionRange(start + insertion.length, start + insertion.length)
        })
      } else if (activeField === "smsBody") {
        // SMS body field (either standalone sms channel or "both" sms tab)
        const ref = form.channel === "both" ? smsBodyRef.current : bodyRef.current
        const currentValue = form.smsBody
        if (!ref) {
          updateForm("smsBody", currentValue + insertion)
          return
        }
        const start = ref.selectionStart
        const end = ref.selectionEnd
        const value = ref.value
        const newValue = value.slice(0, start) + insertion + value.slice(end)
        updateForm("smsBody", newValue)
        requestAnimationFrame(() => {
          ref.focus()
          ref.setSelectionRange(start + insertion.length, start + insertion.length)
        })
      } else if (isEmailChannel) {
        // Insert into rich editor via imperative handle
        if (richEditorRef.current) {
          richEditorRef.current.insertVariable(insertion)
        } else {
          updateForm("body", form.body + insertion)
        }
      } else {
        // SMS standalone: plain textarea insertion
        const ref = bodyRef.current
        if (!ref) {
          updateForm("body", form.body + insertion)
          return
        }
        const start = ref.selectionStart
        const end = ref.selectionEnd
        const value = ref.value
        const newValue = value.slice(0, start) + insertion + value.slice(end)
        updateForm("body", newValue)
        requestAnimationFrame(() => {
          ref.focus()
          ref.setSelectionRange(start + insertion.length, start + insertion.length)
        })
      }
    },
    [activeField, isEmailChannel, form.channel, form.subject, form.body, form.smsBody, updateForm]
  )

  // ── Validation ──
  function validate(): boolean {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = "Campaign name is required"
    if (form.channel === "both") {
      if (!form.body.trim()) newErrors.body = "Email body is required"
      if (!form.smsBody.trim()) newErrors.smsBody = "SMS body is required"
      if (!form.subject.trim()) newErrors.subject = "Subject is required for email"
    } else if (form.channel === "sms") {
      if (!form.body.trim()) newErrors.body = "Message body is required"
    } else {
      // email
      if (!form.body.trim()) newErrors.body = "Message body is required"
      if (!form.subject.trim()) newErrors.subject = "Subject is required for email campaigns"
    }
    if (!form.segment_type) newErrors.segment_type = "Segment type is required"
    setErrors(newErrors)
    if (Object.keys(newErrors).length > 0) {
      toast.error("Please fill in all required fields")
      return false
    }
    return true
  }

  // ── Save campaign (create or update) ──
  async function saveCampaign(
    statusOverride?: string
  ): Promise<{ id: string } | null> {
    const params = new URLSearchParams({ propertyId })

    if (persistedCampaignId) {
      const res = await fetch(`/api/v1/message-campaigns/${persistedCampaignId}?${params}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildCampaignPayload(form, selectedEmailTemplateId, selectedSmsTemplateId, statusOverride),
        ),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? `Update failed (${res.status})`)
      }
      return json.data.campaign ?? { id: persistedCampaignId }
    }

    const res = await fetch(`/api/v1/message-campaigns?${params}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        buildCampaignPayload(form, selectedEmailTemplateId, selectedSmsTemplateId, statusOverride),
      ),
    })
    const json = await res.json()
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message ?? `Create failed (${res.status})`)
    }
    const created = json.data.campaign as { id: string } | undefined
    if (created?.id) {
      setDraftCampaignId(created.id)
    }
    return created ?? null
  }

  // ── Save Draft ──
  async function handleSaveDraft() {
    if (!validate()) return
    setSaving(true)
    try {
      const wasPersisted = Boolean(persistedCampaignId)
      await saveCampaign(wasPersisted ? undefined : "draft")
      toast.success(wasPersisted ? "Changes saved" : "Draft saved", {
        description: wasPersisted
          ? "Your campaign has been updated."
          : "Your campaign has been saved as a draft.",
      })
      exitToCampaignsList()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save draft")
      setSaving(false)
    }
  }

  // ── Send Now ──
  async function handleSendNow() {
    if (!validate()) return
    setSending(true)
    try {
      const saved = await saveCampaign()
      if (!saved) throw new Error("No campaign returned")
      const sendParams = new URLSearchParams({ propertyId })
      const sendRes = await fetch(
        `/api/v1/message-campaigns/${saved.id}/send?${sendParams}`,
        { method: "POST" }
      )
      const sendJson = await sendRes.json()
      if (!sendRes.ok || !sendJson.success) {
        throw new Error(sendJson.error?.message ?? "Could not send campaign")
      }
      toast.success("Campaign sent!", { description: "Your campaign is now being delivered." })
      exitToCampaignsList()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send campaign")
      setSending(false)
    }
  }

  function openScheduleDialog() {
    if (!validate()) return
    setScheduleDialogOpen(true)
  }

  async function confirmSchedule(scheduledAt: string) {
    setSending(true)
    try {
      const saved = await saveCampaign()
      if (!saved) throw new Error("No campaign returned")
      const scheduleParams = new URLSearchParams({ propertyId })
      const scheduleRes = await fetch(
        `/api/v1/message-campaigns/${saved.id}/schedule?${scheduleParams}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduled_at: scheduledAt }),
        }
      )
      const scheduleJson = await scheduleRes.json()
      if (!scheduleRes.ok || !scheduleJson.success) {
        throw new Error(scheduleJson.error?.message ?? "Could not schedule campaign")
      }
      setScheduleDialogOpen(false)
      toast.success("Campaign scheduled", { description: "Your campaign has been scheduled." })
      exitToCampaignsList()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule campaign")
      setSending(false)
    }
  }

  // ── Preview ──
  async function handlePreview() {
    setPreviewLoading(true)
    setPreviewOpen(true)
    try {
      const previewParams = new URLSearchParams({ propertyId })
      const res = await fetch(
        `/api/v1/message-campaigns/preview?${previewParams}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...form }),
        }
      )
      const json = await res.json()
      if (json.success) {
        setPreview(json.data)
      } else {
        setPreview({
          recipient_count: 0,
          sample_messages: [],
          warnings: [json.error?.message ?? "Could not generate preview."],
        })
      }
    } catch {
      setPreview({
        recipient_count: 0,
        sample_messages: [],
        warnings: ["Network error — could not generate preview."],
      })
    } finally {
      setPreviewLoading(false)
    }
  }



  const busy = saving || sending

  return (
    <div className="flex flex-col lg:h-full lg:overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 border-b px-4 py-3 lg:px-6 lg:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() =>
                requestNavigation(() =>
                  router.push(`/dashboard/${propertyId}/guest-communication?tab=campaigns`)
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                  {isEdit ? "Edit Campaign" : "New Campaign"}
                </h1>
                {isDirty && (
                  <Badge
                    variant="outline"
                    className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
                  >
                    <AlertCircle className="h-3.5 w-3.5" />
                    Unsaved
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {isEdit
                  ? "Modify this campaign's content and settings."
                  : "Create a new messaging campaign for your guests."}
              </p>
            </div>
          </div>

          <div
            className={cn(
              "grid w-full shrink-0 grid-cols-2 gap-2",
              "sm:flex sm:w-auto sm:items-center sm:justify-end sm:gap-3"
            )}
          >
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handlePreview}
              disabled={form.channel === "both" ? !(form.body.trim() || form.smsBody.trim()) : !form.body.trim()}
            >
              <Eye className="mr-1 h-4 w-4 shrink-0" />
              Preview
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleSaveDraft}
              disabled={busy}
            >
              {saving ? (
                <Loader2 className="mr-1 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4 shrink-0" />
              )}
              <span className="truncate">
                Save Draft
              </span>
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={openScheduleDialog}
              disabled={busy}
            >
              {sending ? (
                <Loader2 className="mr-1 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Clock className="mr-1 h-4 w-4 shrink-0" />
              )}
              <span className="truncate">Schedule</span>
            </Button>
            <Button
              className="w-full sm:w-auto bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleSendNow}
              disabled={busy}
            >
              {sending ? (
                <Loader2 className="mr-1 h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4 shrink-0" />
              )}
              <span className="truncate">Send Now</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main content + variable side panel */}
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        {/* Main form area */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-3 pb-8 lg:px-5 lg:pb-6">
          <div className="shrink-0 space-y-3">
            {/* Name & Channel row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-name">
                  Campaign Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="campaign-name"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="e.g., Summer Welcome Offer"
                  className={cn(
                    errors.name && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {errors.name && (
                  <p className="text-xs text-red-500 mt-1">{errors.name}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-channel">
                  Channel <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => updateForm("channel", v as CampaignForm["channel"])}
                >
                  <SelectTrigger id="campaign-channel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" aria-hidden />
                        Email
                      </span>
                    </SelectItem>
                    <SelectItem value="sms">
                      <span className="inline-flex items-center gap-2">
                        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                        SMS
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Audience & Template row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="campaign-segment">
                  Audience <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.segment_type}
                  onValueChange={(v) => updateForm("segment_type", v)}
                >
                  <SelectTrigger
                    id="campaign-segment"
                    className={cn(
                      errors.segment_type &&
                      "border-red-500 focus-visible:ring-red-500"
                    )}
                  >
                    <SelectValue placeholder="Select a segment…" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_TYPES.map((st) => (
                      <SelectItem key={st.value} value={st.value}>
                        {st.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.segment_type && (
                  <p className="text-xs text-red-500 mt-1">{errors.segment_type}</p>
                )}
              </div>

              {/* Template selectors */}
              {form.channel === "both" ? (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="campaign-email-template">Email Template</Label>
                    {emailTemplates.length > 0 ? (
                      <Select
                        value={selectedEmailTemplateId}
                        onValueChange={(v) => {
                          setSelectedEmailTemplateId(v)
                          if (v === "__none__") {
                            updateForm("subject", "")
                            updateForm("body", "")
                            return
                          }
                          const tmpl = emailTemplates.find((t) => t.id === v)
                          if (tmpl) {
                            updateForm("subject", tmpl.subject_template ?? "")
                            updateForm("body", tmpl.html_template ?? "")
                          }
                        }}
                      >
                        <SelectTrigger id="campaign-email-template">
                          <SelectValue placeholder="-- Select a template --" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-- Select a template --</SelectItem>
                          {emailTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select disabled value="">
                        <SelectTrigger id="campaign-email-template">
                          <SelectValue placeholder="No templates available" />
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="campaign-sms-template">SMS Template</Label>
                    {smsTemplates.length > 0 ? (
                      <Select
                        value={selectedSmsTemplateId}
                        onValueChange={(v) => {
                          setSelectedSmsTemplateId(v)
                          if (v === "__none__") {
                            updateForm("smsBody", "")
                            return
                          }
                          const tmpl = smsTemplates.find((t) => t.id === v)
                          if (tmpl) {
                            updateForm("smsBody", tmpl.body ?? "")
                          }
                        }}
                      >
                        <SelectTrigger id="campaign-sms-template">
                          <SelectValue placeholder="-- Select a template --" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-- Select a template --</SelectItem>
                          {smsTemplates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select disabled value="">
                        <SelectTrigger id="campaign-sms-template">
                          <SelectValue placeholder="No templates available" />
                        </SelectTrigger>
                        <SelectContent />
                      </Select>
                    )}
                  </div>
                </>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="campaign-template">Template</Label>
                  {isEmailChannel && emailTemplates.length > 0 ? (
                    <Select
                      value={selectedEmailTemplateId}
                      onValueChange={(v) => {
                        setSelectedEmailTemplateId(v)
                        if (v === "__none__") {
                          updateForm("subject", "")
                          updateForm("body", "")
                          return
                        }
                        const tmpl = emailTemplates.find((t) => t.id === v)
                        if (tmpl) {
                          updateForm("subject", tmpl.subject_template ?? "")
                          updateForm("body", tmpl.html_template ?? "")
                        }
                      }}
                    >
                      <SelectTrigger id="campaign-template">
                        <SelectValue placeholder="-- Select a template --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- Select a template --</SelectItem>
                        {emailTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : form.channel === "sms" && smsTemplates.length > 0 ? (
                    <Select
                      value={selectedSmsTemplateId}
                      onValueChange={(v) => {
                        setSelectedSmsTemplateId(v)
                        if (v === "__none__") {
                          updateForm("body", "")
                          return
                        }
                        const tmpl = smsTemplates.find((t) => t.id === v)
                        if (tmpl) {
                          updateForm("body", tmpl.body ?? "")
                        }
                      }}
                    >
                      <SelectTrigger id="campaign-template">
                        <SelectValue placeholder="-- Select a template --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">-- Select a template --</SelectItem>
                        {smsTemplates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select disabled value="">
                      <SelectTrigger id="campaign-template">
                        <SelectValue placeholder="No templates available" />
                      </SelectTrigger>
                      <SelectContent />
                    </Select>
                  )}
                </div>
              )}
            </div>

            {/* ── Subject (email only) ── */}
            {form.channel === "email" && (
              <div className="space-y-1.5">
                <Label htmlFor="campaign-subject">
                  Subject <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="campaign-subject"
                  ref={subjectRef}
                  value={form.subject}
                  rows={2}
                  onChange={(e) => updateForm("subject", e.target.value)}
                  onFocus={() => setActiveField("subject")}
                  placeholder="e.g., Welcome to our property!"
                  className={cn(
                    "resize-none",
                    errors.subject && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {errors.subject && (
                  <p className="text-xs text-red-500 mt-1">{errors.subject}</p>
                )}
              </div>
            )}

          </div>

          {/* ── Message Body ── */}
          {form.channel === "both" ? (
            /* "Both" channel: tabbed Email + SMS body editors */
            <Tabs value={bodyTab} onValueChange={(v) => setBodyTab(v as "email" | "sms")} className="flex flex-1 flex-col gap-1.5 lg:min-h-[560px]">
              <div className="flex items-center justify-between gap-2">
                <TabsList className="h-9">
                  <TabsTrigger value="email" className="gap-1.5 px-3">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    Email
                  </TabsTrigger>
                  <TabsTrigger value="sms" className="gap-1.5 px-3">
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                    SMS
                  </TabsTrigger>
                </TabsList>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs lg:hidden"
                  onClick={() => {
                    setActiveField(bodyTab === "sms" ? "smsBody" : "body")
                    setVariablesOpen(true)
                  }}
                >
                  <Braces className="h-3.5 w-3.5" />
                  Variables
                </Button>
              </div>

              {/* Email tab content */}
              <TabsContent value="email" className="flex flex-1 flex-col gap-3 mt-0 data-[state=inactive]:hidden lg:min-h-[520px]">
                {/* Subject */}
                <div className="shrink-0 space-y-1.5">
                  <Label htmlFor="campaign-subject">
                    Subject <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="campaign-subject"
                    ref={subjectRef}
                    value={form.subject}
                    rows={2}
                    onChange={(e) => updateForm("subject", e.target.value)}
                    onFocus={() => setActiveField("subject")}
                    placeholder="e.g., Welcome to our property!"
                    className={cn(
                      "resize-none",
                      errors.subject && "border-red-500 focus-visible:ring-red-500"
                    )}
                  />
                  {errors.subject && (
                    <p className="text-xs text-red-500 mt-1">{errors.subject}</p>
                  )}
                </div>
                {/* Email body */}
                <div className="flex flex-col gap-1.5 lg:min-h-[700px] lg:flex-1">
                  <Label htmlFor="campaign-body">
                    Email Body <span className="text-red-500">*</span>
                  </Label>
                  <div
                    className="h-[min(560px,72vh)] shrink-0 overflow-hidden rounded-md sm:h-[min(640px,74vh)] lg:h-auto lg:min-h-[660px] lg:flex-1"
                    onFocus={() => setActiveField("body")}
                    onKeyDown={markBodyInteracted}
                    onPaste={markBodyInteracted}
                    onPointerDown={markBodyInteracted}
                  >
                    <RichEditor
                      ref={richEditorRef}
                      value={form.body}
                      onChange={updateBodyFromEditor}
                      placeholder="Write your email content here…"
                      minHeight="100%"
                      className="h-full flex flex-col"
                      toolbarEnd={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1 text-xs lg:hidden"
                          onClick={() => { setActiveField("body"); setVariablesOpen(true) }}
                        >
                          <Braces className="h-3.5 w-3.5" />
                          Variables
                        </Button>
                      }
                    />
                  </div>
                  {errors.body && (
                    <p className="text-xs text-red-500 shrink-0">{errors.body}</p>
                  )}
                </div>
              </TabsContent>

              {/* SMS tab content */}
              <TabsContent value="sms" className="flex min-h-[480px] flex-1 flex-col gap-1.5 mt-0 data-[state=inactive]:hidden">
                <Label htmlFor="campaign-sms-body">
                  SMS Body <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="campaign-sms-body"
                  ref={smsBodyRef}
                  value={form.smsBody}
                  rows={12}
                  onChange={(e) => updateForm("smsBody", e.target.value)}
                  onFocus={() => setActiveField("smsBody")}
                  placeholder="Write your SMS message here… Use {{guest_first_name}} for personalization."
                  className={cn(
                    "h-[min(380px,52vh)] shrink-0 resize-none sm:h-[min(420px,55vh)] lg:h-auto lg:min-h-[440px] lg:flex-1",
                    errors.smsBody && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {(() => {
                  const charCount = form.smsBody.length
                  const segments = Math.ceil(charCount / 160) || 1
                  const overLimit = charCount > 160
                  return (
                    <div className="flex shrink-0 items-center justify-between">
                      {errors.smsBody ? (
                        <p className="text-xs text-red-500">{errors.smsBody}</p>
                      ) : <span />}
                      <p
                        className={cn(
                          "text-xs",
                          overLimit
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-muted-foreground"
                        )}
                      >
                        {charCount} character{charCount !== 1 ? "s" : ""}
                        {overLimit && ` · ${segments} segment${segments !== 1 ? "s" : ""}`}
                      </p>
                    </div>
                  )
                })()}
              </TabsContent>
            </Tabs>
          ) : (
            /* Email-only or SMS-only: single body field (no tabs) */
            <div className="flex shrink-0 flex-col gap-1.5 lg:min-h-[520px]">
              <div className="flex items-center justify-between">
                <Label htmlFor="campaign-body">
                  Message Body <span className="text-red-500">*</span>
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs lg:hidden"
                  onClick={() => {
                    setActiveField("body")
                    setVariablesOpen(true)
                  }}
                >
                  <Braces className="h-3.5 w-3.5" />
                  Variables
                </Button>
              </div>
              {isEmailChannel ? (
                <div
                  className="h-[min(560px,72vh)] shrink-0 overflow-hidden rounded-md sm:h-[min(640px,74vh)] lg:min-h-[660px]"
                  onFocus={() => setActiveField("body")}
                  onKeyDown={markBodyInteracted}
                  onPaste={markBodyInteracted}
                  onPointerDown={markBodyInteracted}
                >
                  <RichEditor
                    ref={richEditorRef}
                    value={form.body}
                    onChange={updateBodyFromEditor}
                    placeholder="Write your email content here…"
                    minHeight="100%"
                    className="h-full flex flex-col"
                    toolbarEnd={
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs lg:hidden"
                        onClick={() => { setActiveField("body"); setVariablesOpen(true) }}
                      >
                        <Braces className="h-3.5 w-3.5" />
                        Variables
                      </Button>
                    }
                  />
                </div>
              ) : (
                <Textarea
                  id="campaign-body"
                  ref={bodyRef}
                  value={form.body}
                  rows={12}
                  onChange={(e) => updateForm("body", e.target.value)}
                  onFocus={() => setActiveField("body")}
                  placeholder="Write your message here… Use {{guest_first_name}} for personalization."
                  className={cn(
                    "h-[min(380px,52vh)] shrink-0 resize-none sm:h-[min(420px,55vh)] lg:min-h-[440px]",
                    errors.body && "border-red-500 focus-visible:ring-red-500"
                  )}
                />
              )}
              {errors.body && (
                <p className="text-xs text-red-500 shrink-0">{errors.body}</p>
              )}
            </div>
          )}

          {/* ── Schedule button (below form on desktop too) ── */}
          <div className="flex items-center justify-end gap-2 border-t pt-4 lg:hidden">
            <Button
              type="button"
              variant="outline"
              onClick={openScheduleDialog}
              disabled={busy}
              className="gap-1"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Clock className="h-4 w-4" aria-hidden />
              )}
              Schedule
            </Button>
          </div>
        </div>

        {/* Variable side panel — desktop */}
        <div className="hidden shrink-0 overflow-hidden border-l transition-[width] duration-200 lg:flex w-[21rem] 2xl:w-[32rem]">
          <CampaignVariablePanel
            onInsert={insertVariable}
            activeField={activeField}
          />
        </div>
      </div>

      {/* Variables bottom sheet — mobile */}
      <Sheet open={variablesOpen} onOpenChange={setVariablesOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[min(85dvh,640px)] w-full max-w-full flex-col gap-0 p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Available Variables</SheetTitle>
            <SheetDescription>
              Insert merge fields into your message
            </SheetDescription>
          </SheetHeader>
          <CampaignVariablePanel
            onInsert={insertVariable}
            activeField={activeField}
            onAfterInsert={() => setVariablesOpen(false)}
            className="h-full w-full"
          />
        </SheetContent>
      </Sheet>

      <UnsavedChangesDialog />

      <CampaignScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onConfirm={confirmSchedule}
        isSubmitting={sending}
      />

      {/* Preview sheet — bottom on mobile, side panel on desktop */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent
          key={previewSheetSide}
          side={previewSheetSide}
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            previewSheetSide === "bottom"
              ? "h-[min(92dvh,100dvh)] w-full max-w-full rounded-t-xl border-t"
              : "h-full w-full max-w-[100vw] sm:w-[700px] sm:max-w-[700px]"
          )}
        >
          <SheetHeader className="shrink-0 space-y-1 border-b px-4 py-4 text-left">
            <SheetTitle>Campaign Preview</SheetTitle>
            <SheetDescription>
              Preview with sample recipient data
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            {previewLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-stone-400 dark:text-zinc-500" aria-hidden />
                <p className="text-sm text-stone-500 dark:text-zinc-400">
                  Generating preview…
                </p>
              </div>
            ) : preview ? (
              <div className="space-y-5">
                {/* Warnings */}
                {preview.warnings.length > 0 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800/40 dark:bg-yellow-950/30">
                    {preview.warnings.map((w, i) => (
                      <p
                        key={i}
                        className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-200"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                {/* Sample message */}
                {(() => {
                  const sample = preview.sample_messages[0]
                  if (!sample) {
                    return (
                      <p className="text-sm text-stone-400 dark:text-zinc-500">
                        No preview available.
                      </p>
                    )
                  }

                  if (form.channel === "both") {
                    return (
                      <Tabs defaultValue="email">
                        <TabsList className="w-full">
                          <TabsTrigger value="email" className="flex-1 gap-1.5">
                            <Mail className="h-3.5 w-3.5" aria-hidden />
                            Email
                          </TabsTrigger>
                          <TabsTrigger value="sms" className="flex-1 gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                            SMS
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="email" className="space-y-3">
                          {sample.personalized_subject && (
                            <p className="break-words text-xs leading-relaxed text-muted-foreground">
                              Subject: <span className="font-medium text-foreground">{sample.personalized_subject}</span>
                            </p>
                          )}
                          <EmailPreviewFrame html={sample.personalized_body} />
                        </TabsContent>
                        <TabsContent value="sms" className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            To: {sample.guest_name}
                          </p>
                          <SmsBodyPreview text={form.smsBody || stripHtml(sample.personalized_body)} />
                        </TabsContent>
                      </Tabs>
                    )
                  }

                  if (form.channel === "sms") {
                    return (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          To: {sample.guest_name}
                        </p>
                        <SmsBodyPreview text={sample.personalized_body} />
                      </div>
                    )
                  }

                  // email channel
                  return (
                    <div className="space-y-3">
                      {sample.personalized_subject && (
                        <p className="break-words text-xs leading-relaxed text-muted-foreground">
                          Subject: <span className="font-medium text-foreground">{sample.personalized_subject}</span>
                        </p>
                      )}
                      <EmailPreviewFrame html={sample.personalized_body} />
                    </div>
                  )
                })()}

                {/* Action buttons inside preview */}
                <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setPreviewOpen(false)
                      openScheduleDialog()
                    }}
                    disabled={busy}
                    className="gap-1"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Clock className="h-4 w-4" aria-hidden />
                    )}
                    Schedule
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setPreviewOpen(false)
                      handleSendNow()
                    }}
                    disabled={busy}
                    className="gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden />
                    )}
                    Send Now
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

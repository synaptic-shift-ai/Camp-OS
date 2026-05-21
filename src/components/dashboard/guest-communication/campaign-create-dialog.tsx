"use client"

import { useCallback, useState } from "react"
import {
  Mail,
  MessageSquare,
  Send,
  Clock,
  Users,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react"

// Clock is used in Schedule button icon
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const CARD = "rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/90"

type Step = 1 | 2 | 3 | 4 | 5

const STEP_LABELS: Record<Step, string> = {
  1: "Campaign Details",
  2: "Audience",
  3: "Compose",
  4: "Preview",
  5: "Review & Send",
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

const TEMPLATE_VARIABLES = [
  { value: "{{guest_first_name}}", label: "First Name" },
  { value: "{{guest_last_name}}", label: "Last Name" },
  { value: "{{guest_email}}", label: "Email" },
  { value: "{{guest_phone}}", label: "Phone" },
  { value: "{{location}}", label: "Location" },
  { value: "{{booking_date}}", label: "Booking Date" },
  { value: "{{check_in_date}}", label: "Check-in Date" },
  { value: "{{check_out_date}}", label: "Check-out Date" },
]

type CampaignForm = {
  name: string
  channel: "email" | "sms" | "both"
  segment_type: string
  subject: string
  body: string
}

const INITIAL_FORM: CampaignForm = {
  name: "",
  channel: "email",
  segment_type: "all_guests",
  subject: "",
  body: "",
}

type PreviewData = {
  recipient_count: number
  sample_messages: { guest_id: string; guest_name: string; personalized_subject: string; personalized_body: string }[]
  warnings: string[]
}

type CampaignCreateDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  onCreated: () => void
}

export function CampaignCreateDialog({
  open,
  onOpenChange,
  propertyId,
  onCreated,
}: CampaignCreateDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState<CampaignForm>(INITIAL_FORM)
  const [preview, setPreview] = useState<PreviewData | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [showVariables, setShowVariables] = useState(false)

  const resetAndClose = useCallback(() => {
    setStep(1)
    setForm(INITIAL_FORM)
    setPreview(null)
    setLoading(false)
    setSending(false)
    setShowVariables(false)
    onOpenChange(false)
  }, [onOpenChange])

  const updateForm = useCallback(<K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }, [])

  const canAdvance = (): boolean => {
    switch (step) {
      case 1:
        return form.name.trim().length > 0
      case 2:
        return form.segment_type.length > 0
      case 3:
        return form.body.trim().length > 0 && (form.channel === "sms" || form.subject.trim().length > 0)
      case 4:
        return true
      case 5:
        return true
      default:
        return false
    }
  }

  const handleNext = async () => {
    if (step === 3) {
      // Fetch preview
      setLoading(true)
      try {
        const previewParams = new URLSearchParams({ propertyId })
        const res = await fetch(`/api/v1/message-campaigns/preview?${previewParams}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
          }),
        })
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
        setLoading(false)
      }
    }
    setStep((s) => Math.min(s + 1, 5) as Step)
  }

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 1) as Step)
  }

  const handleSaveDraft = async () => {
    setLoading(true)
    try {
      const draftParams = new URLSearchParams({ propertyId })
      const res = await fetch(`/api/v1/message-campaigns?${draftParams}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          status: "draft",
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        toast({
          title: "Error",
          description: json.error?.message ?? "Could not save draft.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Draft saved", description: "Your campaign has been saved as a draft." })
      onCreated()
      resetAndClose()
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleSendNow = async () => {
    setSending(true)
    try {
      // Create campaign first
      const createParams = new URLSearchParams({ propertyId })
      const createRes = await fetch(`/api/v1/message-campaigns?${createParams}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
        }),
      })
      const createJson = await createRes.json()
      if (!createRes.ok || !createJson.success) {
        toast({
          title: "Error",
          description: createJson.error?.message ?? "Could not create campaign.",
          variant: "destructive",
        })
        return
      }
      const campaignId = createJson.data.campaign.id
      // Send now
      const sendParams = new URLSearchParams({ propertyId })
      const sendRes = await fetch(`/api/v1/message-campaigns/${campaignId}/send?${sendParams}`, {
        method: "POST",
      })
      const sendJson = await sendRes.json()
      if (!sendRes.ok || !sendJson.success) {
        toast({
          title: "Error",
          description: sendJson.error?.message ?? "Could not send campaign.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Campaign sent!", description: "Your campaign is now being delivered." })
      onCreated()
      resetAndClose()
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const handleSchedule = async () => {
    setSending(true)
    try {
      const createParams = new URLSearchParams({ propertyId })
      const createRes = await fetch(`/api/v1/message-campaigns?${createParams}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
        }),
      })
      const createJson = await createRes.json()
      if (!createRes.ok || !createJson.success) {
        toast({
          title: "Error",
          description: createJson.error?.message ?? "Could not create campaign.",
          variant: "destructive",
        })
        return
      }
      const campaignId = createJson.data.campaign.id
      const scheduleParams = new URLSearchParams({ propertyId })
      const scheduleRes = await fetch(`/api/v1/message-campaigns/${campaignId}/schedule?${scheduleParams}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduled_at: new Date(Date.now() + 3600000).toISOString() }),
      })
      const scheduleJson = await scheduleRes.json()
      if (!scheduleRes.ok || !scheduleJson.success) {
        toast({
          title: "Error",
          description: scheduleJson.error?.message ?? "Could not schedule campaign.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Campaign scheduled", description: "Your campaign has been scheduled." })
      onCreated()
      resetAndClose()
    } catch {
      toast({ title: "Error", description: "Network error.", variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const insertVariable = (variable: string) => {
    setForm((prev) => ({ ...prev, body: prev.body + variable }))
    setShowVariables(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose() }}>
      <DialogContent className="sm:max-w-2xl lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Create Campaign</DialogTitle>
          <DialogDescription>
            Step {step} of 5 — {STEP_LABELS[step]}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 py-1">
          {([1, 2, 3, 4, 5] as Step[]).map((s) => (
            <div
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s <= step
                  ? "bg-[hsl(142.1,76.2%,32%)] dark:bg-[hsl(142.1,55%,38%)]"
                  : "bg-stone-200 dark:bg-zinc-700",
              )}
            />
          ))}
        </div>

        {/* Step 1: Campaign Details */}
        {step === 1 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="campaign-name" className="text-sm font-medium">
                Campaign Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="campaign-name"
                value={form.name}
                onChange={(e) => updateForm("name", e.target.value)}
                placeholder="e.g., Summer Welcome Offer"
                className="border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Channel <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { value: "email" as const, icon: Mail, label: "Email", desc: "Send via email" },
                  { value: "sms" as const, icon: MessageSquare, label: "SMS", desc: "Send via text" },
                  { value: "both" as const, icon: Send, label: "Both", desc: "Email + SMS" },
                ]).map((ch) => (
                  <button
                    key={ch.value}
                    type="button"
                    onClick={() => updateForm("channel", ch.value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-colors",
                      form.channel === ch.value
                        ? "border-[hsl(142.1,76.2%,32%)] bg-emerald-50 dark:border-[hsl(142.1,55%,38%)] dark:bg-emerald-950/30"
                        : "border-stone-200 bg-white hover:border-stone-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600",
                    )}
                  >
                    <ch.icon className={cn(
                      "h-6 w-6",
                      form.channel === ch.value
                        ? "text-[hsl(142.1,76.2%,32%)] dark:text-emerald-400"
                        : "text-stone-400 dark:text-zinc-500",
                    )} aria-hidden />
                    <span className="text-sm font-semibold">{ch.label}</span>
                    <span className="text-xs text-stone-500 dark:text-zinc-400">{ch.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="campaign-segment" className="text-sm font-medium">
                Segment Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={form.segment_type}
                onValueChange={(v) => updateForm("segment_type", v)}
              >
                <SelectTrigger
                  id="campaign-segment"
                  className="border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
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
            </div>

            <div className={cn(CARD, "flex items-center gap-3")}>
              <Users className="h-5 w-5 text-stone-400 dark:text-zinc-500" aria-hidden />
              <div>
                <p className="text-sm font-medium">Selected Segment</p>
                <p className="text-xs text-stone-500 dark:text-zinc-400">
                  {SEGMENT_TYPES.find((s) => s.value === form.segment_type)?.label ?? "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Compose */}
        {step === 3 && (
          <div className="space-y-5">
            {form.channel !== "sms" && (
              <div className="space-y-2">
                <label htmlFor="campaign-subject" className="text-sm font-medium">
                  Subject <span className="text-red-500">*</span>
                </label>
                <Input
                  id="campaign-subject"
                  value={form.subject}
                  onChange={(e) => updateForm("subject", e.target.value)}
                  placeholder="e.g., Welcome to our property!"
                  className="border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="campaign-body" className="text-sm font-medium">
                  Message Body <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setShowVariables(!showVariables)}
                  >
                    Insert Variable
                  </Button>
                  {showVariables && (
                    <div className="absolute right-0 top-full z-10 mt-1 w-48 rounded-lg border border-stone-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
                      {TEMPLATE_VARIABLES.map((tv) => (
                        <button
                          key={tv.value}
                          type="button"
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-stone-100 dark:hover:bg-zinc-800"
                          onClick={() => insertVariable(tv.value)}
                        >
                          <span className="font-mono text-stone-500 dark:text-zinc-400">{tv.value}</span>
                          <span className="text-stone-400 dark:text-zinc-500">({tv.label})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Textarea
                id="campaign-body"
                value={form.body}
                onChange={(e) => updateForm("body", e.target.value)}
                placeholder="Write your message here… Use {{guest_first_name}} for personalization."
                rows={8}
                className="border-stone-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 4 && (
          <div className="space-y-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <Loader2 className="h-8 w-8 animate-spin text-stone-400 dark:text-zinc-500" aria-hidden />
                <p className="text-sm text-stone-500 dark:text-zinc-400">Generating preview…</p>
              </div>
            ) : (
              <>
                <div className={cn(CARD, "flex items-center gap-4")}>
                  <Users className="h-6 w-6 text-[hsl(142.1,76.2%,32%)] dark:text-emerald-400" aria-hidden />
                  <div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {preview?.recipient_count.toLocaleString() ?? 0}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-zinc-400">Estimated recipients</p>
                  </div>
                </div>

                {preview?.warnings && preview.warnings.length > 0 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800/40 dark:bg-yellow-950/30">
                    {preview.warnings.map((w, i) => (
                      <p key={i} className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-200">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        {w}
                      </p>
                    ))}
                  </div>
                )}

                <div className="space-y-2">
                  <p className="text-sm font-medium">Sample Messages</p>
                  {preview?.sample_messages && preview.sample_messages.length > 0 ? (
                    <div className="space-y-2">
                      {preview.sample_messages.map((msg, i) => (
                        <div
                          key={i}
                          className={cn(CARD, "space-y-1")}
                        >
                          <p className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                            To: {msg.guest_name}
                          </p>
                          <p className="text-sm text-stone-900 dark:text-zinc-100">
                            {msg.personalized_body}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-stone-400 dark:text-zinc-500">
                      No preview messages available.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 5: Review */}
        {step === 5 && (
          <div className="space-y-5">
            <div className={cn(CARD, "space-y-3")}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">Name</span>
                <span className="text-sm font-medium">{form.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">Channel</span>
                <Badge
                  variant="outline"
                  className={
                    form.channel === "email"
                      ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-600/40 dark:bg-blue-950/40 dark:text-blue-200"
                      : form.channel === "sms"
                        ? "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-600/40 dark:bg-purple-950/40 dark:text-purple-200"
                        : "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-600/40 dark:bg-indigo-950/40 dark:text-indigo-200"
                  }
                >
                  {form.channel === "both" ? "Email + SMS" : form.channel.toUpperCase()}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">Segment</span>
                <span className="text-sm">
                  {SEGMENT_TYPES.find((s) => s.value === form.segment_type)?.label ?? form.segment_type}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">Recipients</span>
                <span className="text-sm tabular-nums font-semibold">
                  {preview?.recipient_count.toLocaleString() ?? "—"}
                </span>
              </div>
              {form.channel !== "sms" && (
                <div className="flex items-start justify-between gap-4">
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">Subject</span>
                  <span className="text-right text-sm">{form.subject}</span>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">Body</span>
                <p className="whitespace-pre-wrap rounded-lg border border-stone-100 bg-stone-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-950/50">
                  {form.body}
                </p>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={loading || sending}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetAndClose}
              disabled={sending}
            >
              Cancel
            </Button>
            {step < 5 && (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canAdvance() || loading}
                className="gap-1 bg-[hsl(142.1,76.2%,32%)] text-white hover:opacity-90 dark:bg-[hsl(142.1,55%,38%)]"
              >
                {step === 3 ? (
                  loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden />
                  )
                ) : null}
                {step === 3 ? "Preview" : "Next"}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Button>
            )}
            {step === 5 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveDraft}
                  disabled={loading || sending}
                >
                  Save as Draft
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSchedule}
                  disabled={loading || sending}
                  className="gap-1"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Clock className="h-4 w-4" aria-hidden />}
                  Schedule
                </Button>
                <Button
                  type="button"
                  onClick={handleSendNow}
                  disabled={loading || sending}
                  className="gap-1 bg-[hsl(142.1,76.2%,32%)] text-white hover:opacity-90 dark:bg-[hsl(142.1,55%,38%)]"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                  Send Now
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

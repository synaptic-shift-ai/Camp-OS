"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useUnsavedChangesGuard } from "@/hooks/use-unsaved-changes-guard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { RichEditor, type RichEditorHandle } from "@/components/ui/rich-editor"
import { EmailTemplateVariablePanel } from "./email-template-variable-panel"
import { EmailTemplatePreview } from "./email-template-preview"
import { toast } from "sonner"
import {
  ArrowLeft,
  Save,
  Loader2,
  Eye,
  AlertCircle,
  Braces,
} from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

type TemplateData = Record<string, unknown>

type EmailTemplateEditorPageProps = {
  propertyId: string
  companyId: string
  template?: TemplateData | null
  isSystemDefault?: boolean
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORIES = [
  { value: "welcome", label: "Welcome" },
  { value: "reservation", label: "Reservation" },
  { value: "payment", label: "Payment" },
  { value: "review", label: "Review" },
  { value: "notification", label: "Notification" },
  { value: "custom", label: "Custom" },
]

const DEFAULT_NEW_TEMPLATE_BODY = `<h2 style="color:#333333;font-size:22px;font-weight:bold;margin:0 0 16px;">Hello {{guest.first_name}},</h2>
<p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 12px;">Thank you for your reservation at <strong>{{property.name}}</strong>. We're looking forward to welcoming you!</p>
<p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 12px;">Write your message content here. You can use the toolbar above to format text, add links, and insert variables from the panel on the right.</p>
<hr style="border:none;border-top:1px solid #e6ebf1;margin:24px 0;" />
<p style="color:#888888;font-size:13px;line-height:1.5;margin:0;">Best regards,<br /><strong>The {{property.name}} Team</strong></p>`

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

// ============================================================================
// Component
// ============================================================================

export function EmailTemplateEditorPage({
  propertyId,
  companyId,
  template,
  isSystemDefault = false,
}: EmailTemplateEditorPageProps) {
  const router = useRouter()
  const { can } = usePermissions()
  const canSave = can("automations.add_email_templates") || can("automations.edit_email_templates")
  const isEdit = template !== null && template !== undefined

  // ── Form state ──
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [category, setCategory] = useState("")
  const [subject, setSubject] = useState("")
  const [htmlBody, setHtmlBody] = useState(() => (template ? "" : DEFAULT_NEW_TEMPLATE_BODY))
  const [templateStatus, setTemplateStatus] = useState<string>("draft")
  const [saving, setSaving] = useState(false)
  const [customCategory, setCustomCategory] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Active field for variable insertion ──
  const [activeField, setActiveField] = useState<"subject" | "body">("subject")
  const subjectRef = useRef<HTMLTextAreaElement>(null)
  const richEditorRef = useRef<RichEditorHandle>(null)
  const bodyInteractionRef = useRef(false)

  // ── Preview sheet ──
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewSheetSide, setPreviewSheetSide] = useState<"bottom" | "right">(
    "right"
  )
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

  // ── Populate from template ──
  useEffect(() => {
    if (template) {
      setName((template.name as string) ?? "")
      setSlug((template.slug as string) ?? "")
      setCategory((template.category as string) ?? "")
      setSubject((template.subject_template as string) ?? "")
      setHtmlBody((template.html_template as string) ?? "")
      setTemplateStatus((template.status as string) ?? "draft")
    } else {
      setName("")
      setSlug("")
      setCategory("")
      setCustomCategory("")
      setSubject("")
      setHtmlBody(DEFAULT_NEW_TEMPLATE_BODY)
      setTemplateStatus("draft")
    }
    setErrors({})
  }, [template])

  // ── Auto-generate slug from name on create ──
  useEffect(() => {
    if (!isEdit && name) {
      setSlug(slugify(name))
    }
  }, [name, isEdit])

  // ── Dirty tracking ──
  const currentFormJson = JSON.stringify({
    name,
    slug,
    category,
    customCategory,
    subject,
    htmlBody,
    templateStatus,
  })
  const [cleanForm, setCleanForm] = useState<string | null>(null)
  const [hasUserEdited, setHasUserEdited] = useState(false)

  useEffect(() => {
    setCleanForm(null)
    setHasUserEdited(false)
    bodyInteractionRef.current = false
  }, [template])

  useEffect(() => {
    if (hasUserEdited) return
    const id = window.setTimeout(() => {
      setCleanForm(currentFormJson)
    }, 0)
    return () => window.clearTimeout(id)
  }, [currentFormJson, hasUserEdited])

  const markUserEdited = useCallback(() => {
    setHasUserEdited(true)
  }, [])

  const markBodyInteracted = useCallback(() => {
    bodyInteractionRef.current = true
  }, [])

  const isDirty =
    hasUserEdited && cleanForm !== null && currentFormJson !== cleanForm

  const { UnsavedChangesDialog, requestNavigation } = useUnsavedChangesGuard(
    isDirty,
    {
      message: "You have unsaved changes to this email template.",
    }
  )

  // ── Variable insertion ──
  const insertVariable = useCallback(
    (path: string) => {
      markUserEdited()
      const insertion = `{{${path}}}`

      if (activeField === "subject") {
        const ref = subjectRef.current
        if (!ref) {
          // Fallback: append
          setSubject((prev) => prev + insertion)
          return
        }

        const start = ref.selectionStart
        const end = ref.selectionEnd
        const value = ref.value
        const newValue = value.slice(0, start) + insertion + value.slice(end)
        setSubject(newValue)

        requestAnimationFrame(() => {
          const newCursorPos = start + insertion.length
          ref.focus()
          ref.setSelectionRange(newCursorPos, newCursorPos)
        })
      } else {
        // Insert into rich editor via imperative handle
        if (richEditorRef.current) {
          richEditorRef.current.insertVariable(insertion)
        } else {
          // Fallback: append
          setHtmlBody((prev) => prev + insertion)
        }
      }
    },
    [activeField, markUserEdited]
  )

  // ── Save ──
  async function handleSave() {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "Template name is required"
    if (!slug.trim()) newErrors.slug = "Slug is required"
    if (!category) newErrors.category = "Category is required"
    if (category === "custom" && !customCategory.trim())
      newErrors.customCategory = "Custom category name is required"
    if (!subject.trim()) newErrors.subject = "Subject line is required"
    if (!htmlBody.trim()) newErrors.htmlBody = "Email body is required"
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fill in all required fields")
      return
    }
    setErrors({})

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name,
        slug,
        subjectTemplate: subject,
        htmlTemplate: htmlBody,
        category: category === "custom" ? customCategory.trim() : category,
        companyId,
        ...(propertyId && { propertyId }),
        status: templateStatus,
      }

      if (isEdit && template?.id) {
        if (isSystemDefault) {
          delete body.name
          delete body.slug
          delete body.category
        }
        const res = await fetch(
          `/api/v1/automations/email-templates/${template.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          }
        )
        const resData = await res.json()
        if (!res.ok) {
          throw new Error(resData?.message ?? `Save failed (${res.status})`)
        }
      } else {
        const res = await fetch("/api/v1/automations/email-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const resData = await res.json()
        if (!res.ok) {
          const message =
            resData?.error?.message ||
            resData?.details ||
            `Create failed (${res.status})`
          throw new Error(message)
        }
      }

      setCleanForm(currentFormJson)
      setHasUserEdited(false)
      bodyInteractionRef.current = false

      toast.success(isEdit ? "Template updated" : "Template created")
      router.push(
        `/dashboard/${propertyId}/automations?tab=email-templates`
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // ── Preview snapshot ──
  const previewTemplate = useMemo(
    () => ({
      id: (template?.id as string) ?? "new",
      subject_template: subject,
      html_template: htmlBody,
    }),
    [template?.id, subject, htmlBody]
  )

  // ── Back handler with dirty guard ──
  const handleBack = useCallback(() => {
    requestNavigation(() => {
      router.push(`/dashboard/${propertyId}/automations?tab=email-templates`)
    })
  }, [requestNavigation, router, propertyId])

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
              onClick={handleBack}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                  {isEdit ? "Edit Email Template" : "New Email Template"}
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
                  ? "Modify this email template's content and settings."
                  : "Create a new email template."}
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
              onClick={() => setPreviewOpen(true)}
              disabled={!htmlBody.trim()}
            >
              <Eye className="mr-1 h-4 w-4 shrink-0" />
              Preview
            </Button>

            {canSave && (
              <Button
                className="w-full sm:w-auto"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="mr-1 h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Save className="mr-1 h-4 w-4 shrink-0" />
                )}
                <span className="truncate sm:whitespace-normal">
                  <span className="sm:hidden">
                    {isEdit ? "Save" : "Create"}
                  </span>
                  <span className="hidden sm:inline">
                    {isEdit ? "Save Changes" : "Create Template"}
                  </span>
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main content + variable side panel */}
      <div className="flex flex-col lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
        {/* Main form area */}
        <div className="flex flex-col gap-3 px-4 py-3 pb-8 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:px-5 lg:pb-6">
          <div className="shrink-0 space-y-3">
          {isSystemDefault && (
            <div className="rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-400">
              System template — name, slug, and category are read-only.
            </div>
          )}

          {/* Name & Slug row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-name">
                Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tmpl-name"
                value={name}
                onChange={(e) => {
                  markUserEdited()
                  setName(e.target.value)
                  if (errors.name) setErrors((prev) => ({ ...prev, name: "" }))
                }}
                disabled={isSystemDefault}
                placeholder="Welcome Email"
                required
                className={cn(
                  errors.name &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {errors.name && (
                <p className="text-xs text-red-500 mt-1">{errors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-slug">
                Slug <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tmpl-slug"
                value={slug}
                onChange={(e) => {
                  markUserEdited()
                  setSlug(e.target.value)
                  if (errors.slug) setErrors((prev) => ({ ...prev, slug: "" }))
                }}
                disabled={isEdit}
                placeholder="welcome-email"
                className={cn(
                  "font-mono",
                  errors.slug && "border-red-500 focus-visible:ring-red-500"
                )}
                required
              />
              {errors.slug && (
                <p className="text-xs text-red-500 mt-1">{errors.slug}</p>
              )}
            </div>
          </div>

          {/* Category & Status */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>
                Category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={category}
                onValueChange={(v) => {
                  markUserEdited()
                  setCategory(v)
                  if (errors.category)
                    setErrors((prev) => ({ ...prev, category: "" }))
                }}
                disabled={isSystemDefault}
              >
                <SelectTrigger
                  className={cn(
                    errors.category &&
                      "border-red-500 focus-visible:ring-red-500"
                  )}
                >
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-xs text-red-500 mt-1">{errors.category}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={templateStatus}
                onValueChange={(value) => {
                  markUserEdited()
                  setTemplateStatus(value)
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {category === "custom" && (
            <div className="space-y-1.5">
              <Label htmlFor="tmpl-custom-category">
                Custom category <span className="text-red-500">*</span>
              </Label>
              <Input
                id="tmpl-custom-category"
                value={customCategory}
                onChange={(e) => {
                  markUserEdited()
                  setCustomCategory(e.target.value)
                  if (errors.customCategory)
                    setErrors((prev) => ({
                      ...prev,
                      customCategory: "",
                    }))
                }}
                placeholder="Enter custom category name"
                className={cn(
                  errors.customCategory &&
                    "border-red-500 focus-visible:ring-red-500"
                )}
              />
              {errors.customCategory && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.customCategory}
                </p>
              )}
            </div>
          )}

          </div>

          {/* Subject */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="tmpl-subject"
              ref={subjectRef}
              value={subject}
              rows={2}
              onChange={(e) => {
                markUserEdited()
                setSubject(e.target.value)
                if (errors.subject)
                  setErrors((prev) => ({ ...prev, subject: "" }))
              }}
              onFocus={() => setActiveField("subject")}
              placeholder="Welcome to {{property.name}}!"
              required
              className={cn(
                "resize-none",
                errors.subject && "border-red-500 focus-visible:ring-red-500"
              )}
            />
            {errors.subject && (
              <p className="text-xs text-red-500 mt-1">{errors.subject}</p>
            )}
          </div>

          {/* Email Body */}
          <div className="flex flex-col gap-1.5 lg:min-h-[700px] lg:flex-1">
            <Label>
              Email Body <span className="text-red-500">*</span>
            </Label>
            <div
              className="h-[min(560px,72vh)] shrink-0 overflow-hidden rounded-md sm:h-[min(640px,74vh)] lg:h-auto lg:min-h-[660px] lg:flex-1"
              onFocus={() => {
                setActiveField("body")
              }}
              onKeyDown={markBodyInteracted}
              onPaste={markBodyInteracted}
              onPointerDown={markBodyInteracted}
            >
              <RichEditor
                ref={richEditorRef}
                value={htmlBody}
                onChange={(val) => {
                  if (bodyInteractionRef.current && val !== htmlBody) {
                    markUserEdited()
                  }
                  setHtmlBody(val)
                  if (errors.htmlBody)
                    setErrors((prev) => ({ ...prev, htmlBody: "" }))
                }}
                placeholder="Write your email content here..."
                minHeight="100%"
                className="h-full flex flex-col"
                toolbarEnd={
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
                }
              />
            </div>
            {errors.htmlBody && (
              <p className="text-xs text-red-500 shrink-0">{errors.htmlBody}</p>
            )}
          </div>
        </div>

        {/* Variable side panel — desktop */}
        <div className="hidden shrink-0 overflow-hidden border-l transition-[width] duration-200 lg:flex w-[21rem] 2xl:w-[32rem]">
          <EmailTemplateVariablePanel
            onInsert={insertVariable}
            activeField={activeField}
          />
        </div>
      </div>

      <Sheet open={variablesOpen} onOpenChange={setVariablesOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[min(85dvh,640px)] w-full max-w-full flex-col gap-0 p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Available Variables</SheetTitle>
            <SheetDescription>
              Insert merge fields into the template
            </SheetDescription>
          </SheetHeader>
          <EmailTemplateVariablePanel
            onInsert={insertVariable}
            activeField={activeField}
            onAfterInsert={() => setVariablesOpen(false)}
            className="h-full w-full"
          />
        </SheetContent>
      </Sheet>

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
            <SheetTitle>Template Preview</SheetTitle>
            <SheetDescription>
              Preview with sample data
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <EmailTemplatePreview template={previewTemplate} />
          </div>
        </SheetContent>
      </Sheet>

      <UnsavedChangesDialog />
    </div>
  )
}

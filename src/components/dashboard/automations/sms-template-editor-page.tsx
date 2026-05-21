"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { usePageLeaveGuard, useGuardedNavigate } from "@/hooks/use-page-leave-guard"
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
import { SmsTemplateVariablePanel } from "./sms-template-variable-panel"
import { getSampleData } from "@/lib/email/variable-definitions"
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

type SmsTemplateEditorPageProps = {
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

const SMS_SOFT_LIMIT = 160
const SMS_HARD_LIMIT = 1600

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function replaceVariables(
  text: string,
  sampleData: Record<string, unknown>
): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const parts = path.trim().split(".")
    let current: unknown = sampleData
    for (const part of parts) {
      if (
        current &&
        typeof current === "object" &&
        part in (current as Record<string, unknown>)
      ) {
        current = (current as Record<string, unknown>)[part]
      } else {
        return _match
      }
    }
    return typeof current === "string" ? current : _match
  })
}

// ============================================================================
// Component
// ============================================================================

export function SmsTemplateEditorPage({
  propertyId,
  companyId,
  template,
  isSystemDefault = false,
}: SmsTemplateEditorPageProps) {
  const router = useRouter()
  const { can } = usePermissions()
  const canSave =
    can("automations.add_sms_templates") ||
    can("automations.edit_sms_templates")
  const isEdit = template !== null && template !== undefined

  // ── Form state ──
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [category, setCategory] = useState("")
  const [body, setBody] = useState("")
  const [templateStatus, setTemplateStatus] = useState<string>("draft")
  const [saving, setSaving] = useState(false)
  const [customCategory, setCustomCategory] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // ── Textarea ref for variable insertion ──
  const bodyRef = useRef<HTMLTextAreaElement>(null)

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
  const cleanFormRef = useRef("")
  useEffect(() => {
    if (template) {
      setName((template.name as string) ?? "")
      setSlug((template.slug as string) ?? "")
      setCategory((template.category as string) ?? "")
      setBody((template.body as string) ?? "")
      setTemplateStatus((template.status as string) ?? "draft")
    } else {
      setName("")
      setSlug("")
      setCategory("")
      setCustomCategory("")
      setBody("")
      setTemplateStatus("draft")
    }
    setErrors({})
    // Baseline for dirty tracking
    cleanFormRef.current = JSON.stringify({
      name: template ? (template.name as string) ?? "" : "",
      slug: template ? (template.slug as string) ?? "" : "",
      category: template ? (template.category as string) ?? "" : "",
      customCategory: template ? "" : "",
      body: template ? (template.body as string) ?? "" : "",
      templateStatus: template ? (template.status as string) ?? "draft" : "draft",
    })
  }, [template])

  // ── Auto-generate slug from name on create ──
  useEffect(() => {
    if (!isEdit && name) {
      setSlug(slugify(name))
    }
  }, [name, isEdit])

  // ── Dirty tracking ──
  const isDirty =
    JSON.stringify({
      name,
      slug,
      category,
      customCategory,
      body,
      templateStatus,
    }) !== cleanFormRef.current

  usePageLeaveGuard(isDirty)

  // ── Variable insertion ──
  const insertVariable = useCallback((path: string) => {
    const textarea = bodyRef.current
    if (!textarea) {
      setBody((prev) => prev + `{{${path}}}`)
      return
    }

    const tag = `{{${path}}}`
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const value = textarea.value

    const newValue = value.substring(0, start) + tag + value.substring(end)
    setBody(newValue)

    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length
      textarea.focus()
    })
  }, [])

  // ── Save ──
  async function handleSave() {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "Template name is required"
    if (!slug.trim()) newErrors.slug = "Slug is required"
    if (!category) newErrors.category = "Category is required"
    if (category === "custom" && !customCategory.trim())
      newErrors.customCategory = "Custom category name is required"
    if (!body.trim()) newErrors.body = "SMS body is required"
    if (body.length > SMS_HARD_LIMIT)
      newErrors.body = `SMS body cannot exceed ${SMS_HARD_LIMIT} characters`
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      toast.error("Please fill in all required fields")
      return
    }
    setErrors({})

    setSaving(true)
    try {
      const requestBody: Record<string, unknown> = {
        name,
        slug,
        body,
        category: category === "custom" ? customCategory.trim() : category,
        companyId,
        ...(propertyId && { propertyId }),
        status: templateStatus,
      }

      if (isEdit && template?.id) {
        if (isSystemDefault) {
          delete requestBody.name
          delete requestBody.slug
          delete requestBody.category
        }
        const res = await fetch(
          `/api/v1/automations/sms-templates/${template.id}?propertyId=${propertyId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          }
        )
        const resData = await res.json()
        if (!res.ok) {
          throw new Error(
            resData?.error?.message ?? `Save failed (${res.status})`
          )
        }
      } else {
        const res = await fetch(
          `/api/v1/automations/sms-templates?propertyId=${propertyId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          }
        )
        const resData = await res.json()
        if (!res.ok) {
          const message =
            resData?.error?.message ||
            resData?.details ||
            `Create failed (${res.status})`
          throw new Error(message)
        }
      }

      // Update clean baseline so dirty tracking resets
      cleanFormRef.current = JSON.stringify({
        name,
        slug,
        category,
        customCategory,
        body,
        templateStatus,
      })

      toast.success(isEdit ? "Template updated" : "Template created")
      router.push(
        `/dashboard/${propertyId}/automations?tab=sms-templates`
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // ── Preview snapshot ──
  const previewText = useMemo(() => {
    if (!body) return ""
    return replaceVariables(body, getSampleData())
  }, [body])

  // ── Character count styling ──
  const charCount = body.length
  const charCountColor =
    charCount > SMS_HARD_LIMIT
      ? "text-red-500"
      : charCount > SMS_SOFT_LIMIT
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground"

  // ── Back handler with dirty guard ──
  const goBack = useGuardedNavigate(isDirty)

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
                goBack(
                  `/dashboard/${propertyId}/automations?tab=sms-templates`
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
                  {isEdit ? "Edit SMS Template" : "New SMS Template"}
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
                  ? "Modify this SMS template's content and settings."
                  : "Create a new SMS template."}
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
              disabled={!body.trim()}
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
        <div className="flex flex-col gap-3 px-4 py-3 pb-8 lg:min-h-0 lg:flex-1 lg:overflow-hidden lg:px-5 lg:pb-3">
          <div className="shrink-0 space-y-3">
            {isSystemDefault && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400">
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
                    setName(e.target.value)
                    if (errors.name)
                      setErrors((prev) => ({ ...prev, name: "" }))
                  }}
                  disabled={isSystemDefault}
                  placeholder="Welcome SMS"
                  required
                  className={cn(
                    errors.name &&
                    "border-red-500 focus-visible:ring-red-500"
                  )}
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-500">{errors.name}</p>
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
                    setSlug(e.target.value)
                    if (errors.slug)
                      setErrors((prev) => ({ ...prev, slug: "" }))
                  }}
                  disabled={isEdit}
                  placeholder="welcome-sms"
                  className={cn(
                    "font-mono",
                    errors.slug && "border-red-500 focus-visible:ring-red-500"
                  )}
                  required
                />
                {errors.slug && (
                  <p className="mt-1 text-xs text-red-500">{errors.slug}</p>
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
                  <p className="mt-1 text-xs text-red-500">
                    {errors.category}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={templateStatus}
                  onValueChange={setTemplateStatus}
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
                  <p className="mt-1 text-xs text-red-500">
                    {errors.customCategory}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* SMS Body */}
          <div className="flex flex-col gap-1.5 lg:min-h-0 lg:flex-1">
            <div className="flex items-center justify-between">
              <Label>
                SMS Body <span className="text-red-500">*</span>
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs lg:hidden"
                onClick={() => setVariablesOpen(true)}
              >
                <Braces className="h-3.5 w-3.5" />
                Variables
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  if (errors.body)
                    setErrors((prev) => ({ ...prev, body: "" }))
                }}
                placeholder="Hi {{guest.first_name}}, welcome to {{property.name}}!"
                required
                className={cn(
                  "min-h-[180px] flex-1 resize-none lg:min-h-0",
                  errors.body && "border-red-500 focus-visible:ring-red-500"
                )}
              />
            </div>
            <div className="flex shrink-0 items-center justify-between">
              <span className={cn("text-xs", charCountColor)}>
                {charCount} / {SMS_SOFT_LIMIT} characters
                {charCount > SMS_SOFT_LIMIT &&
                  charCount <= SMS_HARD_LIMIT &&
                  " (will be sent as multiple messages)"}
                {charCount > SMS_HARD_LIMIT && " (exceeds limit)"}
              </span>
            </div>
            {errors.body && (
              <p className="shrink-0 text-xs text-red-500">{errors.body}</p>
            )}
          </div>
        </div>

        {/* Variable side panel — desktop */}
        <div className="hidden shrink-0 overflow-hidden border-l transition-[width] duration-200 lg:flex w-[21rem] 2xl:w-[32rem]">
          <SmsTemplateVariablePanel onInsert={insertVariable} />
        </div>
      </div>

      {/* Variables sheet — mobile */}
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
          <SmsTemplateVariablePanel
            onInsert={insertVariable}
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
              : "h-full w-full max-w-[100vw] sm:w-[500px] sm:max-w-[500px]"
          )}
        >
          <SheetHeader className="shrink-0 space-y-1 border-b px-4 py-4 text-left">
            <SheetTitle>Template Preview</SheetTitle>
            <SheetDescription>Preview with sample data</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Preview (with sample data)
              </p>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {previewText || (
                  <span className="text-muted-foreground">
                    No content to preview.
                  </span>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"
import { Button } from "@/components/ui/button"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { VariableSelect } from "@/components/ui/rich-editor"
import { VARIABLE_GROUPS, getSampleData } from "@/lib/email/variable-definitions"
import { toast } from "sonner"
import { Save, Loader2 } from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"

type SmsTemplateFormDialogProps = {
  template: Record<string, unknown> | null
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  companyId: string
  onSaved: () => void
}

const CATEGORIES = [
  { value: "welcome", label: "Welcome" },
  { value: "reservation", label: "Reservation" },
  { value: "payment", label: "Payment" },
  { value: "review", label: "Review" },
  { value: "notification", label: "Notification" },
  { value: "custom", label: "Custom" },
]

const SMS_MAX_LENGTH = 160

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function replaceVariables(text: string, sampleData: Record<string, unknown>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const parts = path.trim().split(".")
    let current: unknown = sampleData
    for (const part of parts) {
      if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[part]
      } else {
        return _match
      }
    }
    return typeof current === "string" ? current : _match
  })
}

export function SmsTemplateFormDialog({
  template,
  open,
  onOpenChange,
  propertyId,
  companyId,
  onSaved,
}: SmsTemplateFormDialogProps) {
  const { can } = usePermissions()
  const canSave = can("automations.add_sms_templates") || can("automations.edit_sms_templates")
  const isEdit = template !== null
  const isSystemDefault = (template?.is_system_default as boolean) ?? false

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [category, setCategory] = useState("")
  const [body, setBody] = useState("")
  const [templateStatus, setTemplateStatus] = useState<string>("draft")
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("edit")
  const [customCategory, setCustomCategory] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Populate on mount / template change
  const cleanFormRef = useRef("")
  useEffect(() => {
    if (!open) return
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
    setTab("edit")
    setErrors({})
    cleanFormRef.current = JSON.stringify({
      name: template ? (template.name as string) ?? "" : "",
      slug: template ? (template.slug as string) ?? "" : "",
      category: template ? (template.category as string) ?? "" : "",
      customCategory: template ? "" : "",
      body: template ? (template.body as string) ?? "" : "",
      templateStatus: template ? (template.status as string) ?? "draft" : "draft",
    })
  }, [template, open])

  // Auto-generate slug from name on create
  useEffect(() => {
    if (!isEdit && name) {
      setSlug(slugify(name))
    }
  }, [name, isEdit])

  const isDirty = JSON.stringify({ name, slug, category, customCategory, body, templateStatus }) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const insertVariable = useCallback((path: string) => {
    const ref = bodyRef.current
    if (!ref) return

    const start = ref.selectionStart
    const end = ref.selectionEnd
    const value = ref.value
    const insertion = `{{${path}}}`

    const newValue = value.slice(0, start) + insertion + value.slice(end)
    setBody(newValue)

    requestAnimationFrame(() => {
      const newCursorPos = start + insertion.length
      ref.focus()
      ref.setSelectionRange(newCursorPos, newCursorPos)
    })
  }, [])

  async function handleSave() {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "Template name is required"
    if (!slug.trim()) newErrors.slug = "Slug is required"
    if (!category) newErrors.category = "Category is required"
    if (category === "custom" && !customCategory.trim()) newErrors.customCategory = "Custom category name is required"
    if (!body.trim()) newErrors.body = "SMS body is required"
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
        status: templateStatus,
        companyId,
        ...(propertyId && { propertyId }),
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
          },
        )
        if (!res.ok) {
          const resData = await res.json()
          throw new Error(resData?.error?.message ?? `Save failed (${res.status})`)
        }
      } else {
        const res = await fetch(
          `/api/v1/automations/sms-templates?propertyId=${propertyId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
          },
        )
        if (!res.ok) {
          const resData = await res.json()
          const message = resData?.error?.message || resData?.details || `Create failed (${res.status})`
          throw new Error(message)
        }
      }
      onSaved()
      onOpenChange(false)
      toast.success(isEdit ? "Template updated" : "Template created")
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong"
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // Preview text with variables replaced
  const previewText = useMemo(() => {
    if (!body) return ""
    return replaceVariables(body, getSampleData())
  }, [body])

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent wide className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit SMS Template" : "Create SMS Template"}</DialogTitle>
          <DialogDescription>
            {isSystemDefault
              ? "System templates: name, slug, and category are read-only."
              : isEdit
                ? "Update the template fields below."
                : "Fill in the fields to create a new SMS template."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview" disabled={!body}>
              Preview
            </TabsTrigger>
          </TabsList>

          <TabsContent value="edit" className="w-full space-y-4 pt-2">
            {/* Name & Slug row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-name">Name <span className="text-red-500">*</span></Label>
                <Input
                  id="tmpl-name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (errors.name) setErrors(prev => ({ ...prev, name: "" }))
                  }}
                  disabled={isSystemDefault}
                  placeholder="Welcome SMS"
                  required
                  className={cn(errors.name && "border-red-500 focus-visible:ring-red-500")}
                />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-slug">Slug <span className="text-red-500">*</span></Label>
                <Input
                  id="tmpl-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value)
                    if (errors.slug) setErrors(prev => ({ ...prev, slug: "" }))
                  }}
                  disabled={isEdit}
                  placeholder="welcome-sms"
                  className={cn("font-mono", errors.slug && "border-red-500 focus-visible:ring-red-500")}
                  required
                />
                {errors.slug && <p className="text-xs text-red-500 mt-1">{errors.slug}</p>}
              </div>
            </div>

            {/* Category & Status row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Category <span className="text-red-500">*</span></Label>
                <Select value={category} onValueChange={(v) => { setCategory(v); if (errors.category) setErrors(prev => ({ ...prev, category: "" })) }} disabled={isSystemDefault}>
                  <SelectTrigger className={cn(errors.category && "border-red-500 focus-visible:ring-red-500")}>
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
                {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
                {category === "custom" && (
                  <div className="mt-2">
                    <Input
                      value={customCategory}
                      onChange={(e) => {
                        setCustomCategory(e.target.value)
                        if (errors.customCategory) setErrors(prev => ({ ...prev, customCategory: "" }))
                      }}
                      placeholder="Enter custom category name"
                      className={cn(errors.customCategory && "border-red-500 focus-visible:ring-red-500")}
                    />
                    {errors.customCategory && <p className="text-xs text-red-500 mt-1">{errors.customCategory}</p>}
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={templateStatus} onValueChange={setTemplateStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SMS Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>SMS Body <span className="text-red-500">*</span></Label>
                <VariableSelect onInsert={insertVariable} />
              </div>
              <Textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => {
                  setBody(e.target.value)
                  if (errors.body) setErrors(prev => ({ ...prev, body: "" }))
                }}
                placeholder="Hi {{guest.first_name}}, welcome to {{property.name}}!"
                required
                rows={5}
                className={cn(errors.body && "border-red-500 focus-visible:ring-red-500")}
              />
              <div className={cn(
                "text-xs",
                body.length > SMS_MAX_LENGTH ? "text-red-500" : "text-muted-foreground",
              )}>
                {body.length} / {SMS_MAX_LENGTH} characters
                {body.length > SMS_MAX_LENGTH && " (will be sent as multiple messages)"}
              </div>
              {errors.body && <p className="text-xs text-red-500 mt-1">{errors.body}</p>}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="w-full">
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Preview (with sample data)</p>
              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {previewText || <span className="text-muted-foreground">No content to preview.</span>}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {canSave && (
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />
              {isEdit ? "Save Changes" : "Create Template"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {unsavedChangesDialog}
    </>
  )
}

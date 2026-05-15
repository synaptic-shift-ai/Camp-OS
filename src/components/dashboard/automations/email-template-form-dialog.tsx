"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useDialogCloseGuard } from "@/hooks/use-dialog-close-guard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import { RichEditor, VariableSelect } from "@/components/ui/rich-editor"
import { VARIABLE_GROUPS } from "@/lib/email/variable-definitions"
import { EmailTemplatePreview } from "./email-template-preview"
import { toast } from "sonner"
import { Save, Loader2, Braces } from "lucide-react"
import { usePermissions } from "@/hooks/use-permissions"
import { cn } from "@/lib/utils"

type EmailTemplateFormDialogProps = {
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

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function EmailTemplateFormDialog({
  template,
  open,
  onOpenChange,
  propertyId,
  companyId,
  onSaved,
}: EmailTemplateFormDialogProps) {
  const { can } = usePermissions()
  const canSave = can("automations.add_email_templates") || can("automations.edit_email_templates")
  const isEdit = template !== null
  const isSystemDefault = (template?.system_default as boolean) ?? false

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [category, setCategory] = useState("")
  const [subject, setSubject] = useState("")
  const [htmlBody, setHtmlBody] = useState("")
  const [templateStatus, setTemplateStatus] = useState<string>("draft")
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("edit")
  const [customCategory, setCustomCategory] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Track which textarea is focused for variable insertion
  const subjectRef = useRef<HTMLTextAreaElement>(null)
  const activeFieldRef = useRef<"subject" | null>(null)

  // Populate on mount / template change
  const cleanFormRef = useRef("")
  useEffect(() => {
    if (!open) return
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
      setHtmlBody("")
      setTemplateStatus("draft")
    }
    setTab("edit")
    setErrors({})
    // Baseline for dirty tracking
    cleanFormRef.current = JSON.stringify({
      name: template ? (template.name as string) ?? "" : "",
      slug: template ? (template.slug as string) ?? "" : "",
      category: template ? (template.category as string) ?? "" : "",
      customCategory: template ? "" : "",
      subject: template ? (template.subject_template as string) ?? "" : "",
      htmlBody: template ? (template.html_template as string) ?? "" : "",
      templateStatus: template ? (template.status as string) ?? "draft" : "draft",
    })
  }, [template, open])

  // Auto-generate slug from name on create
  useEffect(() => {
    if (!isEdit && name) {
      setSlug(slugify(name))
    }
  }, [name, isEdit])

  const isDirty = JSON.stringify({ name, slug, category, customCategory, subject, htmlBody, templateStatus }) !== cleanFormRef.current

  const { guardedOnOpenChange, unsavedChangesDialog } = useDialogCloseGuard({
    isDirty,
    open,
    onOpenChange,
  })

  const insertVariable = useCallback((path: string) => {
    // Only handle subject field textarea insertion here
    // Body variable insertion is handled by the RichEditor's VariableSelect
    const ref = subjectRef.current
    if (!ref || activeFieldRef.current !== "subject") return

    const start = ref.selectionStart
    const end = ref.selectionEnd
    const value = ref.value
    const insertion = `{{${path}}}`

    const newValue = value.slice(0, start) + insertion + value.slice(end)
    setSubject(newValue)

    requestAnimationFrame(() => {
      const newCursorPos = start + insertion.length
      ref.focus()
      ref.setSelectionRange(newCursorPos, newCursorPos)
    })
  }, [])

  async function handleSave() {
    // Client-side validation
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = "Template name is required"
    if (!slug.trim()) newErrors.slug = "Slug is required"
    if (!category) newErrors.category = "Category is required"
    if (category === "custom" && !customCategory.trim()) newErrors.customCategory = "Custom category name is required"
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
      }

      console.log('[handleSave] isEdit:', isEdit, 'body:', body)

      if (isEdit && template?.id) {
        // Update — omit read-only fields for system defaults
        if (isSystemDefault) {
          delete body.name
          delete body.slug
          delete body.category
        }
        const res = await fetch(`/api/v1/automations/email-templates/${template.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        console.log('[handleSave] PUT response status:', res.status)
        const resData = await res.json()
        console.log('[handleSave] PUT response data:', resData)
        if (!res.ok) {
          throw new Error(resData?.message ?? `Save failed (${res.status})`)
        }
      } else {
        const res = await fetch("/api/v1/automations/email-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        console.log('[handleSave] POST response status:', res.status)
        const resData = await res.json()
        console.log('[handleSave] POST response data:', resData)
        if (!res.ok) {
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

  // Build current template snapshot for preview
  const currentTemplate = {
    id: (template?.id as string) ?? "new",
    subject_template: subject,
    html_template: htmlBody,
  }

  return (
    <>
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent wide className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Email Template" : "Create Email Template"}</DialogTitle>
          <DialogDescription>
            {isSystemDefault
              ? "System templates: name, slug, and category are read-only."
              : isEdit
                ? "Update the template fields below."
                : "Fill in the fields to create a new email template."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="edit">Edit</TabsTrigger>
            <TabsTrigger value="preview" disabled={!currentTemplate.html_template}>
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
                  placeholder="Welcome Email"
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
                  placeholder="welcome-email"
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

            {/* Subject */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tmpl-subject">Subject <span className="text-red-500">*</span></Label>
                <Select onValueChange={(v) => insertVariable(v)}>
                  <SelectTrigger className="w-[200px] h-8 text-xs">
                    <Braces className="h-3.5 w-3.5 mr-1" />
                    <SelectValue placeholder="Variable" />
                  </SelectTrigger>
                  <SelectContent>
                    {VARIABLE_GROUPS.map((group) => (
                      <SelectGroup key={group.prefix}>
                        <SelectLabel className="text-xs font-medium">{group.label}</SelectLabel>
                        {group.variables.map((v) => (
                          <SelectItem key={v.path} value={v.path} className="text-xs font-mono">
                            {'{{' + v.path + '}}'}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Textarea
                id="tmpl-subject"
                ref={subjectRef}
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value)
                  if (errors.subject) setErrors(prev => ({ ...prev, subject: "" }))
                }}
                onFocus={() => { activeFieldRef.current = "subject" }}
                placeholder="Welcome to {{property.name}}!"
                required
                className={cn(errors.subject && "border-red-500 focus-visible:ring-red-500")}
              />
              {errors.subject && <p className="text-xs text-red-500 mt-1">{errors.subject}</p>}
            </div>

            {/* Email Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Email Body <span className="text-red-500">*</span></Label>
                <VariableSelect
                  onInsert={(path) => {
                    const insertion = `{{${path}}}`
                    const selection = window.getSelection()
                    if (selection && selection.rangeCount > 0) {
                      const range = selection.getRangeAt(0)
                      // Try to find the contenteditable div inside the RichEditor
                      const editor = document.querySelector('[contenteditable]')
                      if (editor && editor.contains(range.commonAncestorContainer)) {
                        range.deleteContents()
                        const textNode = document.createTextNode(insertion)
                        range.insertNode(textNode)
                        range.setStartAfter(textNode)
                        range.collapse(true)
                        selection.removeAllRanges()
                        selection.addRange(range)
                        // Trigger input event so React picks up the change
                        editor.dispatchEvent(new Event('input', { bubbles: true }))
                        return
                      }
                    }
                    // Fallback: append to current htmlBody
                    setHtmlBody(htmlBody + insertion)
                  }}
                />
              </div>
              <RichEditor
                value={htmlBody}
                onChange={(val) => {
                  setHtmlBody(val)
                  if (errors.htmlBody) setErrors(prev => ({ ...prev, htmlBody: "" }))
                }}
                placeholder="Write your email content here..."
                minHeight="300px"
              />
              {errors.htmlBody && <p className="text-xs text-red-500 mt-1">{errors.htmlBody}</p>}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="w-full">
            <EmailTemplatePreview template={currentTemplate} />
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

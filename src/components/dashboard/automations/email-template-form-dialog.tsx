"use client"

import { useState, useRef, useCallback, useEffect } from "react"
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
import { Save, Loader2, Braces } from "lucide-react"

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
  companyId,
  onSaved,
}: EmailTemplateFormDialogProps) {
  const isEdit = template !== null
  const isSystemDefault = (template?.system_default as boolean) ?? false

  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [category, setCategory] = useState("")
  const [subject, setSubject] = useState("")
  const [htmlBody, setHtmlBody] = useState("")
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState("edit")

  // Track which textarea is focused for variable insertion
  const subjectRef = useRef<HTMLTextAreaElement>(null)
  const activeFieldRef = useRef<"subject" | null>(null)

  // Populate on mount / template change
  useEffect(() => {
    if (!open) return
    if (template) {
      setName((template.name as string) ?? "")
      setSlug((template.slug as string) ?? "")
      setCategory((template.category as string) ?? "")
      setSubject((template.subject_template as string) ?? "")
      setHtmlBody((template.html_template as string) ?? "")
    } else {
      setName("")
      setSlug("")
      setCategory("")
      setSubject("")
      setHtmlBody("")
    }
    setTab("edit")
  }, [template, open])

  // Auto-generate slug from name on create
  useEffect(() => {
    if (!isEdit && name) {
      setSlug(slugify(name))
    }
  }, [name, isEdit])

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
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name,
        slug,
        subjectTemplate: subject,
        htmlTemplate: htmlBody,
        category,
        companyId,
      }

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
        if (!res.ok) {
 const errData = await res.json().catch(() => null)
 throw new Error(errData?.message ?? `Save failed (${res.status})`)
 }
        await res.json()
      } else {
        const res = await fetch("/api/v1/automations/email-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) throw new Error(`Create failed (${res.status})`)
        await res.json()
      }
      onSaved()
      onOpenChange(false)
    } catch (e) {
      // TODO: surface error to user
      console.error(e)
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide className="sm:max-w-3xl">
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

          <TabsContent value="edit" className="space-y-4 pt-2">
            {/* Name & Slug row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-name">Name</Label>
                <Input
                  id="tmpl-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isSystemDefault}
                  placeholder="Welcome Email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tmpl-slug">Slug</Label>
                <Input
                  id="tmpl-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  disabled={isEdit}
                  placeholder="welcome-email"
                  className="font-mono"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory} disabled={isSystemDefault}>
                <SelectTrigger>
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
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="tmpl-subject">Subject</Label>
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
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => { activeFieldRef.current = "subject" }}
                placeholder="Welcome to {{property.name}}!"
              />
            </div>

            {/* Email Body */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Email Body</Label>
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
                onChange={setHtmlBody}
                placeholder="Write your email content here..."
                minHeight="300px"
              />
            </div>
          </TabsContent>

          <TabsContent value="preview">
            <EmailTemplatePreview template={currentTemplate} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4" />
            {isEdit ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

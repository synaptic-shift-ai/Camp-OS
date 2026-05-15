'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { getSampleData } from '@/lib/email/variable-definitions'

type SmsTemplatePreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: Record<string, unknown> | null
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '—') return null
  return (
    <div className="min-w-0 rounded-lg border border-border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground break-words">{value}</p>
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
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

export function SmsTemplatePreviewDialog({ open, onOpenChange, template }: SmsTemplatePreviewDialogProps) {
  const sampleData = getSampleData()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-y-auto overflow-x-hidden bg-background p-6 text-foreground sm:rounded-lg">
        {template ? (
          <>
            <DialogHeader className="space-y-2 pb-5 text-left">
              <DialogTitle className="text-lg font-semibold leading-tight text-foreground">
                Template Details
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                View details for this SMS template.
              </DialogDescription>
            </DialogHeader>

            <div className="min-w-0 space-y-5">
              {/* Header card */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700 font-semibold text-sm dark:bg-blue-950/40 dark:text-blue-400">
                  {String(template.name ?? '')
                    .trim()
                    .split(/\s+/)
                    .filter(Boolean)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2) || 'SMS'}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{template.name as string}</div>
                  <code className="text-xs text-muted-foreground">{template.slug as string}</code>
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Category" value={template.category as string | null} />
                <DetailField label="Description" value={template.description as string | null} />
                <DetailField
                  label="Status"
                  value={(template.status as string) === 'active' ? 'Active' : 'Draft'}
                />
                <DetailField
                  label="System Default"
                  value={template.is_system_default ? 'Yes' : null}
                />
                <DetailField
                  label="Updated"
                  value={template.updated_at ? formatDate(template.updated_at as string) : null}
                />
              </div>

              {/* Body */}
              {template.body ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">SMS Body</p>
                  <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                    {replaceVariables(template.body as string, sampleData)}
                  </div>
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

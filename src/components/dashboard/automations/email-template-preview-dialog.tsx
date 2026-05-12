'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
type EmailTemplatePreviewDialogProps = {
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

export function EmailTemplatePreviewDialog({ open, onOpenChange, template }: EmailTemplatePreviewDialogProps) {
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
                View details for this email template.
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
                    .slice(0, 2) || 'ET'}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{template.name as string}</div>
                  <code className="text-xs text-muted-foreground">{template.slug as string}</code>
                </div>
              </div>

              {/* Metadata grid */}
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="Subject" value={template.subject_template as string | null} />
                <DetailField label="Category" value={template.category as string | null} />
                <DetailField label="Description" value={template.description as string | null} />
                <DetailField
                  label="Status"
                  value={(template.status as string) === 'active' ? 'Active' : 'Draft'}
                />
                <DetailField
                  label="System Default"
                  value={template.system_default ? 'Yes' : null}
                />
                <DetailField
                  label="Updated"
                  value={template.updated_at ? formatDate(template.updated_at as string) : null}
                />
              </div>

              {/* HTML Body */}
              {template.html_template ? (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">HTML Body</p>
                  <div className="min-w-0 rounded-lg border border-border overflow-hidden">
                    <pre className="max-h-96 max-w-full overflow-x-auto overflow-y-auto bg-muted/30 p-4 text-xs leading-relaxed">{template.html_template as string}</pre>
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

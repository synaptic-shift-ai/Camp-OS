'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DashboardActivityLog } from '@/lib/dashboard/queries'

function MetaRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value || value === '—') return null
  return (
    <div className="flex items-baseline gap-2 py-1.5">
      <span className="text-xs uppercase tracking-wide text-muted-foreground shrink-0 w-24">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  )
}

type ActivityLogDetailDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  activityLog: DashboardActivityLog | null
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

function getStringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

export function ActivityLogDetailDialog({
  open,
  onOpenChange,
  activityLog,
}: ActivityLogDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-y-auto bg-background p-6 text-foreground sm:rounded-lg">
        {activityLog ? (() => {
          let parsedDetails: Record<string, unknown> | null = null
          if (activityLog.details) {
            try {
              const parsed = JSON.parse(activityLog.details)
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                parsedDetails = parsed as Record<string, unknown>
              }
            } catch {
              // details is plain text, not JSON — skip the JSON section
            }
          }
          const role = getStringValue(parsedDetails?.role)
          const ip = getStringValue(parsedDetails?.ip)
          const resourceId = getStringValue(parsedDetails?.resourceId)
          const severity = getStringValue(parsedDetails?.severity)

          return (<>
            <DialogHeader className="space-y-2 pb-5 text-left">
              <DialogTitle className="text-lg font-semibold leading-tight text-foreground">
                Activity Log Details
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                View details for this activity log entry.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Section 1 — Header banner: Action + Audit ID side-by-side */}
              <div className="grid grid-cols-2 items-center gap-8 rounded-lg border border-border bg-card/50 p-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Action</span>
                  <span className="text-sm font-semibold text-foreground">{activityLog.action ?? '—'}</span>
                </div>
                <div className="flex items-baseline justify-start gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Audit ID</span>
                  <span className="text-sm font-semibold text-foreground">{activityLog.displayId ?? '—'}</span>
                </div>
              </div>

              {/* Section 2 — Primary info in one section */}
              <div className="rounded-lg border border-border p-4">
                <MetaRow label="User" value={activityLog.userDisplayName} />
                <MetaRow label="Resource" value={activityLog.resource} />
                <MetaRow label="Date" value={formatDateTime(activityLog.createdAt)} />
              </div>

              {/* Section 2b — Optional metadata */}
              {role || ip || resourceId || severity ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {role ? (
                    <div className="rounded-lg border border-border p-4">
                      <MetaRow label="Role" value={role} />
                    </div>
                  ) : null}
                  {ip ? (
                    <div className="rounded-lg border border-border p-4">
                      <MetaRow label="IP" value={ip} />
                    </div>
                  ) : null}
                  {resourceId ? (
                    <div className="rounded-lg border border-border p-4">
                      <MetaRow label="Resource ID" value={resourceId} />
                    </div>
                  ) : null}
                  {severity ? (
                    <div className="rounded-lg border border-border p-4">
                      <MetaRow label="Severity" value={severity} />
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Section 3 — Details */}
              {parsedDetails ? (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Details
                  </p>
                  <pre className="overflow-x-auto rounded-md bg-muted/50 border border-border p-3 text-xs text-foreground font-mono whitespace-pre-wrap break-all max-h-80 overflow-y-auto">
                    {JSON.stringify(parsedDetails, null, 2)}
                  </pre>
                </div>
              ) : activityLog.details ? (
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Details
                  </p>
                  <p className="text-sm text-foreground">{activityLog.details}</p>
                </div>
              ) : null}
            </div>
          </>)
        })() : null}
      </DialogContent>
    </Dialog>
  )
}

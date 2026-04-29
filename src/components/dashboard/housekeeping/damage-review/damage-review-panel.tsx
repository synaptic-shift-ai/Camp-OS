'use client'

/**
 * DamageReviewPanel
 *
 * Displays housekeeping tasks with flagged issues (damage/maintenance).
 * Loads from the housekeeping API, filters for issue_type != null,
 * and displays as cards with issue badges and dismiss buttons.
 */

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, X } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

type FlaggedTask = {
  id: string
  title: string
  issue_type: string | null
  issue_description: string | null
  linked_maintenance_task_id: string | null
  status: string
  priority: string | null
  created_at: string
  site: { site_name: string | null; site_number: string | null } | null
}

type DamageReviewPanelProps = {
  propertyId: string
}

function issueBadgeClass(issueType: string | null): string {
  if (issueType === 'DAMAGE') return 'border-red-200 bg-red-50 text-red-700'
  if (issueType === 'MAINTENANCE') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-zinc-200 bg-zinc-50 text-zinc-700'
}

function statusLabel(status: string): string {
  if (status === 'in_progress') return 'In Progress'
  if (status === 'done') return 'Completed'
  return 'Pending'
}

export function DamageReviewPanel({ propertyId }: DamageReviewPanelProps) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<FlaggedTask[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())

  const loadFlaggedTasks = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/housekeeping?status=all&per_page=100`,
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error?.message ?? 'Failed to load flagged tasks.',
        )
      }

      const flagged = (payload.data?.tasks ?? []).filter(
        (t: FlaggedTask) => t.issue_type !== null,
      )
      setTasks(flagged)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load flagged tasks.'
      toast({
        title: 'Unable to load damage review',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [propertyId, toast])

  useEffect(() => {
    void loadFlaggedTasks()
  }, [loadFlaggedTasks])

  const handleDismiss = async (taskId: string) => {
    setDismissingIds((prev) => new Set(prev).add(taskId))
    try {
      const response = await fetch(
        `/api/v1/properties/${propertyId}/housekeeping/${taskId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ issueType: null }),
        },
      )
      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error?.message ?? 'Failed to dismiss issue.',
        )
      }

      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      toast({
        title: 'Issue dismissed',
        description: 'The issue flag has been cleared.',
        variant: 'success',
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to dismiss issue.'
      toast({
        title: 'Unable to dismiss issue',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setDismissingIds((prev) => {
        const next = new Set(prev)
        next.delete(taskId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-lg border bg-card">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading flagged issues…
        </div>
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Damage Review Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
            <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            No flagged issues. Tasks with damage or maintenance issues will appear here.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {tasks.length} flagged {tasks.length === 1 ? 'issue' : 'issues'}
        </h3>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tasks.map((task) => (
          <Card key={task.id} className="relative">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-sm font-medium leading-snug">
                  {task.title}
                </CardTitle>
                <Badge variant="outline" className={issueBadgeClass(task.issue_type)}>
                  {task.issue_type}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                {task.issue_description?.trim() || `Flagged as ${task.issue_type ?? 'ISSUE'}.`}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{task.site?.site_name?.trim() || task.site?.site_number || 'Unknown site'}</span>
                <span>·</span>
                <span>{statusLabel(task.status)}</span>
              </div>
              {task.linked_maintenance_task_id && (
                <p className="text-xs text-emerald-600">
                  ✓ Maintenance WO created
                </p>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 h-7 gap-1 text-xs"
                disabled={dismissingIds.has(task.id)}
                onClick={() => void handleDismiss(task.id)}
              >
                {dismissingIds.has(task.id) ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                Dismiss
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

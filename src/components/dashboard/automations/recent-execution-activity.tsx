import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import type { AutomationExecutionLogRow } from '@/lib/automations/types'

type Props = {
  executionSummary: { passed: number; failed: number; skipped: number; total: number }
  recentLogs: AutomationExecutionLogRow[]
}

function getOutcome(log: AutomationExecutionLogRow): 'passed' | 'failed' | 'skipped' {
  if (log.conditions_passed === false) return 'skipped'
  if (log.skipped_reason === 'error') return 'failed'
  const actions = log.actions_executed as Array<{ status: string }> | null
  if (actions?.some(a => a.status === 'failed')) return 'failed'
  return 'passed'
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function RecentExecutionActivity({ executionSummary, recentLogs }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Recent Activity (Last 30 Days)</h2>

      {/* Summary badges */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-sm text-muted-foreground">Passed:</span>
          <span className="text-sm font-medium">{executionSummary.passed}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-sm text-muted-foreground">Failed:</span>
          <span className="text-sm font-medium">{executionSummary.failed}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MinusCircle className="h-4 w-4 text-yellow-600" />
          <span className="text-sm text-muted-foreground">Skipped:</span>
          <span className="text-sm font-medium">{executionSummary.skipped}</span>
        </div>
      </div>

      {/* Recent logs list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Execution Log</CardTitle>
        </CardHeader>
        <CardContent className="sm:pt-0">
          {recentLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No execution activity in the last 30 days.</p>
          ) : (
            <div className="space-y-2">
              {recentLogs.slice(0, 20).map(log => {
                const outcome = getOutcome(log)
                return (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="flex items-center gap-3">
                      <Badge variant={outcome === 'passed' ? 'default' : outcome === 'failed' ? 'destructive' : 'secondary'}>
                        {outcome}
                      </Badge>
                      <span className="text-sm">{log.event_type}</span>
                      {log.entity_type && log.entity_id && (
                        <span className="text-xs text-muted-foreground">
                          {log.entity_type}/{log.entity_id.slice(0, 8)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {log.execution_duration_ms != null && (
                        <span className="text-xs text-muted-foreground">{log.execution_duration_ms}ms</span>
                      )}
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(log.created_at)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

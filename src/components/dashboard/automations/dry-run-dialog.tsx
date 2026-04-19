'use client'

/**
 * Dry Run Results Dialog
 *
 * Shows how an automation would perform against historical entity data.
 * Displays matched events table with expandable condition detail.
 * No real actions executed — simulation only.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Loader2, Play, CheckCircle2, XCircle, ChevronDown, ChevronRight, Zap, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

type DryRunMatchedEvent = {
  entityId: string
  entityLabel: string
  eventDate: string
  triggerType: string
  matched: boolean
  conditionsDetail?: {
    passed: boolean
    groups: ConditionGroupResult[]
  }
  actionsWouldExecute?: Array<{
    actionId: string
    actionType: string
  }>
}

type ConditionGroupResult = {
  groupId: string
  logicOperator: string
  passed: boolean
  conditions: ConditionResult[]
  childGroups: ConditionGroupResult[]
}

type ConditionResult = {
  conditionId: string
  variable: string
  operator: string
  expected: unknown
  actual: unknown
  passed: boolean
}

type DryRunResult = {
  automationId: string
  automationName: string
  triggerType: string
  dateRange: { from: string; to: string }
  totalScanned: number
  matchedCount: number
  results: DryRunMatchedEvent[]
  durationMs: number
}

type DryRunDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  automationId: string
  automationName: string
  propertyId: string
}

export function DryRunDialog({
  open,
  onOpenChange,
  automationId,
  automationName,
  propertyId,
}: DryRunDialogProps) {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DryRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const runDryRun = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setExpandedRows(new Set())
    try {
      const res = await fetch(
        `/api/v1/automations/${automationId}/dry-run`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ propertyId, dateRange }),
        }
      )
      const payload = await res.json()
      if (payload.success) {
        setResult(payload.data)
      } else {
        setError(payload.error?.message ?? 'Dry run failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  const toggleRow = (entityId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(entityId)) {
        next.delete(entityId)
      } else {
        next.add(entityId)
      }
      return next
    })
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Dry Run: {automationName}
          </DialogTitle>
        </DialogHeader>

        {/* Controls */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <span className="text-sm text-muted-foreground">Date range:</span>
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as '7d' | '30d' | '90d')}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" onClick={runDryRun} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1" />
                Run Simulation
              </>
            )}
          </Button>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <span className="text-amber-800 dark:text-amber-200">
            Dry run uses current database state. Results may differ from what would have happened at the time of the event.
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Summary bar */}
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline" className="font-mono text-[10px]">
                {result.triggerType}
              </Badge>
              <span className="text-muted-foreground">
                {result.totalScanned} scanned
              </span>
              <span className="text-green-600 font-medium">
                {result.matchedCount} matched
              </span>
              <span className="text-muted-foreground ml-auto">
                {result.durationMs}ms
              </span>
            </div>

            {/* Matched events table */}
            {result.results.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground text-sm">
                No entities found for this trigger type in the selected date range.
              </p>
            ) : (
              <div className="border rounded-lg">
                <Table className="text-xs">
                  <TableHeader className="bg-red-50 dark:bg-red-950/30">
                    <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
                      <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium w-8" />
                      <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
                        Event
                      </TableHead>
                      <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
                        Entity
                      </TableHead>
                      <TableHead className="py-1.5 text-black/90 dark:text-white/90 font-medium">
                        Date
                      </TableHead>
                      <TableHead className="py-1.5 text-right text-black/90 dark:text-white/90 font-medium">
                        Matched
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.results.map((evt) => {
                      const expanded = expandedRows.has(evt.entityId)
                      return (
                        <>
                          <TableRow
                            key={evt.entityId}
                            className={cn(
                              'cursor-pointer hover:bg-muted/30',
                              evt.matched && 'bg-green-50/50 dark:bg-green-950/10'
                            )}
                            onClick={() => toggleRow(evt.entityId)}
                          >
                            <TableCell className="py-2 w-8 px-2">
                              {expanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </TableCell>
                            <TableCell className="py-2">
                              <span className="font-mono text-[10px]">{evt.triggerType}</span>
                            </TableCell>
                            <TableCell className="py-2 font-medium">
                              {evt.entityLabel}
                            </TableCell>
                            <TableCell className="py-2 text-muted-foreground">
                              {formatDate(evt.eventDate)}
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              {evt.matched ? (
                                <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                  Matched
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                                  No match
                                </Badge>
                              )}
                            </TableCell>
                          </TableRow>

                          {/* Expanded detail */}
                          {expanded && (
                            <TableRow key={`${evt.entityId}-detail`}>
                              <TableCell colSpan={5} className="bg-muted/20 px-6 py-3">
                                <div className="space-y-3">
                                  {/* Conditions */}
                                  {evt.conditionsDetail && evt.conditionsDetail.groups.length > 0 ? (
                                    <div>
                                      <h4 className="text-xs font-semibold mb-2">Conditions</h4>
                                      <ConditionTree groups={evt.conditionsDetail.groups} />
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No conditions configured — all events match.</p>
                                  )}

                                  {/* Actions */}
                                  {evt.matched && evt.actionsWouldExecute && evt.actionsWouldExecute.length > 0 && (
                                    <div>
                                      <h4 className="text-xs font-semibold mb-2">Actions that would execute</h4>
                                      <div className="space-y-1">
                                        {evt.actionsWouldExecute.map((action, i) => (
                                          <div key={action.actionId} className="flex items-center gap-2 text-xs">
                                            <span className="text-muted-foreground w-5">{i + 1}.</span>
                                            <Badge variant="outline" className="font-mono text-[10px]">
                                              {action.actionType}
                                            </Badge>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {!evt.matched && (
                                    <p className="text-xs text-muted-foreground">
                                      Conditions did not match — no actions would execute.
                                    </p>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Footer */}
            <p className="text-xs text-muted-foreground text-center">
              Simulation only: No real actions were executed. No side effects occurred. Results are based on historical entity data.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Condition Tree Renderer
// ============================================================================

function ConditionTree({ groups }: { groups: ConditionGroupResult[] }) {
  return (
    <div className="space-y-2">
      {groups.map((group, i) => (
        <div key={group.groupId}>
          <GroupNode group={group} />
          {i < groups.length - 1 && (
            <div className="text-[10px] text-muted-foreground font-medium pl-2 py-0.5">AND</div>
          )}
        </div>
      ))}
    </div>
  )
}

function GroupNode({ group, depth = 0 }: { group: ConditionGroupResult; depth?: number }) {
  return (
    <div className={cn('border-l-2 border-dashed border-muted-foreground/20 pl-3', depth > 0 && 'ml-2 mt-1')}>
      {group.conditions.map((cond) => (
        <div key={cond.conditionId} className="flex items-center gap-2 py-0.5 text-xs">
          {cond.passed ? (
            <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
          ) : (
            <XCircle className="h-3 w-3 text-red-400 shrink-0" />
          )}
          <span className="font-mono text-muted-foreground">{cond.variable}</span>
          <span className="text-muted-foreground">{formatOperator(cond.operator)}</span>
          <span className="font-medium">{formatValue(cond.expected)}</span>
          <span className="text-muted-foreground">(actual: {formatValue(cond.actual)})</span>
        </div>
      ))}
      {group.childGroups.map((child) => (
        <div key={child.groupId} className="mt-1">
          <div className="text-[10px] text-muted-foreground font-medium pl-1">
            {child.logicOperator}
          </div>
          <GroupNode group={child} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

function formatOperator(op: string): string {
  const map: Record<string, string> = {
    IS: '=',
    IS_NOT: '≠',
    GT: '>',
    LT: '<',
    GTE: '≥',
    LTE: '≤',
    BETWEEN: 'between',
    BEFORE: 'before',
    AFTER: 'after',
    CONTAINS: 'contains',
    NOT_CONTAINS: 'not contains',
    IS_TRUE: 'is true',
    IS_FALSE: 'is false',
    WITHIN_DATE_GROUP: 'within',
  }
  return map[op] ?? op
}

function formatValue(val: unknown): string {
  if (val === undefined || val === null) return '—'
  if (typeof val === 'string') return val
  return JSON.stringify(val)
}

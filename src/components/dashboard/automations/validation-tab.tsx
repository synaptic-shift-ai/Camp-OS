'use client'

/**
 * Validation Tab
 *
 * Cross-automation conflict analysis.
 * Fetches validation results and displays issues grouped by severity.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Info, CheckCircle2, Loader2, RefreshCw, ExternalLink } from 'lucide-react'
import type { ValidationIssue, ValidationSeverity, ValidationResult } from '@/lib/automations/validator'

type ValidationTabProps = {
  propertyId: string
}

const SEVERITY_CONFIG: Record<ValidationSeverity, {
  icon: typeof AlertTriangle
  color: string
  bg: string
  border: string
  label: string
}> = {
  error: {
    icon: AlertTriangle,
    color: 'text-red-600',
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Warning',
  },
  info: {
    icon: Info,
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'Info',
  },
}

export function ValidationTab({ propertyId }: ValidationTabProps) {
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<ValidationResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchValidation = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/automations/validation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId }),
      })
      const payload = await res.json()
      if (payload.success) {
        setResult(payload.data)
      } else {
        setError(payload.error?.message ?? 'Validation failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchValidation()
  }, [propertyId])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Validation</h2>
          {result && (
            <div className="flex items-center gap-2 text-sm">
              {result.summary.errors > 0 && (
                <Badge variant="destructive" className="text-[10px]">
                  {result.summary.errors} error{result.summary.errors !== 1 ? 's' : ''}
                </Badge>
              )}
              {result.summary.warnings > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {result.summary.warnings} warning{result.summary.warnings !== 1 ? 's' : ''}
                </Badge>
              )}
              {result.summary.info > 0 && (
                <Badge variant="secondary" className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                  {result.summary.info} info
                </Badge>
              )}
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={fetchValidation} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Revalidate
        </Button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="p-4 bg-destructive/10 rounded-lg text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {result.issues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500 mb-3" />
              <h3 className="text-sm font-medium">No issues found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your automations have no conflicts or warnings.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.issues.map((issue, i) => (
                <IssueCard key={i} issue={issue} propertyId={propertyId} />
              ))}
            </div>
          )}

          {/* Footer note */}
          <p className="text-xs text-muted-foreground mt-4">
            Validation warnings are advisory only and do not block automation creation or execution.
          </p>
        </>
      )}
    </div>
  )
}

// ============================================================================
// Issue Card
// ============================================================================

function IssueCard({ issue, propertyId }: { issue: ValidationIssue; propertyId: string }) {
  const config = SEVERITY_CONFIG[issue.severity]
  const Icon = config.icon

  return (
    <div className={`rounded-lg border ${config.border} ${config.bg} p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${config.color}`} />
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Title + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{issue.title}</span>
            <Badge variant="outline" className="text-[10px] font-mono">
              {issue.phase}
            </Badge>
            <Badge
              variant="secondary"
              className={`text-[10px] ${issue.severity === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : issue.severity === 'warning' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'}`}
            >
              {config.label.toLowerCase()}
            </Badge>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground">{issue.description}</p>

          {/* Related automations */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            {issue.automationNames.map((name, j) => (
              <a
                key={issue.automationIds[j]}
                href={`/dashboard/${propertyId}/automations/${issue.automationIds[j]}/edit`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-background border text-xs font-medium hover:bg-muted/80 transition-colors"
              >
                {name}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

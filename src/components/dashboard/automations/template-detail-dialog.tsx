'use client'

/**
 * Template Detail Dialog Component
 *
 * Displays full template details and provides "Use Template" action
 * to create an automation from the template.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Settings, Shield, DollarSign, FileText, Clock, Zap, AlertCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { PermissionGate } from '@/components/ui/permission-gate'
import type { AutomationTemplate, TemplateCategory } from '@/lib/automations/templates'
import { PHASE_COLORS } from '@/lib/automations/templates'
import type { LucideIcon } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export type TemplateDetailDialogProps = {
  template: AutomationTemplate | null
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  companyId: string
  systemMode?: boolean
}

// ============================================================================
// Category Icon Map
// ============================================================================

const categoryIconMap: Record<TemplateCategory, LucideIcon> = {
  Availability: Shield,
  Pricing: DollarSign,
  Documents: FileText,
  'Guest Comms': Mail,
  Operations: Settings,
}

// ============================================================================
// Helpers
// ============================================================================

function formatActionType(actionType: string): string {
  return actionType
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatTriggerType(triggerType: string): string {
  return triggerType
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' → ')
}

function formatOperator(operator: string): string {
  const operatorLabels: Record<string, string> = {
    IS: 'equals',
    IS_NOT: 'does not equal',
    GT: 'is greater than',
    LT: 'is less than',
    GTE: 'is greater than or equal to',
    LTE: 'is less than or equal to',
    BETWEEN: 'is between',
    BEFORE: 'is before',
    AFTER: 'is after',
    WITHIN_DATE_GROUP: 'is within date group',
    CONTAINS: 'contains',
    NOT_CONTAINS: 'does not contain',
    IS_TRUE: 'is true',
    IS_FALSE: 'is false',
  }
  return operatorLabels[operator] ?? operator
}

// ============================================================================
// Component
// ============================================================================

export function TemplateDetailDialog({
  template,
  open,
  onOpenChange,
  propertyId,
  companyId,
  systemMode,
}: TemplateDetailDialogProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isCreating, setIsCreating] = useState(false)

  if (!template) return null

  const CategoryIcon = categoryIconMap[template.category]
  const phaseColorClass = PHASE_COLORS[template.phase]

  const handleUseTemplate = async () => {
    setIsCreating(true)

    try {
      // Build the request body.
      // Always include companyId so the API doesn't need to query the DB for it
      // (the user's Supabase client may not have RLS access to the companies table).
      const requestBody = {
        ...(companyId ? { companyId } : {}),
        ...(!systemMode ? { propertyId } : {}),
        name: template.name,
        phase: template.phase,
        triggerType: template.triggerType,
        ...(systemMode ? { scope: 'system' } : {}),
        isActive: false, // Create as inactive so user can review
        isTerminal: template.phase === 'GUARD' && template.id === 'no-show-flag',
        conditionGroups: template.conditionGroups?.map((g) => ({
          logicOperator: g.logicOperator,
          conditions: g.conditions.map((c) => ({
            variable: c.variable,
            operator: c.operator,
            value: c.value,
          })),
        })),
        actions: template.actions.map((a, idx) => ({
          actionType: a.actionType,
          actionConfig: a.actionConfig,
          delayValue: a.delayValue,
          delayUnit: a.delayUnit,
          sortOrder: idx,
        })),
      }

      const response = await fetch('/api/v1/automations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        // Prefer specific details message over the generic error code message
        const msg =
          (result.error?.details as { message?: string } | undefined)?.message ||
          result.error?.message ||
          'Failed to create automation'
        throw new Error(msg)
      }

      toast({
        title: 'Automation Created',
        description: `"${template.name}" has been created from template. Review and activate it when ready.`,
        variant: "success",
      })

      onOpenChange(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to create automation from template:', error)
      toast({
        title: 'Failed to Create Automation',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <CategoryIcon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl">{template.name}</DialogTitle>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <Badge variant="outline" className={phaseColorClass}>
                  {template.phase}
                </Badge>
                <Badge variant="secondary">{template.category}</Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Description */}
          <div>
            <h4 className="text-sm font-medium mb-2">Description</h4>
            <p className="text-sm text-muted-foreground">{template.description}</p>
          </div>

          {/* Trigger */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Trigger
            </h4>
            <div className="bg-muted rounded-md px-3 py-2">
              <code className="text-sm font-mono">{formatTriggerType(template.triggerType)}</code>
            </div>
          </div>

          {/* Conditions */}
          {template.conditionGroups && template.conditionGroups.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Conditions
              </h4>
              <div className="space-y-3">
                {template.conditionGroups.map((group, groupIdx) => (
                  <div key={groupIdx} className="bg-muted/50 rounded-md p-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      {group.logicOperator === 'AND' ? 'All of:' : 'Any of:'}
                    </div>
                    <div className="space-y-2">
                      {group.conditions.map((condition, condIdx) => (
                        <div
                          key={condIdx}
                          className="flex flex-wrap items-center gap-2 text-sm"
                        >
                          <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                            {condition.variable}
                          </code>
                          <span className="text-muted-foreground">
                            {formatOperator(condition.operator)}
                          </span>
                          <code className="bg-background px-2 py-1 rounded font-mono text-xs">
                            {String(condition.value)}
                          </code>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Actions ({template.actions.length})
            </h4>
            <div className="space-y-3">
              {template.actions.map((action, idx) => (
                <div key={idx} className="bg-muted/50 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">
                      {formatActionType(action.actionType)}
                    </span>
                    {action.delayValue && action.delayUnit && (
                      <Badge variant="outline" className="text-xs">
                        <Clock className="h-3 w-3 mr-1" />
                        {action.delayValue} {action.delayUnit} delay
                      </Badge>
                    )}
                  </div>
                  {action.actionConfig && Object.keys(action.actionConfig).length > 0 && (
                    <div className="text-xs text-muted-foreground space-y-1">
                      {Object.entries(action.actionConfig).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium">{key}:</span>
                          <span className="font-mono">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <PermissionGate permission={systemMode ? 'automations.add_system_automations' : 'automations.add_automations'}>
            <Button onClick={handleUseTemplate} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Use Template'}
            </Button>
          </PermissionGate>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

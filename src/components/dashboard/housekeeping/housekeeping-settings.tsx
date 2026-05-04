'use client'

/**
 * HousekeepingSettings Component
 *
 * Provides property-level housekeeping configuration options:
 * - housekeepingRequireApproval: When enabled, site auto-available on task completion
 *   is skipped; requires operator approval.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

type HousekeepingSettingsProps = {
  propertyId: string
  canEdit?: boolean
  initialSettings: Record<string, unknown>
}

export function HousekeepingSettings({
  propertyId,
  canEdit = false,
  initialSettings,
}: HousekeepingSettingsProps) {
  const { toast } = useToast()
  const [requireApproval, setRequireApproval] = useState(
    initialSettings.housekeepingRequireApproval === true,
  )
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            ...initialSettings,
            housekeepingRequireApproval: requireApproval,
          },
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message =
          payload?.error?.details?.message ?? payload?.error?.message ?? 'Failed to save settings.'
        throw new Error(message)
      }

      toast({
        title: 'Housekeeping settings saved',
        description: requireApproval
          ? 'Operator approval is now required for site availability.'
          : 'Sites will auto-mark available after task completion.',
        variant: 'success',
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save settings.'
      toast({
        title: 'Unable to save settings',
        description: message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }, [propertyId, requireApproval, initialSettings])

  useEffect(() => {
    setRequireApproval(initialSettings.housekeepingRequireApproval === true)
  }, [initialSettings])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Housekeeping Configuration</CardTitle>
        <CardDescription>
          Configure housekeeping behavior for your property.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="housekeeping-require-approval" className="text-sm font-medium">
              Require Operator Approval for Site Availability
            </Label>
            <p className="text-sm text-muted-foreground">
              When enabled, sites will not auto-mark as available after the last housekeeping task
              is completed. An operator must manually approve the site status change.
            </p>
          </div>
          <Switch
            id="housekeeping-require-approval"
            checked={requireApproval}
            onCheckedChange={canEdit ? (checked: boolean) => setRequireApproval(checked) : () => {}}
            disabled={!canEdit || isSaving}
          />
        </div>

        {canEdit ? (
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="gap-2"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save Changes
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

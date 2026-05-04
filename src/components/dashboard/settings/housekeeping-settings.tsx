'use client'

/**
 * Housekeeping Settings Component
 *
 * Allows property owners to configure housekeeping behavior:
 * - Require operator approval before site transitions to 'available'
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface HousekeepingSettingsProps {
  propertyId: string
  initialRequireApproval: boolean
  canEdit?: boolean
}

export function HousekeepingSettings({
  propertyId,
  initialRequireApproval,
  canEdit = true,
}: HousekeepingSettingsProps) {
  const router = useRouter()
  const [requireApproval, setRequireApproval] = useState(initialRequireApproval)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    setRequireApproval(initialRequireApproval)
  }, [initialRequireApproval])

  const handleToggle = useCallback(() => {
    setRequireApproval((prev) => !prev)
    setHasChanges(true)
  }, [])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: { housekeepingRequireApproval: requireApproval },
        }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error?.message || 'Failed to save housekeeping settings')
      }

      toast.success('Housekeeping settings saved')
      setHasChanges(false)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save'
      toast.error('Save failed', { description: message })
    } finally {
      setIsSaving(false)
    }
  }

  const readOnly = !canEdit

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Housekeeping</CardTitle>
          <CardDescription>
            Configure housekeeping task completion behavior for your property.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between rounded-md border p-4">
            <div className="space-y-0.5">
              <Label htmlFor="housekeeping-require-approval" className="text-sm font-medium">
                Require operator approval to mark sites available
              </Label>
              <p className="text-xs text-muted-foreground">
                When enabled, sites will remain in &quot;Housekeeping&quot; status after the last task
                is completed. An operator must manually mark the site as ready/available.
              </p>
            </div>
            <Switch
              id="housekeeping-require-approval"
              checked={requireApproval}
              onCheckedChange={handleToggle}
              disabled={readOnly}
            />
          </div>

          {canEdit && hasChanges && (
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Settings
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

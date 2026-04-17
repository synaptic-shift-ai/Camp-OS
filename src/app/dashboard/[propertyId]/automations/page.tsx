import { redirect } from 'next/navigation'
import { getPropertyForUser } from '@/lib/dashboard/property-access'
import { resolveDashboardNavVisibility } from '@/lib/dashboard/dashboard-layout-context'
import { listAutomations, listExecutionLogs } from '@/lib/automations/queries'
import { PHASE_ORDER, type AutomationPhase, type AutomationExecutionLogRow } from '@/lib/automations/types'
import { AutomationsPageClient } from './automations-page-client'
import { createClient } from '@/lib/supabase/server'

export default async function AutomationsPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = await params
  const property = await getPropertyForUser(propertyId)
  if (!property) redirect('/auth/login')

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const navVisibility = await resolveDashboardNavVisibility(supabase, propertyId, user.id)
  if (!navVisibility.moduleNavVisible['automations']) redirect(`/dashboard/${propertyId}/access-denied`)

  // Fetch data in parallel
  const [automations, logsResult] = await Promise.all([
    listAutomations(propertyId),
    listExecutionLogs(propertyId, { dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), limit: 100 })
  ])

  // Compute summary stats
  const totalAutomations = automations.length
  const activeCount = automations.filter(a => a.is_active).length
  const inactiveCount = totalAutomations - activeCount

  // Phase distribution
  const phaseDistribution = PHASE_ORDER.map(phase => ({
    phase,
    count: automations.filter(a => a.phase === phase).length
  }))

  // Execution summary
  const recentLogs = logsResult.logs
  const executionSummary = {
    passed: recentLogs.filter(l => l.conditions_passed === true).length,
    failed: recentLogs.filter(l => l.skipped_reason === 'error' || (l.actions_executed as Array<{ status: string }> | null)?.some((a: { status: string }) => a.status === 'failed')).length,
    skipped: recentLogs.filter(l => l.conditions_passed === false).length,
    total: recentLogs.length
  }

  return (
    <AutomationsPageClient
      propertyName={property.name}
      totalAutomations={totalAutomations}
      activeCount={activeCount}
      inactiveCount={inactiveCount}
      phaseDistribution={phaseDistribution}
      executionSummary={executionSummary}
      recentLogs={recentLogs}
    />
  )
}

"use client"

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardSummaryCards } from '@/components/dashboard/automations/dashboard-summary-cards'
import { PhaseDistribution } from '@/components/dashboard/automations/phase-distribution'
import { RecentExecutionActivity } from '@/components/dashboard/automations/recent-execution-activity'
import { ExecutionLogViewer } from '@/components/dashboard/automations/execution-log-viewer'
import type { AutomationPhase, AutomationExecutionLogRow } from '@/lib/automations/types'
import type { ExecutionLogRow } from '@/lib/automations/queries'

type AutomationsDashboardData = {
  propertyName: string
  totalAutomations: number
  activeCount: number
  inactiveCount: number
  phaseDistribution: Array<{ phase: AutomationPhase; count: number }>
  executionSummary: { passed: number; failed: number; skipped: number; total: number }
  recentLogs: AutomationExecutionLogRow[]
}

type ExecutionLogData = {
  logs: ExecutionLogRow[]
  automations: Array<{ id: string; name: string }>
  total: number
  currentPage: number
  pageSize: number
  sortBy: string
  sortOrder: string
  filters: {
    automationId?: string
    outcome?: string
    dateFrom?: string
    dateTo?: string
    search?: string
  }
}

type AutomationsPageClientProps = AutomationsDashboardData & {
  executionLogData?: ExecutionLogData
  activeTab: string
}

export function AutomationsPageClient(data: AutomationsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === "dashboard") {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    const q = params.toString()
    router.push(q ? `${pathname}?${q}` : pathname)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
        <p className="text-muted-foreground">Manage and monitor your property automation rules.</p>
      </div>

      <Tabs value={data.activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="automations" disabled>Automations</TabsTrigger>
          <TabsTrigger value="execution-log">Execution Logs</TabsTrigger>
          <TabsTrigger value="templates" disabled>Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <DashboardSummaryCards
            totalAutomations={data.totalAutomations}
            activeCount={data.activeCount}
            inactiveCount={data.inactiveCount}
          />
          <PhaseDistribution distribution={data.phaseDistribution} />
          <RecentExecutionActivity
            executionSummary={data.executionSummary}
            recentLogs={data.recentLogs}
          />
        </TabsContent>

        <TabsContent value="automations">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Coming Soon</p>
          </div>
        </TabsContent>

        <TabsContent value="execution-log">
          {data.executionLogData ? (
            <ExecutionLogViewer
              logs={data.executionLogData.logs}
              automations={data.executionLogData.automations}
              total={data.executionLogData.total}
              currentPage={data.executionLogData.currentPage}
              pageSize={data.executionLogData.pageSize}
              sortBy={data.executionLogData.sortBy}
              sortOrder={data.executionLogData.sortOrder}
              filters={data.executionLogData.filters}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading execution logs…</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Coming Soon</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

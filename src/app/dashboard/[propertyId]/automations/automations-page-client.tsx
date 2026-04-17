"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardSummaryCards } from '@/components/dashboard/automations/dashboard-summary-cards'
import { PhaseDistribution } from '@/components/dashboard/automations/phase-distribution'
import { RecentExecutionActivity } from '@/components/dashboard/automations/recent-execution-activity'
import type { AutomationPhase, AutomationExecutionLogRow } from '@/lib/automations/types'

type AutomationsDashboardData = {
  propertyName: string
  totalAutomations: number
  activeCount: number
  inactiveCount: number
  phaseDistribution: Array<{ phase: AutomationPhase; count: number }>
  executionSummary: { passed: number; failed: number; skipped: number; total: number }
  recentLogs: AutomationExecutionLogRow[]
}

export function AutomationsPageClient(data: AutomationsDashboardData) {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Automations</h1>
        <p className="text-muted-foreground">Manage and monitor your property automation rules.</p>
      </div>

      <Tabs defaultValue="dashboard" className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="automations" disabled>Automations</TabsTrigger>
          <TabsTrigger value="execution-log" disabled>Execution Log</TabsTrigger>
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
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Coming Soon</p>
          </div>
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

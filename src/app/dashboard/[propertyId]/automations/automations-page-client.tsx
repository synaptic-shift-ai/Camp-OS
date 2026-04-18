"use client"

import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DashboardSummaryCards } from '@/components/dashboard/automations/dashboard-summary-cards'
import { PhaseDistribution } from '@/components/dashboard/automations/phase-distribution'
import { RecentExecutionActivity } from '@/components/dashboard/automations/recent-execution-activity'
import { ExecutionLogViewer } from '@/components/dashboard/automations/execution-log-viewer'
import { TemplatesGrid } from '@/components/dashboard/automations/templates-grid'
import { TemplateDetailDialog } from '@/components/dashboard/automations/template-detail-dialog'
import { DEFAULT_AUTOMATION_TEMPLATES } from '@/lib/automations/templates'
import type { AutomationTemplate } from '@/lib/automations/templates'
import type { AutomationPhase, AutomationExecutionLogRow, AutomationRow } from '@/lib/automations/types'
import { AutomationBuilder } from '@/components/dashboard/automations/automation-builder'
import { EmailTemplatesList } from '@/components/dashboard/automations/email-templates-list'
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
  propertyId?: string
  companyId?: string
  automationsList?: AutomationRow[]
  emailTemplates?: Array<Record<string, unknown>>
}

export function AutomationsPageClient(data: AutomationsPageClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedTemplate, setSelectedTemplate] = useState<AutomationTemplate | null>(null)

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
          <TabsTrigger value="automations">Automations</TabsTrigger>
          <TabsTrigger value="execution-log">Execution Logs</TabsTrigger>
          <TabsTrigger value="email-templates">Email Templates</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
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
          {data.automationsList && data.propertyId ? (
            <AutomationBuilder
              automations={data.automationsList}
              propertyId={data.propertyId}
              companyId={data.companyId ?? ''}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading automations…</p>
            </div>
          )}
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

        <TabsContent value="email-templates">
          {data.propertyId && data.companyId ? (
            <EmailTemplatesList
              templates={data.emailTemplates ?? []}
              propertyId={data.propertyId}
              companyId={data.companyId}
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <p>Loading email templates…</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesGrid
            templates={DEFAULT_AUTOMATION_TEMPLATES}
            onTemplateClick={setSelectedTemplate}
          />
          <TemplateDetailDialog
            template={selectedTemplate}
            open={!!selectedTemplate}
            onOpenChange={(open) => !open && setSelectedTemplate(null)}
            propertyId={data.propertyId ?? ''}
            companyId={data.companyId ?? ''}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

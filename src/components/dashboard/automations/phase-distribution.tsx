import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, DollarSign, Gavel, Cog, MessageSquare, FileText, type LucideIcon } from 'lucide-react'
import type { AutomationPhase } from '@/lib/automations/types'

const PHASE_ICONS: Record<AutomationPhase, LucideIcon> = {
  GUARD: Shield,
  PRICE: DollarSign,
  ENFORCE: Gavel,
  OPERATE: Cog,
  COMMUNICATE: MessageSquare,
  LOG: FileText,
}

const PHASE_COLORS: Record<AutomationPhase, string> = {
  GUARD: 'text-red-600 bg-red-50',
  PRICE: 'text-blue-600 bg-blue-50',
  ENFORCE: 'text-amber-600 bg-amber-50',
  OPERATE: 'text-green-600 bg-green-50',
  COMMUNICATE: 'text-purple-600 bg-purple-50',
  LOG: 'text-gray-600 bg-gray-50',
}

type Props = {
  distribution: Array<{ phase: AutomationPhase; count: number }>
}

export function PhaseDistribution({ distribution }: Props) {
  const total = distribution.reduce((sum, d) => sum + d.count, 0)

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Phase Distribution</h2>
      {total === 0 ? (
        <p className="text-muted-foreground text-sm">No automations configured yet.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {distribution.map(({ phase, count }) => {
            const Icon = PHASE_ICONS[phase]
            return (
              <Card key={phase}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium">{phase}</CardTitle>
                  <div className={`rounded-md p-1.5 ${PHASE_COLORS[phase].split(' ')[1]}`}>
                    <Icon className={`h-3.5 w-3.5 ${PHASE_COLORS[phase].split(' ')[0]}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{count}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Shield, DollarSign, Gavel, Cog, MessageSquare, FileText, type LucideIcon } from 'lucide-react'
import { PHASE_COLORS } from '@/lib/automations/templates'
import type { AutomationPhase } from '@/lib/automations/types'

const PHASE_ICONS: Record<AutomationPhase, LucideIcon> = {
  GUARD: Shield,
  PRICE: DollarSign,
  ENFORCE: Gavel,
  OPERATE: Cog,
  COMMUNICATE: MessageSquare,
  LOG: FileText,
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
        <div className="grid grid-cols-3 gap-2 sm:gap-4 md:grid-cols-6">
          {distribution.map(({ phase, count }) => {
            const Icon = PHASE_ICONS[phase]
            return (
              <Card key={phase}>
                <CardHeader className="flex flex-row items-center justify-between p-2 pb-1 sm:p-4 sm:pb-2">
                  <CardTitle className="text-left text-[9px] font-medium leading-tight text-muted-foreground sm:text-sm">{phase}</CardTitle>
                  <div className={`rounded-md p-1.5 sm:p-2 ${PHASE_COLORS[phase].split(' ')[0]}`}>
                    <Icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${PHASE_COLORS[phase].split(' ')[1]}`} />
                  </div>
                </CardHeader>
                <CardContent className="p-2 pt-0 pb-2 sm:p-4">
                  <div className={"text-left text-xl font-bold sm:text-2xl " + PHASE_COLORS[phase].split(' ')[1]}>{count}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

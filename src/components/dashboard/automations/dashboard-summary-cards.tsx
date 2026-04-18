import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Zap, CheckCircle2, PauseCircle, type LucideIcon } from 'lucide-react'

type Props = {
  totalAutomations: number
  activeCount: number
  inactiveCount: number
}

const cards = [
  { id: 'total', label: 'Total Automations', key: 'totalAutomations' as const, icon: Zap, color: 'text-blue-600' },
  { id: 'active', label: 'Active', key: 'activeCount' as const, icon: CheckCircle2, color: 'text-green-600' },
  { id: 'inactive', label: 'Inactive', key: 'inactiveCount' as const, icon: PauseCircle, color: 'text-muted-foreground' },
]

export function DashboardSummaryCards({ totalAutomations, activeCount, inactiveCount }: Props) {
  const stats = { totalAutomations, activeCount, inactiveCount }

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4">
      {cards.map(card => {
        const Icon = card.icon
        const value = stats[card.key]

        return (
          <Card key={card.id}>
            <CardHeader className="flex flex-row items-center justify-between p-2 pb-1 sm:p-4 sm:pb-2">
              <CardTitle className="text-left text-[9px] font-medium leading-tight text-muted-foreground sm:text-sm">
                {card.label}
              </CardTitle>
              <Icon className={cn('h-3.5 w-3.5 sm:h-4 sm:w-4', card.color)} />
            </CardHeader>
            <CardContent className="p-2 pt-0 pb-2 sm:p-4">
              <div className={cn('text-left text-xl font-bold sm:text-2xl', card.color)}>
                {value}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

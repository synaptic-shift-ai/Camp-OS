import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Zap, CheckCircle2, PauseCircle } from 'lucide-react'

type Props = {
  totalAutomations: number
  activeCount: number
  inactiveCount: number
}

export function DashboardSummaryCards({ totalAutomations, activeCount, inactiveCount }: Props) {
  const cards = [
    { title: 'Total Automations', value: totalAutomations, icon: Zap, color: 'text-blue-600' },
    { title: 'Active', value: activeCount, icon: CheckCircle2, color: 'text-green-600' },
    { title: 'Inactive', value: inactiveCount, icon: PauseCircle, color: 'text-muted-foreground' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map(card => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

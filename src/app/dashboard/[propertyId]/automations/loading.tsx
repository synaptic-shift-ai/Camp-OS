import { Loader2 } from 'lucide-react'

export default function AutomationsLoading() {
  return (
    <div className="flex items-center justify-center min-h-[300px]" aria-busy="true" aria-label="Loading automations">
      <Loader2 className="h-10 w-10 animate-spin stroke-[1] text-muted-foreground" />
    </div>
  )
}

"use client"

import { useCallback, useEffect, useState } from "react"
import { Users, CheckCircle, XCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

const CARD = "rounded-lg border border-stone-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/90"

type ResultStats = {
  total: number
  sent: number
  delivered: number
  failed: number
}

type CampaignResultsDialogProps = {
  campaignId: string
  campaignName?: string
  propertyId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className={cn(CARD, "flex items-center gap-3")}>
      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", color)}>
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <div>
        <p className="text-xl font-semibold tabular-nums">{value.toLocaleString()}</p>
        <p className="text-xs text-stone-500 dark:text-zinc-400">{label}</p>
      </div>
    </div>
  )
}

export function CampaignResultsDialog({
  campaignId,
  campaignName,
  propertyId,
  open,
  onOpenChange,
}: CampaignResultsDialogProps) {
  const [stats, setStats] = useState<ResultStats>({ total: 0, sent: 0, delivered: 0, failed: 0 })
  const [loading, setLoading] = useState(true)

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ propertyId })
      const res = await fetch(`/api/v1/message-campaigns/${campaignId}/results?${params}`)
      const json = await res.json()
      if (!json.success) return
      const results = json.data.results
      setStats({
        total: results?.total ?? 0,
        sent: results?.sent ?? 0,
        delivered: results?.delivered ?? 0,
        failed: results?.failed ?? 0,
      })
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [campaignId, propertyId])

  useEffect(() => {
    if (open) fetchResults()
  }, [open, fetchResults])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Campaign Results</DialogTitle>
          <DialogDescription>
            Delivery results for campaign {campaignName}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total"
              value={stats.total}
              color="bg-stone-100 text-stone-600 dark:bg-zinc-800 dark:text-zinc-400"
            />
            <StatCard
              icon={CheckCircle}
              label="Sent"
              value={stats.sent}
              color="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
            />
            <StatCard
              icon={CheckCircle}
              label="Delivered"
              value={stats.delivered}
              color="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            />
            <StatCard
              icon={XCircle}
              label="Failed"
              value={stats.failed}
              color="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

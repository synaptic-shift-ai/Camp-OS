"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Mail,
  MessageSquare,
  Megaphone,
  Plus,
  Eye,
  Users,
  MoreHorizontal,
  Send,
  Pencil,
  Trash2,
  Ban,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Pagination } from "@/components/ui/pagination"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { CampaignResultsDialog } from "./campaign-results-dialog"

const PANEL = "text-stone-900 dark:text-zinc-100"
const CARD = "rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90"

type Campaign = {
  id: string
  name: string
  channel: "email" | "sms" | "both"
  status: "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled"
  segment_type: string
  sent_at: string | null
  recipient_count: number
  created_at: string
}

const PAGE_SIZE = 10

function ChannelBadge({ channel }: { channel: string }) {
  const config: Record<string, string> = {
    email:
      "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-600/40 dark:bg-blue-950/40 dark:text-blue-200",
    sms:
      "border-purple-300 bg-purple-50 text-purple-800 dark:border-purple-600/40 dark:bg-purple-950/40 dark:text-purple-200",
    both:
      "border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-600/40 dark:bg-indigo-950/40 dark:text-indigo-200",
  }
  const cls = config[channel] ?? config.email
  const label = channel === "both" ? "Email + SMS" : channel.toUpperCase()
  const Icon = channel === "email" ? Mail : channel === "sms" ? MessageSquare : Mail
  return (
    <Badge variant="outline" className={cn("gap-1", cls)}>
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  )
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    draft:
      "border-stone-300 bg-stone-100 text-stone-700 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    scheduled:
      "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-600/40 dark:bg-blue-950/40 dark:text-blue-200",
    sending:
      "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-600/40 dark:bg-yellow-950/40 dark:text-yellow-200",
    sent:
      "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-600/40 dark:bg-emerald-950/40 dark:text-emerald-200",
    failed:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200",
    cancelled:
      "border-stone-300 bg-stone-100 text-stone-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  }
  const cls = config[status] ?? config.draft
  return (
    <Badge variant="outline" className={cn("gap-1", cls)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-80" aria-hidden />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

function formatSegmentLabel(segmentType: string): string {
  return segmentType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export function CampaignsPanel({ propertyId }: { propertyId: string }) {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [resultsCampaignId, setResultsCampaignId] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const { toast } = useToast()

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * PAGE_SIZE
      const params = new URLSearchParams({
        propertyId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      const res = await fetch(`/api/v1/message-campaigns?${params}`)
      const json = await res.json()
      if (!json.success) return
      setCampaigns(json.data.campaigns ?? [])
      setTotalCount(json.data.campaigns?.length ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [propertyId, page])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])


  return (
    <div
      id="guest-comm-panel-campaigns"
      role="tabpanel"
      aria-labelledby="guest-comm-tab-campaigns"
      className={cn("space-y-6", PANEL)}
    >
      {/* New Campaign button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => router.push(`/dashboard/${propertyId}/guest-communication/campaigns/new`)}
          className="inline-flex items-center gap-2 rounded-lg bg-[hsl(142.1,76.2%,32%)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 dark:bg-[hsl(142.1,55%,38%)]"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Campaign
        </Button>
      </div>

      {/* Table */}
      <div className={cn(CARD, "space-y-0 p-0")}>
        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Megaphone className="h-12 w-12 text-stone-300 dark:text-zinc-600" aria-hidden />
            <p className="text-sm font-medium text-stone-600 dark:text-zinc-300">No campaigns yet</p>
            <p className="text-xs text-stone-400 dark:text-zinc-500">
              Create your first campaign to send messages to your guests.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-stone-100 hover:bg-transparent dark:border-zinc-800">
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Name
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Channel
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Segment
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Sent Date
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Recipients
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow
                    key={campaign.id}
                    className="border-stone-100 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                  >
                    <TableCell className="font-semibold text-stone-900 dark:text-zinc-50">
                      {campaign.name}
                    </TableCell>
                    <TableCell>
                      <ChannelBadge channel={campaign.channel} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell className="text-sm text-stone-600 dark:text-zinc-300">
                      {formatSegmentLabel(campaign.segment_type)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-stone-600 dark:text-zinc-300">
                      {campaign.sent_at
                        ? new Date(campaign.sent_at).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-stone-600 dark:text-zinc-300">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500" aria-hidden />
                        {(campaign.recipient_count ?? 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            disabled={sendingId === campaign.id}
                          >
                            {sendingId === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" aria-hidden />
                            )}
                            <span className="sr-only">Actions for {campaign.name}</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {(campaign.status === "sent" || campaign.status === "failed") && (
                            <DropdownMenuItem onClick={() => setResultsCampaignId(campaign.id)}>
                              <Eye className="mr-2 h-4 w-4" aria-hidden />
                              View Results
                            </DropdownMenuItem>
                          )}
                          {(campaign.status === "draft" || campaign.status === "scheduled") && (
                            <DropdownMenuItem
                              disabled={sendingId !== null}
                              onClick={async () => {
                                setSendingId(campaign.id)
                                try {
                                  const res = await fetch(
                                    `/api/v1/message-campaigns/${campaign.id}/send?propertyId=${propertyId}`,
                                    { method: "POST" }
                                  )
                                  const json = await res.json()
                                  if (!res.ok || !json.success) {
                                    throw new Error(json.error?.message || "Failed to send campaign")
                                  }
                                  toast({ title: "Campaign sent", description: `"${campaign.name}" is now being sent.` })
                                  fetchCampaigns()
                                } catch (err) {
                                  toast({
                                    title: "Failed to send",
                                    description: err instanceof Error ? err.message : "An unexpected error occurred",
                                    variant: "destructive",
                                  })
                                } finally {
                                  setSendingId(null)
                                }
                              }}
                            >
                              <Send className="mr-2 h-4 w-4" aria-hidden />
                              Send Now
                            </DropdownMenuItem>
                          )}
                          {campaign.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() =>
                                router.push(`/dashboard/${propertyId}/guest-communication/campaigns/${campaign.id}/edit`)
                              }
                            >
                              <Pencil className="mr-2 h-4 w-4" aria-hidden />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {campaign.status === "draft" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                                onClick={() => toast({ title: "Coming soon", description: "Campaign deletion is not yet available." })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" aria-hidden />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                          {campaign.status === "scheduled" && (
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400"
                              onClick={() => toast({ title: "Coming soon", description: "Campaign cancellation is not yet available." })}
                            >
                              <Ban className="mr-2 h-4 w-4" aria-hidden />
                              Cancel
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="flex items-center justify-end border-t border-stone-100 px-4 py-3 dark:border-zinc-800">
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Results dialog */}
      {resultsCampaignId && (
        <CampaignResultsDialog
          campaignId={resultsCampaignId}
          propertyId={propertyId}
          open={!!resultsCampaignId}
          onOpenChange={(open) => {
            if (!open) setResultsCampaignId(null)
          }}
        />
      )}
    </div>
  )
}

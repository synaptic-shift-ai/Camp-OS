"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Mail,
  MessageSquare,
  Megaphone,
  Plus,
  Users,
  Loader2,
  MoreHorizontal,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pagination } from "@/components/ui/pagination"
import { PageSizeSelector } from "@/components/ui/page-size-selector"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { CampaignResultsDialog } from "./campaign-results-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

type CampaignActionsMenuProps = {
  campaign: Campaign
  sendingId: string | null
  onViewResults: (id: string, name: string) => void
  onSendNow: (id: string, name: string) => void
  onEdit: (id: string) => void
  onDelete: () => void
  onCancel: (id: string, name: string) => void
}

function CampaignActionsMenu({
  campaign,
  sendingId,
  onViewResults,
  onSendNow,
  onEdit,
  onDelete,
  onCancel,
}: CampaignActionsMenuProps) {
  const isSending = sendingId === campaign.id
  const hasMenuItems =
    campaign.status === "sent" ||
    campaign.status === "failed" ||
    campaign.status === "draft" ||
    campaign.status === "scheduled"

  if (!isSending && !hasMenuItems) {
    return (
      <div
        className="flex shrink-0 items-center justify-end pl-1"
        onClick={(event) => event.stopPropagation()}
      />
    )
  }

  return (
    <div
      className="flex shrink-0 items-center justify-end pl-1"
      onClick={(event) => event.stopPropagation()}
    >
      {isSending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="xs" aria-label="Campaign actions" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {(campaign.status === "sent" || campaign.status === "failed") && (
              <DropdownMenuItem onClick={() => onViewResults(campaign.id, campaign.name)}>
                View Results
              </DropdownMenuItem>
            )}

            {(campaign.status === "draft" || campaign.status === "scheduled") && (
              <>
                <DropdownMenuItem onClick={() => onSendNow(campaign.id, campaign.name)}>
                  Send Now
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(campaign.id)}>
                  Edit Campaign
                </DropdownMenuItem>
              </>
            )}

            {campaign.status === "draft" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-red-600 focus:text-red-600"
                >
                  Delete Campaign
                </DropdownMenuItem>
              </>
            )}

            {campaign.status === "scheduled" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onCancel(campaign.id, campaign.name)}
                  className="text-red-600 focus:text-red-600"
                >
                  Cancel Schedule
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}

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
      "border-border bg-muted text-muted-foreground",
    scheduled:
      "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-600/40 dark:bg-blue-950/40 dark:text-blue-200",
    sending:
      "border-yellow-300 bg-yellow-50 text-yellow-800 dark:border-yellow-600/40 dark:bg-yellow-950/40 dark:text-yellow-200",
    sent:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200",
    failed:
      "border-red-300 bg-red-50 text-red-800 dark:border-red-600/40 dark:bg-red-950/40 dark:text-red-200",
    cancelled:
      "border-border bg-muted text-muted-foreground",
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
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [resultsCampaignId, setResultsCampaignId] = useState<string | null>(null)
  const [resultsCampaignName, setResultsCampaignName] = useState<string | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [cancelTarget, setCancelTarget] = useState<{ id: string; name: string } | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [sendNowTarget, setSendNowTarget] = useState<{ id: string; name: string } | null>(null)
  const [confirmingSend, setConfirmingSend] = useState(false)
  const { toast } = useToast()

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const startIndex = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const endIndex = Math.min(totalCount, page * pageSize)

  const handlePageSizeChange = (nextPageSize: number) => {
    setPageSize(nextPageSize)
    setPage(1)
  }

  const goToPage = (p: number) => setPage(p)

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * pageSize
      const params = new URLSearchParams({
        propertyId,
        limit: String(pageSize),
        offset: String(offset),
      })
      const res = await fetch(`/api/v1/message-campaigns?${params}`)
      const json = await res.json()
      if (!json.success) return
      setCampaigns(json.data.campaigns ?? [])
      setTotalCount(json.data.count ?? json.data.campaigns?.length ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [propertyId, page, pageSize])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleSendCampaign = useCallback(
    async (campaignId: string, campaignName: string) => {
      setSendingId(campaignId)
      try {
        const res = await fetch(
          `/api/v1/message-campaigns/${campaignId}/send?propertyId=${propertyId}`,
          { method: "POST" },
        )
        const json = await res.json()
        if (!res.ok || !json.success) {
          throw new Error(json.error?.message || "Failed to send campaign")
        }
        toast({
          title: "Campaign sent",
          description: `"${campaignName}" is now being sent.`,
        })
        setSendNowTarget(null)
        fetchCampaigns()
      } catch (err) {
        toast({
          title: "Failed to send",
          description: err instanceof Error ? err.message : "An unexpected error occurred",
          variant: "destructive",
        })
      } finally {
        setSendingId(null)
        setConfirmingSend(false)
      }
    },
    [propertyId, toast, fetchCampaigns],
  )

  const handleDeleteCampaign = async () => {
    if (!deleteTarget || !propertyId) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/v1/message-campaigns/${deleteTarget.id}?propertyId=${propertyId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error?.message || 'Failed to delete campaign')
      }
      toast({ title: 'Campaign deleted', description: `"${deleteTarget.name}" has been deleted.` })
      setDeleteTarget(null)
      fetchCampaigns()
    } catch {
      toast({ title: 'Error', description: 'Failed to delete campaign.', variant: 'destructive' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConfirmSendNow = useCallback(async () => {
    if (!sendNowTarget) return
    setConfirmingSend(true)
    await handleSendCampaign(sendNowTarget.id, sendNowTarget.name)
  }, [sendNowTarget, handleSendCampaign])

  const handleCancelScheduled = useCallback(async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      const res = await fetch(
        `/api/v1/message-campaigns/${cancelTarget.id}/cancel?propertyId=${propertyId}`,
        { method: "POST" },
      )
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message ?? "Failed to cancel campaign")
      }
      toast({
        title: "Campaign cancelled",
        description: `"${cancelTarget.name}" will no longer be sent.`,
      })
      setCancelTarget(null)
      fetchCampaigns()
    } catch (err) {
      toast({
        title: "Failed to cancel",
        description: err instanceof Error ? err.message : "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setCancelling(false)
    }
  }, [cancelTarget, propertyId, toast, fetchCampaigns])

  if (!loading && campaigns.length === 0) {
    return (
      <div
        id="guest-comm-panel-campaigns"
        role="tabpanel"
        aria-labelledby="guest-comm-tab-campaigns"
        className="space-y-6"
      >
        <div className="flex justify-end">
          <Button
            type="button"
            onClick={() => router.push(`/dashboard/${propertyId}/guest-communication/campaigns/new`)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New Campaign
          </Button>
        </div>
        <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-8 text-center min-h-[calc(100vh-14rem)] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Megaphone className="h-10 w-10" />
            </div>
            <h3 className="text-lg font-semibold">No campaigns yet</h3>
            <p className="text-sm text-muted-foreground">Create your first campaign to start messaging guests.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      id="guest-comm-panel-campaigns"
      role="tabpanel"
      aria-labelledby="guest-comm-tab-campaigns"
      className="space-y-6"
    >
      {/* New Campaign button */}
      <div className="flex justify-end">
        <Button
          type="button"
          onClick={() => router.push(`/dashboard/${propertyId}/guest-communication/campaigns/new`)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New Campaign
        </Button>
      </div>

      {/* Table */}
      <div className="relative">
        {loading && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center bg-background/60"
            aria-busy="true"
            aria-label="Loading campaigns"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
        <div className="hidden border border-border/80 bg-card/50 md:block">
          <Table className="text-xs">
            <TableHeader className="bg-red-50 dark:bg-red-950/30 sticky top-0 z-10">
              <TableRow className="h-8 hover:bg-transparent data-[state=selected]:bg-transparent">
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  Name
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  Channel
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  Status
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  Segment
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  Sent Date
                </TableHead>
                <TableHead className="py-1.5 dark:text-white/90 text-black/90 font-medium">
                  Recipients
                </TableHead>
                <TableHead className="py-1.5 text-right dark:text-white/90 text-black/90 font-medium">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow
                  key={campaign.id}
                  className="h-8 cursor-pointer hover:bg-muted/60"
                >
                  <TableCell className="py-1.5 font-medium whitespace-nowrap">
                    {campaign.name}
                  </TableCell>
                  <TableCell className="py-1.5">
                    <ChannelBadge channel={campaign.channel} />
                  </TableCell>
                  <TableCell className="py-1.5">
                    <StatusBadge status={campaign.status} />
                  </TableCell>
                  <TableCell className="py-1.5 text-muted-foreground">
                    {formatSegmentLabel(campaign.segment_type)}
                  </TableCell>
                  <TableCell className="py-1.5 whitespace-nowrap text-muted-foreground">
                    {campaign.sent_at
                      ? new Date(campaign.sent_at).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell className="py-1.5 tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                      {(campaign.recipient_count ?? 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="w-12 min-w-[2.75rem] shrink-0 pl-3 pr-2 py-0.5 align-middle">
                    <CampaignActionsMenu
                      campaign={campaign}
                      sendingId={sendingId}
                      onViewResults={(id, name) => {
                        setResultsCampaignId(id)
                        setResultsCampaignName(name)
                      }}
                      onSendNow={(id, name) => {
                        if (campaign.status === "scheduled") {
                          setSendNowTarget({ id, name })
                          return
                        }
                        void handleSendCampaign(id, name)
                      }}
                      onEdit={(id) =>
                        router.push(`/dashboard/${propertyId}/guest-communication/campaigns/${id}/edit`)
                      }
                      onDelete={() => setDeleteTarget(campaign)}
                      onCancel={(id, name) => setCancelTarget({ id, name })}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination footer — outside table container */}
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex w-full flex-col items-center gap-2 text-xs text-muted-foreground sm:w-auto sm:flex-row sm:items-center sm:gap-4">
          <div>Showing <span className="font-medium">{startIndex}–{endIndex}</span> of <span className="font-medium">{totalCount}</span> campaigns</div>
          <PageSizeSelector value={pageSize} onChange={handlePageSizeChange} />
        </div>
        <div className="flex w-full justify-center sm:w-auto sm:justify-end">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={goToPage} windowSize={2} />
        </div>
      </div>

      {/* Results dialog */}
      {resultsCampaignId && (
        <CampaignResultsDialog
          campaignId={resultsCampaignId}
          campaignName={resultsCampaignName ?? ''}
          propertyId={propertyId}
          open={!!resultsCampaignId}
          onOpenChange={(open) => {
            if (!open) {
              setResultsCampaignId(null)
              setResultsCampaignName(null)
            }
          }}
        />
      )}

      <AlertDialog
        open={!!sendNowTarget}
        onOpenChange={(open) => {
          if (!open && !confirmingSend) setSendNowTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send scheduled campaign now?</AlertDialogTitle>
            <AlertDialogDescription>
              {sendNowTarget
                ? `"${sendNowTarget.name}" is scheduled for a later time. Sending now will deliver it immediately and skip the scheduled send.`
                : "This campaign will be sent immediately instead of at the scheduled time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmingSend}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              disabled={confirmingSend}
              onClick={() => void handleConfirmSendNow()}
            >
              {confirmingSend && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Confirm
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open && !cancelling) setCancelTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel scheduled campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget
                ? `"${cancelTarget.name}" will not be sent at the scheduled time. This cannot be undone.`
                : "This campaign will not be sent at the scheduled time."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep scheduled</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelling}
              onClick={() => void handleCancelScheduled()}
            >
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Cancel campaign
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={() => void handleDeleteCampaign()} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

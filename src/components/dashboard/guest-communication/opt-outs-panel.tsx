"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import {
  Mail,
  Shield,
  Smartphone,
  Search,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { PermissionGate } from "@/components/ui/permission-gate"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Pagination } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

const PANEL = "text-stone-900 dark:text-zinc-100"
const CARD = "rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/90"

type OptOutRecord = {
  id: string
  guestName: string
  guestEmail: string
  channel: string
  optedOutAt: string
  source: string
}

const PAGE_SIZE = 10

export function OptOutsPanel({ propertyId }: { propertyId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<OptOutRecord[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [subscribeTarget, setSubscribeTarget] = useState<OptOutRecord | null>(null)
  const [subscribing, setSubscribing] = useState(false)
  const [skippedCount, setSkippedCount] = useState(0)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * PAGE_SIZE
      const params = new URLSearchParams({
        propertyId,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })
      const res = await fetch(`/api/v1/communications/opt-outs?${params}`)
      const json = await res.json()
      if (!json.success) return

      setRecords((json.data.data ?? []) as OptOutRecord[])
      setTotalCount(json.data.count ?? 0)
      setSkippedCount(json.data.counts?.email ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [propertyId, page])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return records
    return records.filter(
      (r) =>
        r.guestName.toLowerCase().includes(q) ||
        r.guestEmail.toLowerCase().includes(q),
    )
  }, [records, search])

  const handleSubscribe = async () => {
    if (!subscribeTarget) return
    try {
      setSubscribing(true)
      const params = new URLSearchParams({ propertyId, id: subscribeTarget.id })
      const res = await fetch(`/api/v1/communications/opt-outs?${params}`, { method: "DELETE" })
      const json = await res.json()
      if (!res.ok || !json.success) {
        const description =
          typeof json.error?.message === "string" ? json.error.message : "Could not restore guest subscription."
        toast({ title: "Error", description, variant: "destructive" })
        return
      }
      toast({
        title: "Guest subscribed",
        description: `${subscribeTarget.guestName} can receive ${subscribeTarget.channel.toLowerCase()} communications again.`,
      })
      setSubscribeTarget(null)
      await fetchRecords()
    } catch {
      toast({ title: "Error", description: "Could not restore guest subscription.", variant: "destructive" })
    } finally {
      setSubscribing(false)
    }
  }

  return (
    <div className={cn("space-y-6", PANEL)} id="guest-comm-panel-opt-outs" role="tabpanel" aria-labelledby="guest-comm-tab-opt-outs">
      {/* <header className="space-y-1">
        <h2 className="font-heading text-2xl font-semibold tracking-tight text-stone-900 dark:text-zinc-50 sm:text-3xl">
          Opt-outs
        </h2>
        <p className="text-sm text-stone-500 dark:text-zinc-400">
          Guests who have opted out of communications.
        </p>
      </header> */}

      <PermissionGate permission="guest_comms.view_opt_out_list">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className={cn(CARD, "border-l-4 border-l-amber-500")}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/50">
                <Mail className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                  Email Opt-Outs
                </p>
                <p className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">
                  {loading ? <Skeleton className="inline-block h-8 w-12" /> : skippedCount}
                </p>
              </div>
            </div>
          </div>
          <div className={cn(CARD, "border-l-4 border-l-stone-300")}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100 dark:bg-zinc-800">
                <Smartphone className="h-5 w-5 text-stone-500 dark:text-zinc-400" aria-hidden />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                  SMS Opt-Outs
                </p>
                <p className="text-2xl font-semibold tabular-nums text-stone-900 dark:text-zinc-50">
                  <span className="text-sm font-normal text-stone-400 dark:text-zinc-500">Phase 2</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className={cn(CARD, "space-y-4 p-0")}>
          <div className="flex flex-col gap-3 border-b border-stone-100 px-4 py-4 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-50">Opt-out records</h3>
              <p className="text-xs text-stone-500 dark:text-zinc-400">
                Guests who unsubscribed or were marked as skipped.
              </p>
            </div>
            <div className="w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-zinc-500" aria-hidden />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search guest name or email…"
                  className="h-9 border-stone-200 bg-white pl-9 text-stone-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 px-4 pb-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Shield className="h-12 w-12 text-stone-300 dark:text-zinc-600" aria-hidden />
              <p className="text-sm font-medium text-stone-600 dark:text-zinc-300">No guests have opted out</p>
              <p className="text-xs text-stone-400 dark:text-zinc-500">
                When guests unsubscribe, they&apos;ll appear here.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow className="border-stone-100 hover:bg-transparent dark:border-zinc-800">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                      Guest Name
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                      Email
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                      Channel
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                      Opted Out Date
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                      Source
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-zinc-400">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((row) => (
                    <TableRow
                      key={row.id}
                      className="border-stone-100 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
                    >
                      <TableCell className="font-semibold text-stone-900 dark:text-zinc-50">
                        {row.guestName}
                      </TableCell>
                      <TableCell className="text-sm text-stone-600 dark:text-zinc-300">
                        {row.guestEmail}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                        >
                          {row.channel}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-stone-600 dark:text-zinc-300">
                        {row.optedOutAt ? new Date(row.optedOutAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {row.source}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <PermissionGate permission="guest_comms.configure_branding" fallback={null}>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => setSubscribeTarget(row)}
                          >
                            Subscribe
                          </Button>
                        </PermissionGate>
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
      </PermissionGate>

      <AlertDialog open={!!subscribeTarget} onOpenChange={(open) => !open && !subscribing && setSubscribeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Subscribe this guest?</AlertDialogTitle>
            <AlertDialogDescription>
              {subscribeTarget?.guestName ?? "This guest"} will be able to receive{" "}
              {subscribeTarget?.channel.toLowerCase() ?? "channel"} messages again. They can unsubscribe at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={subscribing}>Cancel</AlertDialogCancel>
            <Button type="button" disabled={subscribing} onClick={handleSubscribe}>
              {subscribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />}
              Subscribe
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

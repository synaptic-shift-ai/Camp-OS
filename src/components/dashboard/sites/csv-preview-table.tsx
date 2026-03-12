'use client'

import { useState } from 'react'
import type { ParsedSite } from '@/lib/csv/parse-sites-csv'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import {
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Tent,
  Car,
  Home,
  Sparkles,
  Circle,
} from 'lucide-react'

const ROWS_PER_PAGE = 10

// Compact class helpers — override shadcn's h-12/p-4 defaults
const TH = 'h-8 px-2 py-0 text-[11px] font-semibold text-muted-foreground whitespace-nowrap'
const TD = 'px-2 py-0.5 text-xs whitespace-nowrap align-middle'

interface CsvPreviewTableProps {
  sites: ParsedSite[]
}

// ── helpers ────────────────────────────────────────────────────────────────

function formatPrice(cents: number | null | undefined): string {
  if (!cents) return '—'
  return `$${(cents / 100).toFixed(2)}`
}

function formatHookups(hookups: string[] | undefined): string {
  if (!hookups || hookups.length === 0) return '—'
  return hookups.map((h) => h.charAt(0).toUpperCase() + h.slice(1)).join(', ')
}

function formatAmenities(amenities: string[] | undefined): string {
  if (!amenities || amenities.length === 0) return '—'
  return amenities
    .map((a) => a.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(', ')
}

const SITE_TYPE_ICONS: Record<string, React.ReactNode> = {
  tent: <Tent className="h-3 w-3" />,
  rv: <Car className="h-3 w-3" />,
  cabin: <Home className="h-3 w-3" />,
  glamping: <Sparkles className="h-3 w-3" />,
  yurt: <Circle className="h-3 w-3" />,
  other: <Circle className="h-3 w-3" />,
}

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-green-100  text-green-700  border-green-200',
  reserved: 'bg-blue-100   text-blue-700   border-blue-200',
  booked: 'bg-blue-100   text-blue-700   border-blue-200',
  occupied: 'bg-orange-100 text-orange-700 border-orange-200',
  housekeeping: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  maintenance: 'bg-red-100    text-red-700    border-red-200',
  unavailable: 'bg-gray-100   text-gray-600   border-gray-200',
}

// ── component ──────────────────────────────────────────────────────────────

export function CsvPreviewTable({ sites }: CsvPreviewTableProps) {
  const [page, setPage] = useState(1)

  const totalPages = Math.max(1, Math.ceil(sites.length / ROWS_PER_PAGE))
  const start = (page - 1) * ROWS_PER_PAGE
  const end = Math.min(start + ROWS_PER_PAGE, sites.length)
  const pageSites = sites.slice(start, end)
  // Pad with nulls so every page renders exactly ROWS_PER_PAGE rows,
  // keeping the table height constant when the last page is short.
  const paddedRows: (ParsedSite | null)[] = [
    ...pageSites,
    ...Array<null>(ROWS_PER_PAGE - pageSites.length).fill(null),
  ]

  if (sites.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed py-10 text-center">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">No sites to preview</p>
          <p className="text-xs text-muted-foreground">Upload a CSV file to see a preview</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ScrollArea className="h-[354px] rounded-lg border">
        <Table className="w-max">
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60">
              <TableHead className={`${TH} w-7 text-center`}>#</TableHead>
              <TableHead className={`${TH} w-20`}>Site #</TableHead>
              <TableHead className={`${TH} min-w-[110px] max-w-[150px]`}>Name</TableHead>
              <TableHead className={`${TH} w-[88px]`}>Type</TableHead>
              <TableHead className={`${TH} w-[72px]`}>Cap.</TableHead>
              <TableHead className={`${TH} w-[90px]`}>Status</TableHead>
              <TableHead className={`${TH} w-[80px]`}>Pricing</TableHead>
              <TableHead className={`${TH} w-[76px]`}>Base Price</TableHead>
              <TableHead className={`${TH} w-[76px]`}>Weekend Price</TableHead>
              <TableHead className={`${TH} min-w-[140px]`}>Hookups</TableHead>
              <TableHead className={`${TH} min-w-[200px]`}>Amenities</TableHead>
              <TableHead className={`${TH} w-8 text-center`}>Pets</TableHead>
              <TableHead className={`${TH} w-8 text-center`}>ADA</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paddedRows.map((site, i) => {
              const rowNum = start + i + 1
              const isEven = i % 2 === 1
              const isEmpty = site === null

              // Empty filler row — same height, no content
              if (isEmpty) {
                return (
                  <TableRow
                    key={`empty-${i}`}
                    className={`h-8 ${isEven ? 'bg-muted/20' : ''} hover:bg-transparent`}
                  >
                    {Array.from({ length: 13 }).map((_, ci) => (
                      <TableCell key={ci} className={TD} />
                    ))}
                  </TableRow>
                )
              }

              const usingDefaults = site.use_property_defaults !== false

              return (
                <TableRow
                  key={`${site.site_number}-${rowNum}`}
                  className={`h-8 ${isEven ? 'bg-muted/20' : ''} hover:bg-muted/40`}
                >
                  {/* # */}
                  <TableCell className={`${TD} w-7 text-center text-muted-foreground/60 tabular-nums`}>
                    {rowNum}
                  </TableCell>

                  {/* Site # */}
                  <TableCell className={`${TD} w-20 font-medium`}>
                    {site.site_number}
                  </TableCell>

                  {/* Name */}
                  <TableCell className={`${TD} min-w-[100px] max-w-[160px]`}>
                    <span className="block truncate text-muted-foreground">
                      {site.site_name || <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </TableCell>

                  {/* Type */}
                  <TableCell className={`${TD} w-[88px]`}>
                    {site.site_type ? (
                      <span className="inline-flex items-center gap-1 rounded-full border bg-background px-1.5 py-px text-[11px] font-medium capitalize">
                        {SITE_TYPE_ICONS[site.site_type]}
                        {site.site_type}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {/* Capacity */}
                  <TableCell className={`${TD} w-[72px] tabular-nums text-muted-foreground`}>
                    {site.max_occupancy ? (
                      <>
                        {site.max_occupancy}p
                        {site.max_vehicles ? (
                          <span className="text-muted-foreground/50"> ·{site.max_vehicles}v</span>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className={`${TD} w-[90px]`}>
                    {site.status ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-1.5 py-px text-[11px] font-medium capitalize ${STATUS_STYLES[site.status] ?? 'bg-muted text-muted-foreground border-border'}`}
                      >
                        {site.status}
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground/40">—</span>
                    )}
                  </TableCell>

                  {/* Pricing mode */}
                  <TableCell className={`${TD} w-[80px]`}>
                    {usingDefaults ? (
                      <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-1.5 py-px text-[11px] font-medium text-blue-700">
                        Inherited
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-1.5 py-px text-[11px] font-medium text-violet-700">
                        Custom
                      </span>
                    )}
                  </TableCell>

                  {/* Base price */}
                  <TableCell className={`${TD} w-[76px] tabular-nums`}>
                    {usingDefaults
                      ? <span className="text-muted-foreground/40">—</span>
                      : formatPrice(site.base_price)}
                  </TableCell>

                  {/* Weekend price */}
                  <TableCell className={`${TD} w-[76px] tabular-nums`}>
                    {usingDefaults
                      ? <span className="text-muted-foreground/40">—</span>
                      : formatPrice(site.weekend_price)}
                  </TableCell>

                  {/* Hookups */}
                  <TableCell className={`${TD} min-w-[140px] text-muted-foreground`}>
                    {formatHookups(site.hookups)}
                  </TableCell>

                  {/* Amenities */}
                  <TableCell className={`${TD} min-w-[200px] max-w-[280px] text-muted-foreground`}>
                    <span className="block truncate" title={formatAmenities(site.amenities)}>
                      {formatAmenities(site.amenities)}
                    </span>
                  </TableCell>

                  {/* Pets */}
                  <TableCell className={`${TD} w-8 text-center`}>
                    {site.allow_pets
                      ? <Check className="mx-auto h-3 w-3 text-green-600" />
                      : <X className="mx-auto h-3 w-3 text-muted-foreground/30" />}
                  </TableCell>

                  {/* ADA */}
                  <TableCell className={`${TD} w-8 text-center`}>
                    {site.ada_accessible
                      ? <Check className="mx-auAto h-3 w-3 text-green-600" />
                      : <X className="mx-auto h-3 w-3 text-muted-foreground/30" />}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Pagination bar */}
      <div className="flex items-center justify-between px-0.5">
        <p className="text-xs text-muted-foreground">
          Showing{' '}
          <span className="font-medium text-foreground">{start + 1}–{end}</span>
          {' '}of{' '}
          <span className="font-medium text-foreground">{sites.length}</span>{' '}
          site{sites.length !== 1 ? 's' : ''}
        </p>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>

          <span className="min-w-[3.5rem] text-center text-xs text-muted-foreground">
            {page} / {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            className="h-6 w-6"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  )
}

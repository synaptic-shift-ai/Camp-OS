'use client'

/**
 * CSV Preview Table Component
 *
 * Displays preview of parsed CSV data (first 10 rows).
 * Shows key site fields in a scrollable table format.
 */

import type { ParsedSite } from '@/lib/csv/parse-sites-csv'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, X } from 'lucide-react'

interface CsvPreviewTableProps {
  sites: ParsedSite[]
  maxRows?: number
}

export function CsvPreviewTable({ sites, maxRows = 10 }: CsvPreviewTableProps) {
  const previewSites = sites.slice(0, maxRows)

  const formatPrice = (cents: number | null | undefined): string => {
    if (cents === null || cents === undefined) return 'N/A'
    return `$${(cents / 100).toFixed(2)}`
  }

  const formatArray = (arr: string[] | null | undefined): string => {
    if (!arr || arr.length === 0) return 'None'
    return arr.join(', ')
  }

  const formatBoolean = (value: boolean | null | undefined): JSX.Element => {
    if (value === true) {
      return (
        <span className="inline-flex items-center gap-1 text-green-600">
          <Check className="h-3 w-3" />
          Yes
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <X className="h-3 w-3" />
        No
      </span>
    )
  }

  if (previewSites.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            No sites to preview
          </p>
          <p className="text-xs text-muted-foreground">
            Upload a CSV file to see preview
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing first {previewSites.length} of {sites.length} site{sites.length !== 1 ? 's' : ''}
        </p>
      </div>

      <ScrollArea className="h-[400px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Site #</TableHead>
              <TableHead className="min-w-[150px]">Name</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[80px]">Capacity</TableHead>
              <TableHead className="w-[100px]">Base Price</TableHead>
              <TableHead className="w-[120px]">Weekend Price</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="min-w-[150px]">Hookups</TableHead>
              <TableHead className="min-w-[200px]">Amenities</TableHead>
              <TableHead className="w-[80px]">Pets</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {previewSites.map((site, index) => (
              <TableRow key={`${site.site_number}-${index}`}>
                <TableCell className="font-medium">{site.site_number}</TableCell>
                <TableCell>{site.site_name || '-'}</TableCell>
                <TableCell>
                  {site.site_type ? (
                    <Badge variant="outline" className="capitalize">
                      {site.site_type}
                    </Badge>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>{site.max_occupancy || '-'}</TableCell>
                <TableCell>{formatPrice(site.base_price)}</TableCell>
                <TableCell>{formatPrice(site.weekend_price)}</TableCell>
                <TableCell>
                  {site.status ? (
                    <Badge
                      variant={
                        site.status === 'available'
                          ? 'default'
                          : site.status === 'maintenance'
                            ? 'secondary'
                            : 'destructive'
                      }
                      className="capitalize"
                    >
                      {site.status}
                    </Badge>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {formatArray(site.hookups)}
                </TableCell>
                <TableCell className="text-xs">
                  {formatArray(site.amenities)}
                </TableCell>
                <TableCell>{formatBoolean(site.allow_pets)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {sites.length > maxRows && (
        <p className="text-xs text-muted-foreground text-center">
          {sites.length - maxRows} more site{sites.length - maxRows !== 1 ? 's' : ''} not shown in preview
        </p>
      )}
    </div>
  )
}

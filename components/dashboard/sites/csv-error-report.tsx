'use client'

/**
 * CSV Error Report Component
 *
 * Displays validation errors in a table format.
 * Allows downloading errors as CSV for offline review.
 */

import { AlertCircle, Download } from 'lucide-react'
import type { ParseError } from '@/lib/csv/parse-sites-csv'
import { downloadErrorReport } from '@/lib/csv/parse-sites-csv'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'

interface CsvErrorReportProps {
  errors: ParseError[]
  maxRows?: number
}

export function CsvErrorReport({ errors, maxRows = 20 }: CsvErrorReportProps) {
  const displayErrors = errors.slice(0, maxRows)

  const handleDownloadErrors = () => {
    downloadErrorReport(errors)
  }

  if (errors.length === 0) {
    return null
  }

  const errorsByRow = new Map<number, ParseError[]>()
  errors.forEach((error) => {
    const existing = errorsByRow.get(error.row) || []
    errorsByRow.set(error.row, [...existing, error])
  })

  const uniqueRowsWithErrors = errorsByRow.size

  return (
    <div className="space-y-4">
      {/* Error Summary Alert */}
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Validation Errors Found</AlertTitle>
        <AlertDescription>
          Found {errors.length} error{errors.length !== 1 ? 's' : ''} across{' '}
          {uniqueRowsWithErrors} row{uniqueRowsWithErrors !== 1 ? 's' : ''}. Please fix these
          errors before importing.
        </AlertDescription>
      </Alert>

      {/* Download Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownloadErrors}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download Error Report
        </Button>
      </div>

      {/* Error Table */}
      <ScrollArea className="h-[300px] rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">Row</TableHead>
              <TableHead className="w-[120px]">Field</TableHead>
              <TableHead className="min-w-[250px]">Error</TableHead>
              <TableHead className="min-w-[150px]">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayErrors.map((error, index) => (
              <TableRow key={`${error.row}-${error.field}-${index}`}>
                <TableCell>
                  <Badge variant="destructive">{error.row || 'N/A'}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {error.field || 'General'}
                </TableCell>
                <TableCell className="text-sm">{error.message}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {error.value ? (
                    <span className="max-w-[200px] truncate block">
                      {error.value}
                    </span>
                  ) : (
                    '-'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollArea>

      {errors.length > maxRows && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {maxRows} of {errors.length} errors. Download full report to see all errors.
        </p>
      )}

      {/* Help Text */}
      <div className="rounded-lg bg-muted p-4 space-y-2">
        <p className="text-sm font-medium">How to fix errors:</p>
        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Download the error report CSV above</li>
          <li>Open your original CSV file</li>
          <li>Fix the errors listed in each row and field</li>
          <li>Save the corrected CSV file</li>
          <li>Upload the corrected file again</li>
        </ol>
      </div>
    </div>
  )
}

'use client'

/**
 * Bulk Site Upload Dialog Component
 *
 * Multi-step workflow for bulk CSV site upload:
 * 1. Upload CSV file
 * 2. Parse and validate
 * 3. Preview sites (first 10 rows)
 * 4. Confirm and import
 *
 * Features:
 * - Template download
 * - Drag-and-drop upload
 * - Real-time validation
 * - Preview table
 * - Error reporting
 * - Atomic transaction (all-or-nothing)
 */

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle2, AlertCircle, Loader2, FileText, TriangleAlert } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { CsvUploadDropzone } from './csv-upload-dropzone'
import { CsvPreviewTable } from './csv-preview-table'
import { CsvErrorReport } from './csv-error-report'
import {
  parseSitesCsv,
  parsedSiteToApiRequest,
  type ParseError,
  type ParseResult,
} from '@/lib/csv/parse-sites-csv'
import { validateSites, getValidationSummary, type ValidationResult } from '@/lib/csv/validate-sites-csv'
import { useToast } from '@/hooks/use-toast'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

type Step = 'upload' | 'preview' | 'importing' | 'success'

const SEASON_ALERT_TOAST_CLASS =
  'border-[#5f111b] bg-[#5f111b] text-white [&_button[toast-close]]:text-white/90 [&_button[toast-close]]:hover:text-white'

export function BulkUploadDialog({
  open,
  onOpenChange,
  propertyId,
}: BulkUploadDialogProps) {
  const router = useRouter()
  const { toast } = useToast()

  // State
  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResult | null>(null)
  const [allErrors, setAllErrors] = useState<ParseError[]>([])
  const [importedCount, setImportedCount] = useState(0)
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null)

  // Derived state
  const hasErrors = allErrors.length > 0
  const isValid = parseResult && !hasErrors

  // Reset state when dialog closes
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        // Reset state
        setStep('upload')
        setSelectedFile(null)
        setIsProcessing(false)
        setParseResult(null)
        setAllErrors([])
        setValidationResult(null)
        setImportedCount(0)
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  // Summary data memoized from parse/validation state
  const summaryData = useMemo(() => {
    if (!parseResult) return null
    return getValidationSummary(
      parseResult.rowCount,
      { valid: !hasErrors, errors: allErrors, duplicates: validationResult?.duplicates ?? [] }
    )
  }, [parseResult, hasErrors, allErrors, validationResult])

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file)
    setIsProcessing(true)
    setValidationResult(null)
    setAllErrors([])

    try {
      // Parse CSV
      const result = await parseSitesCsv(file)
      setParseResult(result)

      // Collect parsing errors
      const errors = [...result.errors]

      // Validate parsed sites if parsing succeeded
      if (result.data.length > 0) {
        const validationRes = validateSites(result.data)
        errors.push(...validationRes.errors)
        setValidationResult(validationRes)
      }

      setAllErrors(errors)

      // Move to preview step if we have data (even with errors)
      if (result.data.length > 0) {
        setStep('preview')
      }
    } catch (error) {
      console.error('Error processing CSV:', error)
      toast({
        variant: 'destructive',
        title: 'Processing Error',
        description:
          error instanceof Error ? error.message : 'Failed to process CSV file',
        className: SEASON_ALERT_TOAST_CLASS,
      })
    } finally {
      setIsProcessing(false)
    }
  }, [toast])

  // Handle import
  const handleImport = useCallback(async () => {
    if (!parseResult || !isValid) return

    setStep('importing')

    try {
      // Call API to import sites - Migrated to v1 API (Phase 4, Week 13-14)
      const response = await fetch(`/api/v1/properties/${propertyId}/sites/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parseResult.data.map(parsedSiteToApiRequest)),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Import failed')
      }

      // v1 API bulk response: { success: true, data: { sites: [...], count: N } }
      const count = result.data?.count || result.data?.sites?.length || 0

      setImportedCount(count)
      setStep('success')

      toast({
        title: 'Import Successful',
        description: `Successfully imported ${count} site${count !== 1 ? 's' : ''}`,
        className: SEASON_ALERT_TOAST_CLASS,
        variant: "success",
      })
    } catch (error) {
      console.error('Import error:', error)
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description:
          error instanceof Error ? error.message : 'Failed to import sites',
        className: SEASON_ALERT_TOAST_CLASS,
      })
      setStep('preview') // Go back to preview to allow retry
    }
  }, [parseResult, isValid, propertyId, toast])

  // Handle success completion
  const handleComplete = useCallback(() => {
    handleOpenChange(false)
    router.refresh() // Refresh to show new sites
  }, [handleOpenChange, router])

  // Handle back to upload
  const handleBack = useCallback(() => {
    setStep('upload')
    setSelectedFile(null)
    setParseResult(null)
    setAllErrors([])
  }, [])

  // Summary cards for the preview step
  const getSummary = useCallback(() => {
    if (!summaryData) return null

    const summary = summaryData

    return (
      <div className="grid grid-cols-3 gap-3">
        {/* Total rows */}
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background border">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Rows</p>
            <p className="text-2xl font-bold tabular-nums">{summary.totalRows}</p>
          </div>
        </div>

        {/* Valid sites */}
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </div>
          <div>
            <p className="text-xs text-green-700">Valid Sites</p>
            <p className="text-2xl font-bold tabular-nums text-green-700">{summary.validRows}</p>
          </div>
        </div>

        {/* Errors */}
        <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${summary.errorCount > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-muted bg-muted/30'}`}>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${summary.errorCount > 0 ? 'bg-destructive/10' : 'bg-background border'}`}>
            <TriangleAlert className={`h-4 w-4 ${summary.errorCount > 0 ? 'text-destructive' : 'text-muted-foreground/40'}`} />
          </div>
          <div>
            <p className={`text-xs ${summary.errorCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              Errors
            </p>
            <p className={`text-2xl font-bold tabular-nums ${summary.errorCount > 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {summary.errorCount}
            </p>
          </div>
        </div>
      </div>
    )
  }, [summaryData])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/*
       * overflow-hidden + flex flex-col keeps the dialog at a fixed height so
       * only the body area scrolls — header and footer stay pinned.
       */}
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        {/* Upload Step */}
        {step === 'upload' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 pr-12 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Bulk Import Sites
              </DialogTitle>
              <DialogDescription>
                Upload a CSV file to import multiple sites at once. Download the
                template to see the correct format.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-2 space-y-4">
              <CsvUploadDropzone
                onFileSelect={handleFileSelect}
                onClear={() => setSelectedFile(null)}
                selectedFile={selectedFile}
                disabled={isProcessing}
              />

              {isProcessing && (
                <Alert>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <AlertDescription>
                    Processing CSV file… This may take a few seconds.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t shrink-0">
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Preview Step */}
        {step === 'preview' && parseResult && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 pr-12 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                {hasErrors ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                )}
                {hasErrors ? 'Validation Errors Found' : 'Ready to Import'}
              </DialogTitle>
              <DialogDescription>
                {hasErrors
                  ? 'Please fix the errors below before importing'
                  : 'Review the sites below and confirm import'}
              </DialogDescription>
            </DialogHeader>

            {/* Only this area scrolls — header and footer remain fixed */}
            <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4 space-y-5">
              {getSummary()}

              {hasErrors && <CsvErrorReport errors={allErrors} />}

              {!hasErrors && (
                <>
                  {/* Section header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">Preview Sites</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Review data before confirming the import
                      </p>
                    </div>
                  </div>

                  <CsvPreviewTable sites={parseResult.data} />
                </>
              )}
            </div>

            <DialogFooter className="px-6 py-3 border-t shrink-0">
              {/* Atomic note lives in the footer so it's always visible */}
              {!hasErrors && (
                <div className="mr-auto flex items-center gap-2 text-xs text-amber-700">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <span>Import is atomic. All sites will be imported or none will be imported if any error occurs.</span>
                </div>
              )}
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              {!hasErrors && (
                <Button onClick={handleImport} disabled={!isValid}>
                  Import {summaryData?.validRows ?? 0} Site
                  {(summaryData?.validRows ?? 0) !== 1 ? 's' : ''}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 pr-12 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Importing Sites...
              </DialogTitle>
              <DialogDescription>
                Please wait while we import your sites. This may take a few seconds.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          </>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <>
            <DialogHeader className="px-6 pt-6 pb-4 pr-12 shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Import Successful
              </DialogTitle>
              <DialogDescription>
                Your sites have been successfully imported.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-1 flex-col items-center justify-center py-12 space-y-4">
              <div className="rounded-full bg-green-100 p-6">
                <CheckCircle2 className="h-12 w-12 text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <p className="text-2xl font-bold">{importedCount}</p>
                <p className="text-muted-foreground">
                  Site{importedCount !== 1 ? 's' : ''} imported successfully
                </p>
              </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t shrink-0">
              <Button onClick={handleComplete}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

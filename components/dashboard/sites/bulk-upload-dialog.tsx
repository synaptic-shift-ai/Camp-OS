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

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
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
  type ParsedSite,
  type ParseError,
  type ParseResult,
} from '@/lib/csv/parse-sites-csv'
import { validateSites, getValidationSummary } from '@/lib/csv/validate-sites-csv'
import { useToast } from '@/hooks/use-toast'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
}

type Step = 'upload' | 'preview' | 'importing' | 'success'

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
        setImportedCount(0)
      }
      onOpenChange(newOpen)
    },
    [onOpenChange]
  )

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setSelectedFile(file)
    setIsProcessing(true)
    setAllErrors([])

    try {
      // Parse CSV
      const result = await parseSitesCsv(file)
      setParseResult(result)

      // Collect parsing errors
      const errors = [...result.errors]

      // Validate parsed sites if parsing succeeded
      if (result.success && result.data.length > 0) {
        const validationResult = validateSites(result.data)
        errors.push(...validationResult.errors)
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
      // Call API to import sites
      const response = await fetch(`/api/dashboard/properties/${propertyId}/sites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parseResult.data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Import failed' }))
        throw new Error(errorData.error || 'Import failed')
      }

      const result = await response.json()
      // Extract count from API response: { success: true, sites: [...], count: N }
      const count = result.count || result.sites?.length || (Array.isArray(result) ? result.length : 1)

      setImportedCount(count)
      setStep('success')

      toast({
        title: 'Import Successful',
        description: `Successfully imported ${count} site${count !== 1 ? 's' : ''}`,
      })
    } catch (error) {
      console.error('Import error:', error)
      toast({
        variant: 'destructive',
        title: 'Import Failed',
        description:
          error instanceof Error ? error.message : 'Failed to import sites',
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

  // Get summary text
  const getSummary = useCallback(() => {
    if (!parseResult) return null

    const summary = getValidationSummary(
      parseResult.rowCount,
      parseResult.validRowCount,
      { valid: !hasErrors, errors: allErrors, duplicates: [] }
    )

    return (
      <div className="grid grid-cols-2 gap-4 rounded-lg border p-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Total Rows</p>
          <p className="text-2xl font-bold">{summary.totalRows}</p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Valid Sites</p>
          <p className="text-2xl font-bold text-green-600">{summary.validRows}</p>
        </div>
        {summary.errorCount > 0 && (
          <>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Errors</p>
              <p className="text-2xl font-bold text-destructive">{summary.errorCount}</p>
            </div>
          </>
        )}
      </div>
    )
  }, [parseResult, hasErrors, allErrors])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Upload Step */}
        {step === 'upload' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Bulk Import Sites
              </DialogTitle>
              <DialogDescription>
                Upload a CSV file to import multiple sites at once. Download the
                template to see the correct format.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <CsvUploadDropzone
                onFileSelect={handleFileSelect}
                onClear={() => setSelectedFile(null)}
                selectedFile={selectedFile}
                disabled={isProcessing}
              />
            </div>

            {isProcessing && (
              <Alert>
                <Loader2 className="h-4 w-4 animate-spin" />
                <AlertDescription>
                  Processing CSV file... This may take a few seconds.
                </AlertDescription>
              </Alert>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}

        {/* Preview Step */}
        {step === 'preview' && parseResult && (
          <>
            <DialogHeader>
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

            <div className="space-y-6 py-4">
              {/* Summary */}
              {getSummary()}

              {/* Errors */}
              {hasErrors && <CsvErrorReport errors={allErrors} />}

              {/* Preview (only if no errors) */}
              {!hasErrors && (
                <>
                  <div>
                    <h3 className="font-medium mb-3">Preview Sites</h3>
                    <CsvPreviewTable sites={parseResult.data} />
                  </div>

                  <Alert>
                    <AlertDescription>
                      <strong>Note:</strong> Import is atomic. All sites will be
                      imported or none will be imported if any error occurs.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
              {!hasErrors && (
                <Button onClick={handleImport} disabled={!isValid}>
                  Import {parseResult.validRowCount} Site
                  {parseResult.validRowCount !== 1 ? 's' : ''}
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {/* Importing Step */}
        {step === 'importing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Importing Sites...
              </DialogTitle>
              <DialogDescription>
                Please wait while we import your sites. This may take a few seconds.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          </>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Import Successful
              </DialogTitle>
              <DialogDescription>
                Your sites have been successfully imported.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center py-12 space-y-4">
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

            <DialogFooter>
              <Button onClick={handleComplete}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

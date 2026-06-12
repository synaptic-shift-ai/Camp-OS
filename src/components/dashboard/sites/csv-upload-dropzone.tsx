'use client'

/**
 * CSV Upload Dropzone Component
 *
 * Drag-and-drop file upload area for CSV site import.
 * Validates file type and size before accepting.
 */

import { useState, useCallback, type ChangeEvent, type DragEvent } from 'react'
import { Upload, FileSpreadsheet, X, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MAX_FILE_SIZE_MB, type FileIssue } from '@/lib/csv/parse-sites-csv'
import { downloadCsvTemplate } from '@/lib/csv/site-csv-template'

interface CsvUploadDropzoneProps {
  onFileSelect: (file: File) => void
  onClear?: () => void
  disabled?: boolean
  selectedFile?: File | null
  className?: string
  fileIssue?: FileIssue | undefined
}

export function CsvUploadDropzone({
  onFileSelect,
  onClear,
  disabled = false,
  selectedFile = null,
  className,
  fileIssue,
}: CsvUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const validateFile = useCallback((file: File): string | null => {
    // Check file type
    if (!file.name.endsWith('.csv')) {
      return 'File must be a CSV (.csv extension)'
    }

    // Check file size
    const maxSizeBytes = MAX_FILE_SIZE_MB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File size must be less than ${MAX_FILE_SIZE_MB}MB`
    }

    return null
  }, [])

  const handleFile = useCallback(
    (file: File) => {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }

      setError(null)
      onFileSelect(file)
    },
    [validateFile, onFileSelect]
  )

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled) {
        setIsDragging(true)
      }
    },
    [disabled]
  )

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      if (disabled) return

      const files = Array.from(e.dataTransfer.files)
      const firstFile = files[0]
      if (firstFile) {
        handleFile(firstFile)
      }
    },
    [disabled, handleFile]
  )

  const handleFileInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      const firstFile = files?.[0]
      if (firstFile) {
        handleFile(firstFile)
      }
    },
    [handleFile]
  )

  const handleClear = useCallback(() => {
    setError(null)
    onClear?.()
  }, [onClear])

  const handleDownloadTemplate = useCallback(() => {
    downloadCsvTemplate()
  }, [])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Template Download Button */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleDownloadTemplate}
          disabled={disabled}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download Template
        </Button>
      </div>

      {/* Dropzone Area */}
      {!selectedFile ? (
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
            disabled && 'cursor-not-allowed opacity-50',
            !disabled && 'cursor-pointer',
            (error || !!fileIssue) && 'border-destructive bg-destructive/5'
          )}
        >
          <input
            type="file"
            accept=".csv"
            onChange={handleFileInput}
            disabled={disabled}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Upload CSV file"
          />

          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className={cn(
                'rounded-full p-4',
                isDragging ? 'bg-primary/10' : 'bg-muted'
              )}
            >
              <Upload
                className={cn(
                  'h-8 w-8',
                  isDragging ? 'text-primary' : 'text-muted-foreground'
                )}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">
                {isDragging ? 'Drop CSV file here' : 'Drag and drop your CSV file'}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: {MAX_FILE_SIZE_MB}MB
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Selected File Preview */
        <div
          className={cn(
            'flex items-center gap-4 rounded-lg border p-4',
            error ? 'border-destructive bg-destructive/5' : 'border-muted'
          )}
        >
          <div className="rounded-lg bg-primary/10 p-3">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">{selectedFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(selectedFile.size)}
            </p>
          </div>

          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClear}
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/5 p-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Structural File Issue Message */}
      {fileIssue && !error && (
        <p className="text-sm text-destructive mt-2">
          {fileIssue.type === 'file_type_error'
            ? 'This file is not a CSV. Please convert your file to CSV format or use our template.'
            : fileIssue.type === 'empty_file'
              ? 'The file is empty or contains only headers. Please upload a file with site data.'
              : fileIssue.type === 'encoding_error'
                ? 'The file could not be read. It may use an unsupported encoding. Please save it as UTF-8 CSV.'
                : fileIssue.message}
        </p>
      )}
    </div>
  )
}

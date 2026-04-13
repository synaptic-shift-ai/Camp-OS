'use client'

import { File, Loader2, Trash2, Upload, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react'

import { cn } from '@/lib/utils'
import { type UseSupabaseUploadReturn } from '@/hooks/use-supabase-upload'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { useProperty } from '@/components/property-context'
import { useToast } from '@/hooks/use-toast'
import { getApiFailureMessage } from '@/lib/api/get-api-failure-message'

// Shared animation duration — dropzone fades OUT, then gallery fades IN
const FADE_MS = 350

export const formatBytes = (
  bytes: number,
  decimals = 2,
  size?: 'bytes' | 'KB' | 'MB' | 'GB' | 'TB' | 'PB' | 'EB' | 'ZB' | 'YB'
) => {
  const k = 1000
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  if (bytes === 0 || bytes === undefined) return size !== undefined ? `0 ${size}` : '0 bytes'
  const i =
    size !== undefined ? sizes.indexOf(size) : Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

type DropzoneContextType = Omit<UseSupabaseUploadReturn, 'getRootProps' | 'getInputProps'> & {
  /** When set, total (uploadedCount + files.length) is validated against maxFiles so user can remove excess like site images */
  uploadedCount?: number | undefined
}
const DropzoneContext = createContext<DropzoneContextType | undefined>(undefined)

type DropzoneProps = UseSupabaseUploadReturn & { className?: string; uploadedCount?: number }

// ─── Dropzone ─────────────────────────────────────────────────────────────────

const Dropzone = ({
  className,
  children,
  getRootProps,
  getInputProps,
  uploadedCount,
  ...restProps
}: PropsWithChildren<DropzoneProps>) => {
  const isActive = restProps.isDragActive
  const isInvalid =
    (restProps.isDragActive && restProps.isDragReject) ||
    (restProps.errors.length > 0 && !restProps.isSuccess) ||
    restProps.files.some((file) => file.errors.length !== 0)

  return (
    <DropzoneContext.Provider value={{ ...restProps, uploadedCount }}>
      <div
        {...getRootProps({
          className: cn(
            'border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-card transition-colors duration-300 text-foreground',
            className,
            isActive && 'border-primary bg-primary/10',
            isInvalid && 'border-destructive bg-destructive/10'
          ),
        })}
      >
        <input {...getInputProps()} />
        {children}
      </div>
    </DropzoneContext.Provider>
  )
}

// ─── DropzoneEmptyState ───────────────────────────────────────────────────────

const DropzoneEmptyState = ({ className }: { className?: string }) => {
  const { maxFiles, maxFileSize, inputRef } = useDropzoneContext()

  return (
    <div className={cn('flex flex-col items-center gap-y-2', className)}>
      <Upload size={20} className="text-muted-foreground" />
      <p className="text-sm">
        Upload{!!maxFiles && maxFiles > 1 ? ` ${maxFiles}` : ''} file
        {!maxFiles || maxFiles > 1 ? 's' : ''}
      </p>
      <div className="flex flex-col items-center gap-y-1">
        <p className="text-xs text-muted-foreground">
          Drag and drop or{' '}
          <a
            onClick={() => inputRef.current?.click()}
            className="underline cursor-pointer transition hover:text-foreground"
          >
            select {maxFiles === 1 ? 'file' : 'files'}
          </a>{' '}
          to upload
        </p>
        {maxFileSize !== Number.POSITIVE_INFINITY && (
          <p className="text-xs text-muted-foreground">
            Maximum file size: {formatBytes(maxFileSize, 2)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── DropzoneCoverEmptyState ──────────────────────────────────────────────────
// Compact square variant for the cover image dropzone

const DropzoneCoverEmptyState = ({ className }: { className?: string }) => {
  const { maxFileSize, inputRef } = useDropzoneContext()

  return (
    <div className={cn('flex flex-col items-center gap-y-2', className)}>
      <Upload size={20} className="text-muted-foreground" />
      <p className="text-sm">Upload 1 file</p>
      <div className="flex flex-col items-center gap-y-1">
        <p className="text-xs text-muted-foreground">
          Drag and drop or{' '}
          <a
            onClick={() => inputRef.current?.click()}
            className="underline cursor-pointer transition hover:text-foreground"
          >
            select file
          </a>{' '}
          to upload
        </p>
        {maxFileSize !== Number.POSITIVE_INFINITY && (
          <p className="text-xs text-muted-foreground">
            Maximum file size: {formatBytes(maxFileSize, 2)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── DropzoneCoverContent ─────────────────────────────────────────────────────
// Shows the selected/uploading cover image inline inside the square dropzone.
// Auto-uploads on file selection.

type DropzoneCoverContentProps = {
  className?: string
  /** Existing cover image URL to show when no new file is selected */
  currentCoverUrl?: string | null
  onUploaded?: (url: string, name: string) => void
  onDeleted?: () => void
  propertyId: string
  bucketName?: string
}

const DropzoneCoverContent = ({
  className,
  currentCoverUrl,
  onUploaded,
  onDeleted,
  propertyId,
  bucketName = 'cover-property-images',
}: DropzoneCoverContentProps) => {
  const { files, setFiles, onUpload, loading, successes, errors, inputRef } = useDropzoneContext()
  const supabase = useMemo(() => createClient(), [])
  const { toast } = useToast()
  const { refreshProperties } = useProperty()
  const scheduledRef = useRef<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  // On mount (including after key-triggered remount), reset the file input
  // so the browser allows re-selecting the same filename
  useEffect(() => {
    if (inputRef?.current) {
      inputRef.current.value = ''
    }
  }, [])

  const handleDelete = async () => {
    if (!currentCoverUrl) return
    setDeleting(true)

    // Extract file path inside bucket from public URL
    // Format: https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
    const marker = `/object/public/${bucketName}/`
    const markerIdx = currentCoverUrl.indexOf(marker)
    const storagePath = markerIdx !== -1
      ? currentCoverUrl.slice(markerIdx + marker.length)
      : null

    if (storagePath) {
      await supabase.storage.from(bucketName).remove([storagePath])
    }

    await fetch(`/api/v1/properties/${propertyId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroImageUrl: null }),
    })

    setDeleting(false)
    scheduledRef.current.clear()
    if (inputRef?.current) inputRef.current.value = ''
    // Trigger remount via key change — then toast/refresh after a tick
    onDeleted?.()
    setTimeout(() => {
      refreshProperties()
      toast({ title: 'Cover photo removed' })
    }, 50)
  }

  const file = files[0] ?? null
  const isUploaded = file && successes.includes(file.name)
  const hasError = file && (file.errors.length > 0 || errors.find((e) => e.name === file.name))

  // Auto-upload when a valid file is selected
  const prevCountRef = useRef(0)
  useEffect(() => {
    const validCount = files.filter((f) => f.errors.length === 0).length
    if (validCount > prevCountRef.current && !loading) onUpload()
    prevCountRef.current = validCount
  }, [files.length, loading, onUpload])

  // After upload success: patch hero, notify parent, clear file
  useEffect(() => {
    if (!file || !successes.includes(file.name)) return
    if (scheduledRef.current.has(file.name)) return
    scheduledRef.current.add(file.name)

    const storagePath = `${propertyId}/cover/${file.name}`
    const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(storagePath)
    const heroUrl = urlData.publicUrl

    const patch = async () => {
      const res = await fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroImageUrl: heroUrl }),
      })
      const result = await res.json()
      if (res.ok && result.success) {
        onUploaded?.(heroUrl, file.name)
        toast({ title: 'Cover photo updated', description: `${file.name} is now the cover photo.` })
        setTimeout(() => refreshProperties(), 500)
        // Clear after animation so same filename can be uploaded again
        setTimeout(() => {
          setFiles([])
          scheduledRef.current.clear()
          if (inputRef?.current) inputRef.current.value = ''
        }, 600 + FADE_MS)
      } else {
        toast({
          title: 'Could not save cover photo',
          description: getApiFailureMessage(result) ?? 'Failed to update property',
          variant: 'destructive',
        })
      }
    }
    patch()
  }, [successes, file, propertyId, bucketName, supabase, onUploaded, toast, refreshProperties, setFiles])

  // Preview: prefer newly selected file, fall back to current saved cover
  const previewSrc = file?.preview ?? currentCoverUrl ?? null

  // No image at all — render nothing, let DropzoneCoverEmptyState show alongside
  if (!previewSrc) return null

  return (
    <div className={cn('absolute inset-2 rounded-md overflow-hidden', className)}>
      <img
        src={previewSrc}
        alt="Cover"
        className="w-full h-full object-cover"
      />
      {/* Overlay while uploading */}
      {loading && (
        <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1">
          <Loader2 size={20} className="animate-spin text-white" />
          <span className="text-white text-xs">Uploading...</span>
        </div>
      )}
      {/* Success flash */}
      {isUploaded && !loading && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
          <span className="text-white text-xs font-medium">Uploaded ✓</span>
        </div>
      )}
      {/* Error */}
      {hasError && (
        <div className="absolute inset-0 bg-destructive/60 flex items-center justify-center px-2">
          <span className="text-white text-xs text-center">Upload failed</span>
        </div>
      )}
      {/* Change + Delete buttons */}
      {!loading && !deleting && (
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}
            className="flex-1 shadow-sm shadow-gray-400 bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded transition"
          >
            Change
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDelete() }}
            className="bg-destructive/80 hover:bg-destructive text-white text-[10px] px-2 py-1 rounded transition"
          >
            Remove
          </button>
        </div>
      )}
      {deleting && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <Loader2 size={16} className="animate-spin text-white" />
        </div>
      )}
    </div>
  )
}

// ─── DropzoneContent ──────────────────────────────────────────────────────────

type DropzoneContentProps = {
  className?: string
  layout?: 'list' | 'grid'
}

const DropzoneContent = ({ className, layout = 'list' }: DropzoneContentProps) => {
  const {
    files,
    setFiles,
    onUpload,
    loading,
    successes,
    errors,
    maxFileSize,
    maxFiles,
    inputRef,
    uploadedCount = 0,
  } = useDropzoneContext()

  const pendingCount = files.filter((f) => !successes.includes(f.name)).length
  const totalCount = uploadedCount + pendingCount
  const exceedMaxTotal = totalCount > maxFiles
  const slotsLeft = Math.max(0, maxFiles - uploadedCount)
  const isGrid = layout === 'grid'
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set())
  const scheduledRef = useRef<Set<string>>(new Set())

  const prevValidCountRef = useRef(0)
  const prevExceedRef = useRef(false)
  const validFiles = useMemo(() => files.filter((f) => f.errors.length === 0), [files])
  useEffect(() => {
    const wasOverLimit = prevExceedRef.current
    if (exceedMaxTotal) prevExceedRef.current = true
    else prevExceedRef.current = false

    const shouldUpload =
      !loading &&
      !exceedMaxTotal &&
      validFiles.length > 0 &&
      (validFiles.length > prevValidCountRef.current || wasOverLimit)
    if (shouldUpload) onUpload()
    prevValidCountRef.current = validFiles.length
  }, [validFiles.length, loading, exceedMaxTotal, onUpload])

  useEffect(() => {
    successes.forEach((name) => {
      if (scheduledRef.current.has(name)) return
      scheduledRef.current.add(name)
      setTimeout(() => {
        requestAnimationFrame(() => setFadingOut((prev) => new Set([...prev, name])))
        setTimeout(() => {
          setFiles((prev) => prev.filter((f) => f.name !== name))
          scheduledRef.current.delete(name)
          setFadingOut((prev) => { const next = new Set(prev); next.delete(name); return next })
        }, FADE_MS)
      }, 600)
    })
  }, [successes, setFiles])

  const handleRemoveFile = useCallback((fileName: string) => {
    const newFiles = files.filter((f) => f.name !== fileName)
    setFiles(newFiles)
    if (newFiles.length === 0 && inputRef?.current) inputRef.current.value = ''
  }, [files, setFiles, inputRef])

  if (files.length === 0) return null

  return (
    <div className={cn('mt-4', isGrid ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'flex flex-col', className)}>
      {files.map((file, idx) => {
        const fileError = errors.find((e) => e.name === file.name)
        const isSuccessfullyUploaded = successes.includes(file.name)
        const isFading = fadingOut.has(file.name)
        const isOverTotalLimit =
          uploadedCount > 0 &&
          !isSuccessfullyUploaded &&
          idx >= slotsLeft

        return (
          <div
            key={`${file.name}-${idx}`}
            style={{
              transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
              opacity: isFading ? 0 : 1,
              transform: isFading ? 'translateY(-8px)' : 'translateY(0)',
            }}
            className={cn(
              isGrid
                ? 'flex flex-row items-center gap-x-3 rounded-lg border bg-card p-2 min-w-0'
                : 'flex items-center gap-x-4 border-b py-2 first:mt-4 last:mb-4'
            )}
          >
            {file.type.startsWith('image/') ? (
              <div className={cn('rounded border overflow-hidden shrink-0 bg-muted flex items-center justify-center', isGrid ? 'h-14 w-20' : 'h-10 w-10')}>
                <img src={file.preview} alt={file.name} className="object-cover h-full w-full" />
              </div>
            ) : (
              <div className={cn('rounded border bg-muted flex items-center justify-center shrink-0', isGrid ? 'h-14 w-20' : 'h-10 w-10')}>
                <File size={isGrid ? 24 : 18} />
              </div>
            )}
            <div className="shrink min-w-0 flex flex-col items-start justify-center gap-0.5">
              <p title={file.name} className="text-sm font-medium truncate w-full">{file.name}</p>
              {isOverTotalLimit ? (
                <p className="text-xs text-destructive truncate w-full">Too many files</p>
              ) : file.errors.length > 0 ? (
                <p className="text-xs text-destructive truncate w-full">
                  {file.errors.map((e) => e.message.startsWith('File is larger than')
                    ? `File is larger than ${formatBytes(maxFileSize, 2)} (Size: ${formatBytes(file.size, 2)})`
                    : e.message).join(', ')}
                </p>
              ) : loading && !isSuccessfullyUploaded ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Uploading...
                </p>
              ) : !!fileError ? (
                <p className="text-xs text-destructive truncate w-full">Failed to upload: {fileError.message}</p>
              ) : isSuccessfullyUploaded ? (
                <p className="text-xs text-primary">Uploaded ✓</p>
              ) : (
                <p className="text-xs text-muted-foreground">{formatBytes(file.size, 2)}</p>
              )}
            </div>
            {!loading && !isSuccessfullyUploaded && (
              <Button size="icon" variant="link" className="shrink-0 ml-auto text-muted-foreground hover:text-foreground h-8 w-8" onClick={() => handleRemoveFile(file.name)}>
                <X />
              </Button>
            )}
          </div>
        )
      })}
      {exceedMaxTotal && (
        <p className="text-sm text-left mt-2 text-destructive col-span-2">
          You may upload only up to {maxFiles} files total ({uploadedCount} already uploaded), please remove {totalCount - maxFiles} file{totalCount - maxFiles > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  )
}

// ─── DropzoneUploadedContent ──────────────────────────────────────────────────
// Lives OUTSIDE <Dropzone>. Receives upload state via prop.
// Cover image (if any) is always pinned first with a badge.

type PersistedImage = { url: string; name: string; isCover?: boolean }

type DropzoneUploadedContentProps = {
  className?: string
  layout?: 'list' | 'grid'
  propertyId?: string
  bucketName?: string
  storagePath?: string
  upload: Pick<UseSupabaseUploadReturn, 'files' | 'successes' | 'isSuccess' | 'setFiles'>
  onPersistedCountChange?: (count: number) => void
}

const DropzoneUploadedContent = ({
  className,
  layout = 'grid',
  propertyId,
  bucketName = 'property-images',
  storagePath,
  upload,
  onPersistedCountChange,
}: DropzoneUploadedContentProps) => {
  const { successes } = upload
  const { toast } = useToast()
  const supabase = useMemo(() => createClient(), [])

  const [persistedImages, setPersistedImages] = useState<PersistedImage[]>([])
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [fadingIn, setFadingIn] = useState<Set<string>>(new Set())
  // Track which filenames already processed so we don't re-add on re-render
  const processedRef = useRef<Set<string>>(new Set())

  const resolvedPath = storagePath ?? (propertyId ? `${propertyId}/gallery` : undefined)

  useEffect(() => {
    onPersistedCountChange?.(persistedImages.length)
  }, [persistedImages.length, onPersistedCountChange])

  // 1. Load persisted images on mount
  useEffect(() => {
    if (!propertyId || !resolvedPath) return
    const load = async () => {
      const { data, error } = await supabase.storage.from(bucketName).list(resolvedPath)
      if (error || !data) return
      const images: PersistedImage[] = data
        .filter((item) => !!item.name && item.name !== '.emptyFolderPlaceholder')
        .map((item) => {
          const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(`${resolvedPath}/${item.name}`)
          return { url: urlData.publicUrl, name: item.name }
        })
      setPersistedImages(images)
      // Mark as processed so uploads of same name don't re-add
      images.forEach((img) => processedRef.current.add(img.name))
    }
    load()
  }, [propertyId, resolvedPath, bucketName, supabase])

  // 2. Watch successes directly — fires as each file completes, regardless of isSuccess
  useEffect(() => {
    if (!propertyId || !resolvedPath || successes.length === 0) return

    // Only handle filenames we haven't processed yet
    const newNames = successes.filter((name) => !processedRef.current.has(name))
    if (newNames.length === 0) return
    newNames.forEach((name) => processedRef.current.add(name))

    const newImages: PersistedImage[] = newNames.map((name) => {
      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(`${resolvedPath}/${name}`)
      return { url: urlData.publicUrl, name }
    })

    // Sync all current image URLs to DB
    const syncImages = (updatedImages: PersistedImage[]) => {
      fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryImages: updatedImages.map((i) => i.url) }),
      })
    }

    setTimeout(() => {
      setPersistedImages((prev) => {
        const existing = new Set(prev.map((i) => i.url))
        const toAdd = newImages.filter((i) => !existing.has(i.url))
        const updated = toAdd.length === 0 ? prev : [...prev, ...toAdd]
        syncImages(updated)
        return updated
      })
      setFadingIn(new Set(newImages.map((i) => i.url)))
      requestAnimationFrame(() => requestAnimationFrame(() => setFadingIn(new Set())))
    }, 600 + FADE_MS)
  }, [propertyId, successes, resolvedPath, bucketName, supabase])

  // 3. Delete image from storage + sync updated URLs to DB
  const handleDelete = useCallback(async (img: PersistedImage) => {
    if (!resolvedPath) return
    setDeletingName(img.name)
    const { error } = await supabase.storage.from(bucketName).remove([`${resolvedPath}/${img.name}`])
    setDeletingName(null)
    if (error) {
      toast({ title: 'Delete failed', description: error.message, variant: 'destructive' })
      return
    }
    setPersistedImages((prev) => {
      const updated = prev.filter((i) => i.name !== img.name)
      processedRef.current.delete(img.name)
      fetch(`/api/v1/properties/${propertyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ galleryImages: updated.map((i) => i.url) }),
      })
      return updated
    })
    toast({ title: 'Image deleted', description: `${img.name} has been removed.` })
  }, [resolvedPath, bucketName, supabase, toast, propertyId])

  if (persistedImages.length === 0) return null

  return (
    <div className={cn('pt-2', className)}>
      <h4 className="text-sm font-medium mb-3">Uploaded images</h4>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {persistedImages.map((img) => {
          const isFadingIn = fadingIn.has(img.url)
          const isDeleting = deletingName === img.name
          return (
            <div
              key={img.url}
              style={{
                transition: `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease`,
                opacity: isFadingIn ? 0 : 1,
                transform: isFadingIn ? 'translateY(8px)' : 'translateY(0)',
              }}
              className="relative h-28 rounded-lg overflow-hidden bg-muted group"
            >
              {/* Image fills the square */}
              <img
                src={img.url}
                alt={img.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Delete button — top right, always visible so user can remove excess images */}
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => handleDelete(img)}
                className="absolute top-1.5 right-1.5 h-7 w-7 rounded-md flex items-center justify-center backdrop-blur-sm bg-black/50 hover:bg-destructive/90 text-white opacity-90 hover:opacity-100 transition"
              >
                {isDeleting
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Trash2 size={13} />
                }
              </button>
              {/* Filename — bottom bar, blurred bg */}
              <div className="absolute bottom-0 left-0 right-0 px-2 pt-6 pb-1.5 bg-gradient-to-t from-black/50 to-transparent">
                <p title={img.name} className="text-white text-[11px] font-medium truncate leading-tight">
                  {img.name}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── useDropzoneContext ───────────────────────────────────────────────────────

const useDropzoneContext = () => {
  const context = useContext(DropzoneContext)
  if (!context) throw new Error('useDropzoneContext must be used within a Dropzone')
  return context
}

export {
  Dropzone,
  DropzoneContent,
  DropzoneCoverContent,
  DropzoneCoverEmptyState,
  DropzoneUploadedContent,
  DropzoneEmptyState,
  useDropzoneContext,
}
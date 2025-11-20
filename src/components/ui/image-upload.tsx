"use client"

import { useState, useRef, type ChangeEvent } from "react"
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
  onUpload?: (file: File) => Promise<string>
  maxSizeMB?: number
  className?: string
  disabled?: boolean
  placeholder?: string
}

export function ImageUpload({
  value,
  onChange,
  onUpload,
  maxSizeMB = 5,
  className,
  disabled = false,
  placeholder = "Click to upload image",
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(value || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    // Validate file size
    const sizeMB = file.size / (1024 * 1024)
    if (sizeMB > maxSizeMB) {
      alert(`Image must be smaller than ${maxSizeMB}MB`)
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload file
    if (onUpload) {
      try {
        setUploading(true)
        const url = await onUpload(file)
        onChange(url)
      } catch (error) {
        console.error("Upload failed:", error)
        alert("Failed to upload image. Please try again.")
        setPreview(null)
      } finally {
        setUploading(false)
      }
    } else {
      // If no upload handler, just use the preview (base64)
      onChange(preview)
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  return (
    <div className={cn("relative", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {preview ? (
        <div className="relative group">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
            <Image
              src={preview}
              alt="Preview"
              fill
              className="object-cover"
              unoptimized={preview.startsWith("data:")}
            />
          </div>
          {!disabled && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleClick}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Change
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleRemove}
                disabled={uploading}
              >
                <X className="mr-2 h-4 w-4" />
                Remove
              </Button>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled || uploading}
          className={cn(
            "relative aspect-video w-full overflow-hidden rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted hover:bg-muted/80 transition-colors",
            "flex flex-col items-center justify-center gap-2 text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed",
            !disabled && "cursor-pointer hover:border-primary"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Uploading...</p>
            </>
          ) : (
            <>
              <ImageIcon className="h-8 w-8" />
              <p className="text-sm font-medium">{placeholder}</p>
              <p className="text-xs text-muted-foreground/60">
                PNG, JPG, WebP up to {maxSizeMB}MB
              </p>
            </>
          )}
        </button>
      )}
    </div>
  )
}

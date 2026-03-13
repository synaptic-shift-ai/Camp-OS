"use client"

import { useState } from "react"
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileArchive,
  Check,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export type ExportFormatId = "csv" | string

export type ExportFormat = {
  id: ExportFormatId
  label: string
}

type ExportMenuProps = {
  onExport: (format: ExportFormatId) => void
  formats?: ExportFormat[]
  disabled?: boolean
  "aria-label"?: string
}

const defaultFormats: ExportFormat[] = [
  {
    id: "csv",
    label: "CSV",
  },
]

export function ExportMenu({
  onExport,
  formats = defaultFormats,
  disabled,
  "aria-label": ariaLabel,
}: ExportMenuProps) {
  const hasFormats = formats.length > 0

  const [selectedFormat, setSelectedFormat] = useState<ExportFormatId>("csv")

  const handleSelect = (format: ExportFormat) => {
    setSelectedFormat(format.id)
    onExport(format.id)
  }

  const renderIcon = (id: ExportFormatId) => {
    switch (id) {
      case "csv":
        return <FileSpreadsheet className="h-4 w-4" />
      case "pdf":
        return <FileText className="h-4 w-4" />
      case "zip":
        return <FileArchive className="h-4 w-4" />
      default:
        return <FileSpreadsheet className="h-4 w-4" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={disabled || !hasFormats}
          aria-label={ariaLabel ?? "Export data"}
        >
          <Download className="h-3 w-3" />
          <span>Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>Export Format</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {formats.map((format) => (
          <DropdownMenuItem
            key={format.id}
            className="flex items-center justify-between gap-2 text-xs"
            onClick={() => handleSelect(format)}
          >
            <div className="flex items-center gap-2">
              {renderIcon(format.id)}
              <span className="text-sm font-medium">{format.label}</span>
            </div>
            {format.id === selectedFormat && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


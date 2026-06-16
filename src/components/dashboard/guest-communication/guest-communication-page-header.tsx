"use client"

import { ExportMenu, type ExportFormatId } from "@/components/ui/export-menu"

type GuestCommunicationPageHeaderProps = {
  propertyName: string
  onExport: (format: ExportFormatId) => void
  isExporting?: boolean
}

export function GuestCommunicationPageHeader({ 
  propertyName,
  onExport,
  isExporting = false,
}: GuestCommunicationPageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-heading font-bold tracking-tight sm:text-3xl">Guest communication</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{propertyName}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
        <ExportMenu
          onExport={onExport}
          disabled={isExporting}
          aria-label="Export guest communication data"
        />
      </div>
    </div>
  )
}

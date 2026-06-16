"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"
import {
  exportGuestDeliveryLogs,
  exportMessageBroadcastCampaigns,
  exportOptOutRecords,
} from "./export-guest-communication"
import { useSearchParams } from "next/navigation"
import { GuestCommunicationPageHeader } from "./guest-communication-page-header"
import {
  GuestCommunicationViewSwitcher,
  type GuestCommunicationViewMode,
} from "./guest-communication-view-switcher"
import { GuestDeliveryPanel } from "./guest-delivery-panel"
import { OptOutsPanel } from "./opt-outs-panel"
import { CampaignsPanel } from "./campaigns-panel"

type GuestCommunicationPageContentProps = {
  propertyId: string
  propertyName: string
}

export function GuestCommunicationPageContent(props: GuestCommunicationPageContentProps) {
  return (
    <Suspense>
      <GuestCommunicationPageContentInner {...props} />
    </Suspense>
  )
}

function GuestCommunicationPageContentInner({
  propertyId,
  propertyName,
}: GuestCommunicationPageContentProps) {
  const searchParams = useSearchParams()
  const initialTab = searchParams.get("tab")
  const [viewMode, setViewMode] = useState<GuestCommunicationViewMode>(() => {
    if (initialTab === "guest_delivery") return "guest_delivery"
    if (initialTab === "opt_outs") return "opt_outs"
    return "campaigns"
  })

  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)

  const handleExport = useCallback(
    async (format: string) => {
      if (format !== "csv") return

      const exportConfig = {
        campaigns: {
          run: () => exportMessageBroadcastCampaigns(propertyId),
          emptyMessage: "No campaigns found for this property.",
          successLabel: "Message broadcast CSV downloaded",
        },
        guest_delivery: {
          run: () => exportGuestDeliveryLogs(propertyId),
          emptyMessage: "No delivery activity found for this property.",
          successLabel: "Guest delivery CSV downloaded",
        },
        opt_outs: {
          run: () => exportOptOutRecords(propertyId),
          emptyMessage: "No opt-out records found for this property.",
          successLabel: "Opt-outs CSV downloaded",
        },
      } as const

      const config = exportConfig[viewMode]

      try {
        setIsExporting(true)
        const count = await config.run()

        if (count === 0) {
          toast({
            title: "Nothing to export",
            description: config.emptyMessage,
          })
          return
        }

        toast({
          title: "Export ready",
          description: `${config.successLabel} (${count} rows).`,
        })
      } catch (err) {
        toast({
          title: "Export failed",
          description: err instanceof Error ? err.message : "Please try again.",
          variant: "destructive",
        })
      } finally {
        setIsExporting(false)
      }
    },
    [propertyId, viewMode, toast],
  )

  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab === "guest_delivery") {
      setViewMode("guest_delivery")
    } else if (tab === "opt_outs") {
      setViewMode("opt_outs")
    } else {
      setViewMode("campaigns")
    }
  }, [searchParams])

  return (
    <div className="space-y-4 sm:space-y-6" data-property-id={propertyId}>
      <GuestCommunicationPageHeader 
        propertyName={propertyName}
        onExport={(format) => void handleExport(format)}
        isExporting={isExporting}
      />

      <div className="flex w-full justify-end">
        <GuestCommunicationViewSwitcher mode={viewMode} onModeChange={setViewMode} />
      </div>

      {viewMode === "guest_delivery" ? (
        <GuestDeliveryPanel propertyId={propertyId} />
      ) : viewMode === "opt_outs" ? (
        <OptOutsPanel propertyId={propertyId} />
      ) : (
        <CampaignsPanel propertyId={propertyId} />
      )}
    </div>
  )
}

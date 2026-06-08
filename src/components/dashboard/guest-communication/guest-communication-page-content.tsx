"use client"

import { Suspense, useState } from "react"
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

  return (
    <div className="space-y-4 sm:space-y-6" data-property-id={propertyId}>
      <GuestCommunicationPageHeader propertyName={propertyName} />

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

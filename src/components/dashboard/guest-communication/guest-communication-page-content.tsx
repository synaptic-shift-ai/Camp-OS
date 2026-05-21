"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { GuestCommunicationPageHeader } from "./guest-communication-page-header"
import {
  GuestCommunicationViewSwitcher,
  type GuestCommunicationViewMode,
} from "./guest-communication-view-switcher"
import { SmsInboxPanel } from "./sms-inbox-panel"
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
    if (initialTab === "campaigns") return "campaigns"
    if (initialTab === "guest_delivery") return "guest_delivery"
    if (initialTab === "opt_outs") return "opt_outs"
    return "sms_inbox"
  })

  return (
    <div className="space-y-4 sm:space-y-6" data-property-id={propertyId}>
      <GuestCommunicationPageHeader propertyName={propertyName} />

      <div className="flex w-full justify-end">
        <GuestCommunicationViewSwitcher mode={viewMode} onModeChange={setViewMode} />
      </div>

      {viewMode === "sms_inbox" ? (
        <div className="space-y-4">
          {/* <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-heading font-bold tracking-tight sm:text-2xl">
                SMS inbox — {propertyName}
              </h2>
              <p className="text-sm text-muted-foreground">
                Two-way conversations linked to reservations.
              </p>
            </div>
          </div> */}
          <SmsInboxPanel propertyId={propertyId} />
        </div>
      ) : viewMode === "guest_delivery" ? (
        <GuestDeliveryPanel propertyId={propertyId} />
      ) : viewMode === "opt_outs" ? (
        <OptOutsPanel propertyId={propertyId} />
      ) : viewMode === "campaigns" ? (
        <CampaignsPanel propertyId={propertyId} />
      ) : null}
    </div>
  )
}

"use client"

import { useState } from "react"
import { GuestCommunicationPageHeader } from "./guest-communication-page-header"
import {
  GuestCommunicationViewSwitcher,
  type GuestCommunicationViewMode,
} from "./guest-communication-view-switcher"
import { SmsInboxPanel } from "./sms-inbox-panel"
import { GuestDeliveryPanel } from "./guest-delivery-panel"
import { EmailBrandingPanel } from "./email-branding-panel"
import { OptOutsPanel } from "./opt-outs-panel"

type GuestCommunicationPageContentProps = {
  propertyId: string
  propertyName: string
}

export function GuestCommunicationPageContent({
  propertyId,
  propertyName,
}: GuestCommunicationPageContentProps) {
  const [viewMode, setViewMode] = useState<GuestCommunicationViewMode>("sms_inbox")

  return (
    <div className="space-y-4 sm:space-y-6" data-property-id={propertyId}>
      <GuestCommunicationPageHeader propertyName={propertyName} />

      <div className="flex w-full justify-end">
        <GuestCommunicationViewSwitcher mode={viewMode} onModeChange={setViewMode} />
      </div>

      {viewMode === "sms_inbox" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-heading font-bold tracking-tight sm:text-2xl">
                SMS inbox — {propertyName}
              </h2>
              <p className="text-sm text-muted-foreground">
                Two-way conversations linked to reservations.
              </p>
            </div>
          </div>
          <SmsInboxPanel />
        </div>
      ) : viewMode === "guest_delivery" ? (
        <GuestDeliveryPanel propertyId={propertyId} />
      ) : viewMode === "branding" ? (
        <EmailBrandingPanel propertyId={propertyId} propertyName={propertyName} />
      ) : viewMode === "opt_outs" ? (
        <OptOutsPanel propertyId={propertyId} />
      ) : null}
    </div>
  )
}

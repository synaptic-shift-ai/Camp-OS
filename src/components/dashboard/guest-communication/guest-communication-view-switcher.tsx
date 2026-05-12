"use client"

import { Inbox, Package, Palette, ShieldOff } from "lucide-react"

export type GuestCommunicationViewMode = "sms_inbox" | "guest_delivery" | "branding" | "opt_outs"

type GuestCommunicationViewSwitcherProps = {
  mode: GuestCommunicationViewMode
  onModeChange: (mode: GuestCommunicationViewMode) => void
}

const tabButtonClass = (selected: boolean) =>
  [
    "inline-flex shrink-0 items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
    selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60",
  ].join(" ")

export function GuestCommunicationViewSwitcher({
  mode,
  onModeChange,
}: GuestCommunicationViewSwitcherProps) {
  return (
    <div className="flex w-full items-center justify-end">
      <div
        className="relative inline-flex max-w-full items-center overflow-x-auto rounded-md border border-border/80 bg-card/50 p-1"
        role="tablist"
        aria-label="Guest communication views"
      >
        <button
          id="guest-comm-tab-sms"
          type="button"
          role="tab"
          aria-selected={mode === "sms_inbox"}
          aria-controls="guest-comm-panel-sms"
          onClick={() => onModeChange("sms_inbox")}
          className={tabButtonClass(mode === "sms_inbox")}
        >
          <Inbox className="h-4 w-4 shrink-0" aria-hidden />
          SMS Inbox
        </button>
        <button
          id="guest-comm-tab-delivery"
          type="button"
          role="tab"
          aria-selected={mode === "guest_delivery"}
          aria-controls="guest-comm-panel-delivery"
          onClick={() => onModeChange("guest_delivery")}
          className={tabButtonClass(mode === "guest_delivery")}
        >
          <Package className="h-4 w-4 shrink-0" aria-hidden />
          Guest Delivery
        </button>
        <button
          id="guest-comm-tab-branding"
          type="button"
          role="tab"
          aria-selected={mode === "branding"}
          aria-controls="guest-comm-panel-branding"
          onClick={() => onModeChange("branding")}
          className={tabButtonClass(mode === "branding")}
        >
          <Palette className="h-4 w-4 shrink-0" aria-hidden />
          Branding
        </button>
        <button
          id="guest-comm-tab-opt-outs"
          type="button"
          role="tab"
          aria-selected={mode === "opt_outs"}
          aria-controls="guest-comm-panel-opt-outs"
          onClick={() => onModeChange("opt_outs")}
          className={tabButtonClass(mode === "opt_outs")}
        >
          <ShieldOff className="h-4 w-4 shrink-0" aria-hidden />
          Opt-Outs
        </button>
      </div>
    </div>
  )
}

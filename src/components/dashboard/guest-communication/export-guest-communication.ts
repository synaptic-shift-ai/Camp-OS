import { buildExportFilename, exportToCsv } from "@/lib/csv/export"

const PAGE_SIZE = 100

type DeliveryLogEntry = {
  channel: string
  status: string
  recipient_address: string
  created_at: string
  reservation: { confirmation_number: string } | null
  guest: { first_name: string; last_name: string; email: string } | null
  template: { name: string } | null
}

type CampaignEntry = {
  name: string
  channel: "email" | "sms" | "both"
  status: string
  segment_type: string
  sent_at: string | null
  recipient_count: number
  created_at: string
}

type OptOutEntry = {
  guestName: string
  guestEmail: string
  channel: string
  optedOutAt: string
  source: string
}

function formatGuestName(guest: DeliveryLogEntry["guest"]): string {
  if (!guest) return "Unknown"
  const name = [guest.first_name, guest.last_name].filter(Boolean).join(" ")
  return name || guest.email || "Unknown"
}

function capitalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()
}

function formatSegmentLabel(segmentType: string): string {
  return segmentType
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatCampaignChannel(channel: string): string {
  if (channel === "both") return "Email + SMS"
  return channel.toUpperCase()
}

async function fetchAllDeliveryLogs(propertyId: string): Promise<DeliveryLogEntry[]> {
  const out: DeliveryLogEntry[] = []
  let offset = 0
  let total: number | null = null

  for (;;) {
    const params = new URLSearchParams({
      propertyId,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    const res = await fetch(`/api/v1/communications/log?${params}`)
    const json = await res.json()

    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message ?? "Failed to fetch delivery logs")
    }

    const batch: DeliveryLogEntry[] = json.data.data ?? []
    if (offset === 0 && typeof json.data.count === "number") {
      total = json.data.count
    }

    out.push(...batch)

    if (batch.length < PAGE_SIZE) break
    if (total !== null && out.length >= total) break

    offset += PAGE_SIZE
  }

  return out
}

async function fetchAllCampaigns(propertyId: string): Promise<CampaignEntry[]> {
  const out: CampaignEntry[] = []
  let offset = 0
  let total: number | null = null

  for (;;) {
    const params = new URLSearchParams({
      propertyId,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    const res = await fetch(`/api/v1/message-campaigns?${params}`)
    const json = await res.json()

    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message ?? "Failed to fetch campaigns")
    }

    const batch: CampaignEntry[] = json.data.campaigns ?? []
    if (offset === 0 && typeof json.data.count === "number") {
      total = json.data.count
    }

    out.push(...batch)

    if (batch.length < PAGE_SIZE) break
    if (total !== null && out.length >= total) break

    offset += PAGE_SIZE
  }

  return out
}

async function fetchAllOptOuts(propertyId: string): Promise<OptOutEntry[]> {
  const out: OptOutEntry[] = []
  let offset = 0
  let total: number | null = null

  for (;;) {
    const params = new URLSearchParams({
      propertyId,
      limit: String(PAGE_SIZE),
      offset: String(offset),
    })
    const res = await fetch(`/api/v1/communications/opt-outs?${params}`)
    const json = await res.json()

    if (!res.ok || !json.success) {
      throw new Error(json?.error?.message ?? "Failed to fetch opt-outs")
    }

    const batch: OptOutEntry[] = json.data.data ?? []
    if (offset === 0 && typeof json.data.count === "number") {
      total = json.data.count
    }

    out.push(...batch)

    if (batch.length < PAGE_SIZE) break
    if (total !== null && out.length >= total) break

    offset += PAGE_SIZE
  }

  return out
}

export async function exportGuestDeliveryLogs(propertyId: string): Promise<number> {
  const logs = await fetchAllDeliveryLogs(propertyId)
  if (logs.length === 0) return 0

  exportToCsv(
    buildExportFilename("GUEST-DELIVERY"),
    logs.map((entry) => ({
      when: new Date(entry.created_at).toLocaleString(),
      guest: formatGuestName(entry.guest),
      template: entry.template?.name ?? "—",
      channel: entry.channel?.toUpperCase() ?? "",
      status: capitalizeStatus(entry.status),
      reservation: entry.reservation?.confirmation_number
        ? `#${entry.reservation.confirmation_number}`
        : "—",
      recipient: entry.recipient_address ?? "",
    })),
    [
      { key: "when", header: "When" },
      { key: "guest", header: "Guest" },
      { key: "template", header: "Template" },
      { key: "channel", header: "Channel" },
      { key: "status", header: "Status" },
      { key: "reservation", header: "Reservation" },
      { key: "recipient", header: "Recipient" },
    ],
  )

  return logs.length
}

export async function exportMessageBroadcastCampaigns(propertyId: string): Promise<number> {
  const campaigns = await fetchAllCampaigns(propertyId)
  if (campaigns.length === 0) return 0

  exportToCsv(
    buildExportFilename("MESSAGE-BROADCAST"),
    campaigns.map((campaign) => ({
      name: campaign.name,
      channel: formatCampaignChannel(campaign.channel),
      status: capitalizeStatus(campaign.status),
      segment: formatSegmentLabel(campaign.segment_type),
      sentDate: campaign.sent_at
        ? new Date(campaign.sent_at).toLocaleDateString()
        : "—",
      recipients: campaign.recipient_count ?? 0,
      createdAt: new Date(campaign.created_at).toLocaleDateString(),
    })),
    [
      { key: "name", header: "Name" },
      { key: "channel", header: "Channel" },
      { key: "status", header: "Status" },
      { key: "segment", header: "Segment" },
      { key: "sentDate", header: "Sent Date" },
      { key: "recipients", header: "Recipients" },
      { key: "createdAt", header: "Created At" },
    ],
  )

  return campaigns.length
}

export async function exportOptOutRecords(propertyId: string): Promise<number> {
  const records = await fetchAllOptOuts(propertyId)
  if (records.length === 0) return 0

  exportToCsv(
    buildExportFilename("OPT-OUTS"),
    records.map((record) => ({
      guestName: record.guestName,
      email: record.guestEmail,
      channel: record.channel,
      optedOutDate: record.optedOutAt
        ? new Date(record.optedOutAt).toLocaleDateString()
        : "—",
      source: record.source,
    })),
    [
      { key: "guestName", header: "Guest Name" },
      { key: "email", header: "Email" },
      { key: "channel", header: "Channel" },
      { key: "optedOutDate", header: "Opted Out Date" },
      { key: "source", header: "Source" },
    ],
  )

  return records.length
}

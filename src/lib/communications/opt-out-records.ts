export type CommunicationOptOutRow = {
  id: string
  channel: string
  opted_out_at: string
  source: string
  guest:
    | {
        first_name: string | null
        last_name: string | null
        email: string | null
      }
    | Array<{
        first_name: string | null
        last_name: string | null
        email: string | null
      }>
    | null
}

export type CommunicationOptOutRecord = {
  id: string
  guestName: string
  guestEmail: string
  channel: string
  optedOutAt: string
  source: string
}

export function mapCommunicationOptOutRow(
  row: CommunicationOptOutRow,
): CommunicationOptOutRecord {
  const guest = Array.isArray(row.guest) ? row.guest[0] : row.guest
  const firstName = guest?.first_name?.trim() ?? ""
  const lastName = guest?.last_name?.trim() ?? ""

  return {
    id: row.id,
    guestName: [firstName, lastName].filter(Boolean).join(" ") || "Unknown",
    guestEmail: guest?.email ?? "",
    channel: row.channel.toUpperCase(),
    optedOutAt: row.opted_out_at,
    source: row.source,
  }
}

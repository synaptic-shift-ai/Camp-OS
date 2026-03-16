import { jsPDF } from "jspdf"

/**
 * Input for generating a booking confirmation PDF.
 * Kept generic so it can be used from confirmation page, guest views, or API.
 */
export type ConfirmationPdfInput = {
  confirmationNumber: string
  site: { name: string; site_type: string }
  checkInDate: Date
  checkOutDate: Date
  propertyName?: string
  propertyAddress?: string
  guest: { first_name: string; last_name: string; email: string; phone: string }
  /** Number of nights */
  nights: number
  /** Amounts in cents */
  basePriceCents: number
  subtotalCents: number
  cleaningFeeCents?: number
  serviceFeeCents: number
  discountCents?: number
  taxesCents?: number
  totalCents: number
  taxLabel?: string
}

const HEADER_COLOR = [45, 90, 39] as const // #2D5A27
const TOTAL_GREEN = [45, 90, 39] as const
const MARGIN = 14
const PAGE_W = 210
const COL2_X = 105

function toDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

function formatDate(date: Date, formatStr: string): string {
  const d = date.getDate()
  const m = date.getMonth()
  const y = date.getFullYear()
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  if (formatStr === "EEEE, MMMM d, yyyy") {
    return `${days[date.getDay()]}, ${months[m]} ${d}, ${y}`
  }
  return date.toLocaleDateString()
}

/**
 * Generates a booking confirmation PDF matching the confirmation card UI:
 * dark green header with "Confirmation Details" and confirmation number (uppercase),
 * two-column body (site details | guest + payment summary).
 * Returns the jsPDF document and the suggested filename (uppercase).
 */
export function generateConfirmationPdf(input: ConfirmationPdfInput): { doc: jsPDF; filename: string } {
  const doc = new jsPDF()
  const propertyName = input.propertyName ?? "Pine Lake Campground"
  const propertyAddress = input.propertyAddress ?? "123 Forest Road, Pine Valley, CA 95000"

  let y = 0

  // ----- Header (dark green bar) -----
  const headerHeight = 28
  doc.setFillColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2])
  doc.rect(0, 0, PAGE_W, headerHeight, "F")
  y = 12

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text("Confirmation Details", MARGIN, y)
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(220, 220, 220)
  doc.text("Save this for your records", MARGIN, y + 6)

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(9)
  doc.text("Confirmation Number", PAGE_W - MARGIN, y - 2, { align: "right" })
  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.text(input.confirmationNumber.toUpperCase(), PAGE_W - MARGIN, y + 6, { align: "right" })
  doc.setFont("helvetica", "normal")

  y = headerHeight + 16

  // ----- Left column: Site details -----
  doc.setFontSize(14)
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "bold")
  doc.text(input.site.name, MARGIN, y)
  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(100, 100, 100)
  const siteTypeLabel = `${input.site.site_type.charAt(0).toUpperCase() + input.site.site_type.slice(1)} Site`
  doc.text(siteTypeLabel, MARGIN, y + 6)
  y += 16

  doc.setTextColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2])
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Check-in", MARGIN, y)
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.text(formatDate(input.checkInDate, "EEEE, MMMM d, yyyy"), MARGIN, y + 5)
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  doc.text("After 2:00 PM", MARGIN, y + 10)
  y += 18

  doc.setTextColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2])
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Check-out", MARGIN, y)
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.text(formatDate(input.checkOutDate, "EEEE, MMMM d, yyyy"), MARGIN, y + 5)
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  doc.text("Before 11:00 AM", MARGIN, y + 10)
  y += 18

  doc.setTextColor(HEADER_COLOR[0], HEADER_COLOR[1], HEADER_COLOR[2])
  doc.setFont("helvetica", "bold")
  doc.setFontSize(10)
  doc.text("Location", MARGIN, y)
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")
  doc.text(propertyName, MARGIN, y + 5)
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(9)
  doc.text(propertyAddress, MARGIN, y + 10)

  // ----- Right column: Guest + Payment -----
  let yRight = headerHeight + 16
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  doc.text("Guest Information", COL2_X, yRight)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  yRight += 10

  const guestName = `${input.guest.first_name} ${input.guest.last_name}`
  doc.setTextColor(100, 100, 100)
  doc.text("Name", COL2_X, yRight)
  doc.setTextColor(0, 0, 0)
  doc.text(guestName, COL2_X, yRight + 5)
  yRight += 12

  doc.setTextColor(100, 100, 100)
  doc.text("Email", COL2_X, yRight)
  doc.setTextColor(0, 0, 0)
  doc.text(input.guest.email, COL2_X, yRight + 5)
  yRight += 12

  doc.setTextColor(100, 100, 100)
  doc.text("Phone", COL2_X, yRight)
  doc.setTextColor(0, 0, 0)
  doc.text(input.guest.phone, COL2_X, yRight + 5)
  yRight += 18

  // Divider line
  doc.setDrawColor(220, 220, 220)
  doc.line(COL2_X, yRight, PAGE_W - MARGIN, yRight)
  yRight += 12

  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Payment Summary", COL2_X, yRight)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  yRight += 10

  const lineH = 6
  doc.text(`$${toDollars(input.basePriceCents)} × ${input.nights} night(s)`, COL2_X, yRight)
  doc.text(`$${toDollars(input.subtotalCents)}`, PAGE_W - MARGIN, yRight, { align: "right" })
  yRight += lineH

  if ((input.cleaningFeeCents ?? 0) > 0) {
    doc.text("Cleaning fee", COL2_X, yRight)
    doc.text(`$${toDollars(input.cleaningFeeCents!)}`, PAGE_W - MARGIN, yRight, { align: "right" })
    yRight += lineH
  }

  doc.text("Service fee", COL2_X, yRight)
  doc.text(`$${toDollars(input.serviceFeeCents)}`, PAGE_W - MARGIN, yRight, { align: "right" })
  yRight += lineH

  if ((input.discountCents ?? 0) > 0) {
    doc.text("Discount", COL2_X, yRight)
    doc.setTextColor(0, 128, 0)
    doc.text(`-$${toDollars(input.discountCents!)}`, PAGE_W - MARGIN, yRight, { align: "right" })
    doc.setTextColor(0, 0, 0)
    yRight += lineH
  }

  if ((input.taxesCents ?? 0) > 0) {
    doc.text(input.taxLabel ?? "Taxes", COL2_X, yRight)
    doc.text(`$${toDollars(input.taxesCents!)}`, PAGE_W - MARGIN, yRight, { align: "right" })
    yRight += lineH
  }

  yRight += 6
  doc.setDrawColor(220, 220, 220)
  doc.line(COL2_X, yRight, PAGE_W - MARGIN, yRight)
  yRight += 10
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("Total Paid", COL2_X, yRight)
  doc.setTextColor(TOTAL_GREEN[0], TOTAL_GREEN[1], TOTAL_GREEN[2])
  doc.text(`$${toDollars(input.totalCents)}`, PAGE_W - MARGIN, yRight, { align: "right" })
  doc.setTextColor(0, 0, 0)
  doc.setFont("helvetica", "normal")

  const filename = `${input.confirmationNumber.toUpperCase()}.pdf`
  return { doc, filename }
}

/**
 * Generates the confirmation PDF and triggers a browser download.
 * Filename is the confirmation number in uppercase (e.g. CAMP-2026-D2S2WM.pdf).
 */
export function downloadConfirmationPdf(input: ConfirmationPdfInput): void {
  const { doc, filename } = generateConfirmationPdf(input)
  doc.save(filename)
}

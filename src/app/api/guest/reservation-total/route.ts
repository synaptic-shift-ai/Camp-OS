import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * GET /api/guest/reservation-total?reservation_id=xxx
 *
 * Returns the server-side total_amount for a reservation so the
 * confirmation page can display "Total Paid" accurately instead of
 * relying on client-side priceBreakdown.total (which may drift from
 * the persisted value due to rounding or promo adjustments).
 */
export async function GET(request: NextRequest) {
  const reservationId = request.nextUrl.searchParams.get("reservation_id")

  if (!reservationId) {
    return NextResponse.json(
      { error: "Missing reservation_id" },
      { status: 400 },
    )
  }

  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from("reservations")
    .select("id, total_amount")
    .eq("id", reservationId)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "Reservation not found" },
      { status: 404 },
    )
  }

  return NextResponse.json({
    total_amount_cents: data.total_amount,
  })
}

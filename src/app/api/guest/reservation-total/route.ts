import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

/**
 * GET /api/guest/reservation-total?reservation_id=xxx
 *
 * Returns server-side total_amount and paid_amount for a reservation so the
 * confirmation page can display payment amounts accurately instead of
 * relying on client-side priceBreakdown (which may drift or miss deposits).
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
    .select("id, total_amount, paid_amount, payment_status")
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
    paid_amount_cents: data.paid_amount ?? 0,
    payment_status: data.payment_status,
  })
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    const supabase = await createClient()

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const {
      check_in_date,
      check_out_date,
      num_adults,
      num_children,
      num_pets,
      special_requests,
    } = body

    // Validate required fields
    if (!check_in_date || !check_out_date || num_adults === undefined) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Validate dates
    const checkIn = new Date(check_in_date)
    const checkOut = new Date(check_out_date)

    if (checkOut <= checkIn) {
      return NextResponse.json(
        { error: "Check-out date must be after check-in date" },
        { status: 400 }
      )
    }

    if (num_adults < 1) {
      return NextResponse.json(
        { error: "At least one adult is required" },
        { status: 400 }
      )
    }

    // Fetch the reservation to verify ownership
    const { data: reservation, error: fetchError } = await supabase
      .from("reservations")
      .select("*, sites(property_id)")
      .eq("id", reservationId)
      .single()

    if (fetchError || !reservation) {
      return NextResponse.json(
        { error: "Reservation not found" },
        { status: 404 }
      )
    }

    // Verify the user owns this property
    const { data: property, error: propertyError } = await supabase
      .from("properties")
      .select("id")
      .eq("id", reservation.sites.property_id)
      .eq("owner_id", user.id)
      .single()

    if (propertyError || !property) {
      return NextResponse.json(
        { error: "You don't have permission to edit this reservation" },
        { status: 403 }
      )
    }

    // Calculate new number of nights
    const diffTime = checkOut.getTime() - checkIn.getTime()
    const numNights = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    // Update the reservation
    const { data: updatedReservation, error: updateError } = await supabase
      .from("reservations")
      .update({
        check_in_date: check_in_date,
        check_out_date: check_out_date,
        num_nights: numNights,
        num_adults: num_adults,
        num_children: num_children || 0,
        num_pets: num_pets || 0,
        special_requests: special_requests || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservationId)
      .select()
      .single()

    if (updateError) {
      console.error("Update reservation error:", updateError)
      return NextResponse.json(
        { error: "Failed to update reservation" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      reservation: updatedReservation,
    })
  } catch (error) {
    console.error("Reservation update error:", error)
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    )
  }
}

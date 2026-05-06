/**
 * Create PaymentIntent for staff-collected manual payments (on-session).
 *
 * POST /api/v1/financial/reservations/[id]/payment-intent
 *
 * Returns a Stripe client_secret for rendering PaymentElement.
 */

import { type NextRequest } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { error, success } from "@/lib/api/response"
import { ErrorCodes } from "@/lib/api/errors"
import { requirePropertyAccess, isDenied } from "@/lib/rbac"
import { resolvePaymentProcessor } from "@/lib/config/resolution"
import { getProcessor } from "@/modules/Financial/infrastructure/ProcessorFactory"
import type { IPaymentProcessor } from "@/modules/Financial/infrastructure/IPaymentProcessor"

const BodySchema = z.object({
  amount_cents: z.number().int().positive(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reservationId } = await params
    const body = BodySchema.safeParse(await request.json().catch(() => null))
    if (!body.success) {
      return error(ErrorCodes.VALIDATION_ERROR, "Invalid request body", {
        details: body.error.format(),
      })
    }

    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return error(ErrorCodes.AUTH_001, "Unauthorized")
    }

    const { data: reservation, error: reservationError } = await supabase
      .from("reservations")
      .select("id, property_id, guest_id, confirmation_number")
      .eq("id", reservationId)
      .single()

    if (reservationError || !reservation) {
      return error(ErrorCodes.RESOURCE_NOT_FOUND, "Reservation not found")
    }

    if (!reservation.guest_id) {
      return error(
        ErrorCodes.VALIDATION_ERROR,
        "Reservation is missing guest information required for card payments"
      )
    }

    const { data: guest, error: guestError } = await supabase
      .from("guests")
      .select("id, email")
      .eq("id", reservation.guest_id)
      .eq("property_id", reservation.property_id)
      .single()

    if (guestError || !guest?.email) {
      return error(
        ErrorCodes.RESOURCE_NOT_FOUND,
        "Guest not found for this reservation"
      )
    }

    const access = await requirePropertyAccess(supabase, user.id, {
      propertyId: reservation.property_id,
      minimumRole: "staff",
      permission: "financial.record_payment",
    })
    if (isDenied(access)) return access

    const { data: property } = await supabase
      .from("properties")
      .select("payment_processor, stripe_account_id")
      .eq("id", reservation.property_id)
      .single()

    const processorType = resolvePaymentProcessor(property?.payment_processor)
    if (processorType !== "stripe") {
      return error(ErrorCodes.VALIDATION_ERROR, "Stripe processor is not configured for this property")
    }

    let processor: IPaymentProcessor
    try {
      processor = getProcessor(processorType, property?.stripe_account_id ?? undefined)
    } catch (procErr: unknown) {
      const msg = procErr instanceof Error ? procErr.message : "Payment processor not configured"
      return error(ErrorCodes.VALIDATION_ERROR, msg)
    }

    const intent = await processor.createPaymentIntent({
      amountCents: body.data.amount_cents,
      currency: "usd",
      automaticPaymentMethods: false,
      paymentMethodTypes: ["card"],
      onBehalfOf: property?.stripe_account_id ?? undefined,
      transferDestination: property?.stripe_account_id ?? undefined,
      metadata: {
        reservation_id: reservation.id,
        property_id: reservation.property_id,
        guest_id: reservation.guest_id,
        guest_email: guest.email,
        source: "manual_payment",
        confirmation_number: reservation.confirmation_number,
      },
      description: `Manual payment for reservation ${reservation.confirmation_number}`,
    })

    return success({
      client_secret: intent.clientSecret,
      payment_intent_id: intent.paymentIntentId,
    })
  } catch (err: unknown) {
    console.error("[Manual PaymentIntent] Error:", err)
    const message = err instanceof Error ? err.message : "Failed to create payment intent"
    return error(ErrorCodes.INTERNAL_ERROR, "Failed to create payment intent", { message })
  }
}


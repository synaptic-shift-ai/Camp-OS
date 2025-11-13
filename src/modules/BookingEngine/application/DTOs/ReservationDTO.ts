/**
 * ReservationDTO
 *
 * Data Transfer Object for Reservation API responses.
 * Converts domain Reservation entity to API-friendly format.
 */
import type { Reservation } from '../../domain/Reservation'
import type { ReservationResponse } from '@/types/api/v1/schemas/reservations'

/**
 * Convert Reservation domain entity to DTO for API response
 */
export function toReservationDTO(reservation: Reservation): ReservationResponse {
  const balance = reservation.calculateBalance()
  const persistence = reservation.toPersistence()

  return {
    id: reservation.id,
    propertyId: reservation.propertyId,
    siteId: reservation.siteId,
    guestId: reservation.guestId,
    confirmationNumber: reservation.confirmationNumber.value,
    checkInDate: reservation.checkInDate.toISOString(),
    checkOutDate: reservation.checkOutDate.toISOString(),
    nights: reservation.nights,
    occupancy: {
      numAdults: reservation.occupancy.numAdults,
      numChildren: reservation.occupancy.numChildren,
      numPets: reservation.occupancy.numPets,
      numVehicles: reservation.occupancy.numVehicles,
      totalPeople: reservation.occupancy.totalPeople,
    },
    totalAmountCents: reservation.totalAmount.amountInCents,
    totalAmountDollars: reservation.totalAmount.dollars,
    paidAmountCents: reservation.paidAmount.amountInCents,
    paidAmountDollars: reservation.paidAmount.dollars,
    balanceCents: balance.amountInCents,
    balanceDollars: balance.dollars,
    status: reservation.status,
    paymentStatus: reservation.paymentStatus,
    specialRequests: reservation.specialRequests,
    notes: reservation.notes,
    source: reservation.source,
    checkedInAt: persistence.checked_in_at ? new Date(persistence.checked_in_at).toISOString() : null,
    checkedInBy: persistence.checked_in_by || null,
    checkInNotes: persistence.check_in_notes || null,
    checkedOutAt: persistence.checked_out_at ? new Date(persistence.checked_out_at).toISOString() : null,
    checkedOutBy: persistence.checked_out_by || null,
    hasDamages: persistence.has_damages,
    checkOutNotes: persistence.check_out_notes || null,
    cancelledAt: reservation.cancelledAt?.toISOString() || null,
    cancellationReason: persistence.cancellation_reason || null,
    refundAmountCents: persistence.refund_amount_cents || null,
    refundAmountDollars: persistence.refund_amount_cents ? persistence.refund_amount_cents / 100 : null,
    createdAt: reservation.createdAt.toISOString(),
    updatedAt: new Date(persistence.updated_at).toISOString(),
  }
}

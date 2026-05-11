/**
 * CreateManualReservationCommand
 *
 * Command to create a manual reservation (phone/walk-in booking) with
 * extended family and vehicle information.
 *
 * Handles:
 * - Core reservation creation
 * - Guest creation/lookup
 * - Spouse/partner information (stored on guest)
 * - Children information (stored per reservation)
 * - Vehicle information (stored on guest, linked to reservation)
 * - Evacuation contact (stored on reservation)
 * - Payment recording
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { createGuest, updateGuestSpouse, updateGuest, getGuestByIdAndProperty } from '@/lib/booking/guest'
import { createReservationChildren } from '@/lib/booking/children'
import { createReservationPets } from '@/lib/booking/pets'
import { createGuestVehicles, linkVehiclesToReservation } from '@/lib/booking/vehicles'
import { checkSiteAvailability } from '@/lib/booking/availability'
import { generateConfirmationNumber } from '@/lib/booking/api'
import type { CreatePetInputData, CreateVehicleInputData } from '@/lib/booking/types'
import type {
  CreateManualReservationRequest,
  ChildInput,
  PetInput,
  VehicleInput,
} from '@/types/api/v1/schemas/reservations'

export type CreateManualReservationDto = CreateManualReservationRequest & {
  propertyId: string
}

export type ManualPaymentLedgerInsertInput = {
  propertyId: string
  reservationId: string
  amountCents: number
  paymentMethod: string
  createdBy: string
}

export function buildManualPaymentLedgerInsert({
  propertyId,
  reservationId,
  amountCents,
  paymentMethod,
  createdBy,
}: ManualPaymentLedgerInsertInput) {
  return {
    property_id: propertyId,
    reservation_id: reservationId,
    type: 'payment',
    amount_cents: amountCents,
    currency: 'usd',
    payment_method: paymentMethod,
    status: 'completed',
    processed_at: new Date().toISOString(),
    notes: `Manual payment - ${paymentMethod}`,
    source: 'manual',
    is_voided: false,
    created_by: createdBy,
  }
}

export type ManualReservationResult = {
  id: string
  confirmationNumber: string
  guestId: string
  guestName: string
  checkInDate: string
  checkOutDate: string
  totalAmountCents: number
  paidAmountCents: number
  status: string
  paymentStatus: string
  childrenCount: number
  vehiclesCount: number
  createdAt: string
}

export class CreateManualReservationCommandHandler {
  async execute(dto: CreateManualReservationDto & { createdBy: string }): Promise<ManualReservationResult> {
    const supabase = createServiceRoleClient()

    // 1. Link to existing guest or create a new one
    let guestId: string

    if (dto.guestId) {
      // Link to existing guest — verify property scope
      const existingGuest = await getGuestByIdAndProperty(dto.guestId, dto.propertyId)
      if (!existingGuest) {
        throw new Error('Guest not found or does not belong to this property')
      }
      guestId = dto.guestId

      // Always overwrite guest fields when guestId is provided alongside guest data
      if (dto.guest) {
        const guestUpdates: Parameters<typeof updateGuest>[1] = {
          firstName: dto.guest.firstName,
          lastName: dto.guest.lastName,
          email: dto.guest.email,
          phone: dto.guest.phone,
        }
        if (dto.guest.address !== undefined) guestUpdates.address = dto.guest.address
        if (dto.guest.city !== undefined) guestUpdates.city = dto.guest.city
        if (dto.guest.state !== undefined) guestUpdates.state = dto.guest.state
        if (dto.guest.zipCode !== undefined) guestUpdates.zipCode = dto.guest.zipCode

        await updateGuest(guestId, guestUpdates)
      }
    } else {
      // Create new guest (existing behavior)
      const guestInput: Parameters<typeof createGuest>[1] = {
        first_name: dto.guest!.firstName,
        last_name: dto.guest!.lastName,
        email: dto.guest!.email,
        phone: dto.guest!.phone,
      }
      if (dto.guest!.address) guestInput.address = dto.guest!.address
      if (dto.guest!.city) guestInput.city = dto.guest!.city
      if (dto.guest!.state) guestInput.state = dto.guest!.state
      if (dto.guest!.zipCode) guestInput.zip_code = dto.guest!.zipCode

      const guestResult = await createGuest(dto.propertyId, guestInput)
      if (!guestResult.success) {
        throw new Error(guestResult.error.message)
      }
      guestId = guestResult.data.id
    }

    // 2. Check site availability (guard against double-booking)
    const availabilityResult = await checkSiteAvailability(
      dto.siteId,
      dto.checkInDate,
      dto.checkOutDate
    )
    if (!availabilityResult.success) {
      throw new Error(availabilityResult.error.message)
    }
    if (!availabilityResult.data) {
      throw new Error('Site is not available for the selected dates')
    }

    // 2a. Insert reservation directly using the already-created guest ID.
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        property_id: dto.propertyId,
        site_id: dto.siteId,
        guest_id: guestId,
        confirmation_number: generateConfirmationNumber(),
        check_in_date: dto.checkInDate,
        check_out_date: dto.checkOutDate,
        num_adults: dto.numAdults,
        num_children: dto.numChildren || 0,
        num_pets: dto.numPets || 0,
        num_vehicles: dto.numVehicles || 0,
        total_amount: 0,
        paid_amount: 0,
        status: 'pending',
        payment_status: 'pending',
        source: 'phone',
        booking_type: dto.stayType || 'nightly',
        special_requests: dto.specialRequests || null,
        notes: null,
      })
      .select('*')
      .single()

    if (reservationError || !reservation) {
      const detail = reservationError
        ? `${reservationError.message} (code: ${reservationError.code})`
        : 'Unknown error'
      throw new Error(`Failed to create reservation: ${detail}`)
    }

    // 2b. Apply client-provided total when present (fixes $0 when site.base_price is unset)
    if (dto.totalAmountCents != null && dto.totalAmountCents > 0) {
      await supabase
        .from('reservations')
        .update({ total_amount: dto.totalAmountCents })
        .eq('id', reservation.id)
        .eq('property_id', dto.propertyId)
      reservation.total_amount = dto.totalAmountCents
    }

    // 3. Handle spouse/partner information (stored on guest)
    if (dto.spousePartner) {
      // Build spouse input conditionally (exactOptionalPropertyTypes)
      const spouseDbInput: Parameters<typeof updateGuestSpouse>[2] = {
        first_name: dto.spousePartner.firstName,
        last_name: dto.spousePartner.lastName,
        is_alternate_contact: dto.spousePartner.isAlternateContact,
      }
      if (dto.spousePartner.phone) spouseDbInput.phone = dto.spousePartner.phone
      if (dto.spousePartner.email) spouseDbInput.email = dto.spousePartner.email

      await updateGuestSpouse(guestId, dto.propertyId, spouseDbInput)
    }

    // 4. Handle children information (per reservation)
    let childrenCount = 0
    if (dto.children && dto.children.length > 0) {
      // Build children input conditionally (exactOptionalPropertyTypes)
      const childrenInput = dto.children.map((child: ChildInput) => {
        const childData: { first_name: string; age?: number; date_of_birth?: string; special_needs_allergies?: string } = {
          first_name: child.firstName,
        }
        if (child.age != null) childData.age = child.age
        if (child.dateOfBirth) childData.date_of_birth = child.dateOfBirth
        if (child.specialNeedsAllergies) childData.special_needs_allergies = child.specialNeedsAllergies
        return childData
      })
      await createReservationChildren(reservation.id, dto.propertyId, childrenInput)
      childrenCount = dto.children.length
    }

    // 5. Handle pets information (per reservation)
    if (dto.pets && dto.pets.length > 0) {
      const petsInput: CreatePetInputData[] = dto.pets.map((pet: PetInput) => {
        const petData: CreatePetInputData = {
          name: pet.name,
          type: pet.type,
        }
        if (pet.breed) petData.breed = pet.breed
        if (pet.weightLbs != null) petData.weight_lbs = pet.weightLbs
        if (pet.notes) petData.notes = pet.notes
        return petData
      })

      await createReservationPets(reservation.id, dto.propertyId, petsInput)
    }

    // 6. Handle vehicle information (on guest, linked to reservation)
    let vehiclesCount = 0
    if (dto.vehicles && dto.vehicles.length > 0) {
      // Build vehicle input conditionally (exactOptionalPropertyTypes)
      const vehicleInput: CreateVehicleInputData[] = dto.vehicles.map((v: VehicleInput) => {
        const vData: CreateVehicleInputData = {
          vehicle_type: v.vehicleType,
        }
        if (v.isPrimary != null) vData.is_primary = v.isPrimary
        if (v.make) vData.make = v.make
        if (v.model) vData.model = v.model
        if (v.year != null) vData.year = v.year
        if (v.color) vData.color = v.color
        if (v.licensePlate) vData.license_plate = v.licensePlate
        if (v.licensePlateState) vData.license_plate_state = v.licensePlateState
        if (v.personalVehicleType) vData.personal_vehicle_type = v.personalVehicleType
        if (v.rvType) vData.rv_type = v.rvType
        if (v.rvLengthFeet != null) vData.rv_length_feet = v.rvLengthFeet
        if (v.rvWidthFeet != null) vData.rv_width_feet = v.rvWidthFeet
        if (v.numSlideOuts != null) vData.num_slide_outs = v.numSlideOuts
        if (v.insuranceCompany) vData.insurance_company = v.insuranceCompany
        if (v.insurancePolicyNumber) vData.insurance_policy_number = v.insurancePolicyNumber
        return vData
      })

      const vehicleResult = await createGuestVehicles(guestId, dto.propertyId, vehicleInput)
      if (vehicleResult.success && vehicleResult.data.length > 0) {
        const vehicleIds = vehicleResult.data.map((v) => v.id)
        await linkVehiclesToReservation(reservation.id, vehicleIds)
        vehiclesCount = vehicleResult.data.length
      }
    }

    // 7. Handle evacuation contact (on reservation)
    if (dto.evacuationContact) {
      await supabase
        .from('reservations')
        .update({
          evacuation_contact_name: dto.evacuationContact.name,
          evacuation_contact_phone: dto.evacuationContact.phone,
          evacuation_contact_relationship: dto.evacuationContact.relationship || null,
        })
        .eq('id', reservation.id)
        .eq('property_id', dto.propertyId)
    }

    // 8. Handle payment
    const paidAmountCents = dto.paidAmountCents || 0
    const totalAmountCents = dto.totalAmountCents ?? reservation.total_amount

    const resolvedPaymentMethod =
      dto.paymentMethod ??
      (dto.paymentMode === 'card' ? 'credit_card' : dto.paymentMode === 'send_link' ? 'stripe' : dto.paymentMode)

    const isFullyPaid = paidAmountCents >= totalAmountCents
    const paymentStatus = paidAmountCents > 0
      ? (isFullyPaid ? 'paid' : 'partial')
      : 'pending'

    const reservationStatus = isFullyPaid ? 'confirmed' : 'pending'

    if (paidAmountCents > 0) {
      // Update reservation payment status
      await supabase
        .from('reservations')
        .update({
          status: reservationStatus,
          payment_status: paymentStatus,
          paid_amount: paidAmountCents,
          notes: dto.notes || `Manual booking. Payment method: ${resolvedPaymentMethod}`,
        })
        .eq('id', reservation.id)
        .eq('property_id', dto.propertyId)

      // Create payment record (legacy)
      await supabase
        .from('payments')
        .insert({
          property_id: dto.propertyId,
          reservation_id: reservation.id,
          amount: paidAmountCents,
          payment_method: resolvedPaymentMethod,
          payment_status: 'completed',
          processed_at: new Date().toISOString(),
          notes: `Manual payment - ${resolvedPaymentMethod}`,
        })

      // Dual-write to unified financial ledger (best-effort)
      try {
        const insert = buildManualPaymentLedgerInsert({
          propertyId: dto.propertyId,
          reservationId: reservation.id,
          amountCents: paidAmountCents,
          paymentMethod: resolvedPaymentMethod,
          createdBy: dto.createdBy,
        })

        await supabase.from('financial_transactions').insert(insert)
      } catch (dualWriteErr) {
        console.error('[CreateManualReservation] financial_transactions dual-write failed (non-blocking):', dualWriteErr)
      }
    } else {
      // Unpaid: keep status pending
      await supabase
        .from('reservations')
        .update({
          status: 'pending',
          payment_status: 'pending',
          notes: dto.notes || `Manual booking. Payment method: ${dto.paymentMode} (payment pending)`,
        })
        .eq('id', reservation.id)
        .eq('property_id', dto.propertyId)
    }

    // 9. (reserved — event publishing removed)
    // No-op: domain events are cleared by direct pipeline triggers elsewhere

    return {
      id: reservation.id,
      confirmationNumber: reservation.confirmation_number,
      guestId: guestId,
      guestName: dto.guest
        ? `${dto.guest.firstName} ${dto.guest.lastName}`
        : 'Existing guest',
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      totalAmountCents: reservation.total_amount,
      paidAmountCents,
      status: reservationStatus,
      paymentStatus,
      childrenCount,
      vehiclesCount,
      createdAt: new Date().toISOString(),
    }
  }
}

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
import { createOrGetGuest, updateGuestSpouse } from '@/lib/booking/guest'
import { createReservationChildren } from '@/lib/booking/children'
import { createGuestVehicles, linkVehiclesToReservation } from '@/lib/booking/vehicles'
import { createReservation } from '@/lib/booking/reservation'
import type { CreateVehicleInputData } from '@/lib/booking/types'
import type {
  CreateManualReservationRequest,
  ChildInput,
  VehicleInput,
} from '@/types/api/v1/schemas/reservations'

export type CreateManualReservationDto = CreateManualReservationRequest & {
  propertyId: string
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
  async execute(dto: CreateManualReservationDto): Promise<ManualReservationResult> {
    const supabase = createServiceRoleClient()

    // 1. Create or get guest
    // Build guest input conditionally to avoid undefined values (exactOptionalPropertyTypes)
    const guestInput: Parameters<typeof createOrGetGuest>[1] = {
      first_name: dto.guest.firstName,
      last_name: dto.guest.lastName,
      email: dto.guest.email,
      phone: dto.guest.phone,
    }
    if (dto.guest.address) guestInput.address = dto.guest.address
    if (dto.guest.city) guestInput.city = dto.guest.city
    if (dto.guest.state) guestInput.state = dto.guest.state
    if (dto.guest.zipCode) guestInput.zip_code = dto.guest.zipCode

    const guestResult = await createOrGetGuest(dto.propertyId, guestInput)
    if (!guestResult.success) {
      throw new Error(guestResult.error.message)
    }
    const guest = guestResult.data

    // 2. Create the reservation
    const reservationInput: any = {
      property_id: dto.propertyId,
      site_id: dto.siteId,
      check_in_date: dto.checkInDate,
      check_out_date: dto.checkOutDate,
      num_adults: dto.numAdults,
      guest: guestInput,
      source: 'phone',
    }

    if (dto.numChildren) reservationInput.num_children = dto.numChildren
    if (dto.numPets) reservationInput.num_pets = dto.numPets
    if (dto.numVehicles) reservationInput.num_vehicles = dto.numVehicles
    if (dto.specialRequests) reservationInput.special_requests = dto.specialRequests

    const reservationResult = await createReservation(reservationInput)
    if (!reservationResult.success) {
      throw new Error(reservationResult.error.message)
    }
    const reservation = reservationResult.data

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

      await updateGuestSpouse(guest.id, dto.propertyId, spouseDbInput)
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

    // 5. Handle vehicle information (on guest, linked to reservation)
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

      const vehicleResult = await createGuestVehicles(guest.id, dto.propertyId, vehicleInput)
      if (vehicleResult.success && vehicleResult.data.length > 0) {
        const vehicleIds = vehicleResult.data.map((v) => v.id)
        await linkVehiclesToReservation(reservation.id, vehicleIds)
        vehiclesCount = vehicleResult.data.length
      }
    }

    // 6. Handle evacuation contact (on reservation)
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

    // 7. Handle payment
    const paidAmountCents = dto.paidAmountCents || 0
    const paymentStatus = paidAmountCents > 0
      ? (paidAmountCents >= reservation.total_amount ? 'paid' : 'partial')
      : 'pending'

    if (paidAmountCents > 0) {
      // Update reservation payment status
      await supabase
        .from('reservations')
        .update({
          status: 'confirmed',
          payment_status: paymentStatus,
          paid_amount: paidAmountCents,
          notes: dto.notes || `Manual booking. Payment method: ${dto.paymentMethod}`,
        })
        .eq('id', reservation.id)
        .eq('property_id', dto.propertyId)

      // Create payment record
      await supabase
        .from('payments')
        .insert({
          property_id: dto.propertyId,
          reservation_id: reservation.id,
          amount: paidAmountCents,
          payment_method: dto.paymentMethod,
          payment_status: 'completed',
          processed_at: new Date().toISOString(),
          notes: `Manual payment - ${dto.paymentMethod}`,
        })
    } else {
      // Mark as confirmed but unpaid
      await supabase
        .from('reservations')
        .update({
          status: 'confirmed',
          payment_status: 'pending',
          notes: dto.notes || `Manual booking. Payment method: ${dto.paymentMode} (payment pending)`,
        })
        .eq('id', reservation.id)
        .eq('property_id', dto.propertyId)
    }

    return {
      id: reservation.id,
      confirmationNumber: reservation.confirmation_number,
      guestId: guest.id,
      guestName: `${dto.guest.firstName} ${dto.guest.lastName}`,
      checkInDate: dto.checkInDate,
      checkOutDate: dto.checkOutDate,
      totalAmountCents: reservation.total_amount,
      paidAmountCents,
      status: 'confirmed',
      paymentStatus,
      childrenCount,
      vehiclesCount,
      createdAt: new Date().toISOString(),
    }
  }
}

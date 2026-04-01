/**
 * Pets Management Functions
 *
 * Handles reservation pets CRUD operations.
 * Pets are stored per-reservation since pet details may vary per trip.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { BookingResult, CreatePetInputData } from './types'
import type { ReservationPet } from './vehicle-types'

/**
 * Create pet records for a reservation
 *
 * @param reservation_id - Reservation ID to associate pets with
 * @param property_id - Property ID for multi-tenant isolation
 * @param pets - Array of pet information
 * @returns Created pet records
 */
export async function createReservationPets(
  reservation_id: string,
  property_id: string,
  pets: CreatePetInputData[]
): Promise<BookingResult<ReservationPet[]>> {
  if (pets.length === 0) {
    return { success: true, data: [] }
  }

  const supabase = createServiceRoleClient()

  const petRecords = pets.map((pet) => ({
    reservation_id,
    property_id,
    name: pet.name,
    type: pet.type,
    breed: pet.breed || null,
    weight_lbs: pet.weight_lbs ?? null,
    notes: pet.notes || null,
  }))

  const { data, error } = await supabase
    .from('reservation_pets')
    .insert(petRecords)
    .select()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create pets records',
      },
    }
  }

  return { success: true, data: data as ReservationPet[] }
}

/**
 * Delete all pets for a reservation
 *
 * @param reservation_id - Reservation ID
 * @returns Success or error
 */
export async function deleteAllReservationPets(
  reservation_id: string
): Promise<BookingResult<void>> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('reservation_pets')
    .delete()
    .eq('reservation_id', reservation_id)

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete pet records',
      },
    }
  }

  return { success: true, data: undefined }
}

/**
 * Replace all pets for a reservation
 * Deletes existing pets and creates new ones.
 *
 * @param reservation_id - Reservation ID
 * @param property_id - Property ID for multi-tenant isolation
 * @param pets - New array of pet information
 * @returns Created pet records
 */
export async function replaceReservationPets(
  reservation_id: string,
  property_id: string,
  pets: CreatePetInputData[]
): Promise<BookingResult<ReservationPet[]>> {
  const deleteResult = await deleteAllReservationPets(reservation_id)
  if (!deleteResult.success) {
    return deleteResult as BookingResult<ReservationPet[]>
  }

  return createReservationPets(reservation_id, property_id, pets)
}

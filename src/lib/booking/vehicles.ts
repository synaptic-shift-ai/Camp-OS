/**
 * Vehicle Management Functions
 *
 * Handles guest vehicle CRUD operations.
 * Vehicles are stored at guest level for reuse across reservations.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { BookingResult, CreateVehicleInputData } from './types'
import type { GuestVehicle, ReservationVehicle } from './vehicle-types'

/**
 * Create a new vehicle for a guest
 *
 * @param guest_id - Guest ID to associate vehicle with
 * @param property_id - Property ID for multi-tenant isolation
 * @param input - Vehicle information
 * @returns Created vehicle record
 */
export async function createGuestVehicle(
  guest_id: string,
  property_id: string,
  input: CreateVehicleInputData
): Promise<BookingResult<GuestVehicle>> {
  const supabase = createServiceRoleClient()

  // Validate RV vehicles have required fields
  if (input.vehicle_type === 'rv') {
    if (!input.rv_type || !input.rv_length_feet) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'RV type and length are required for RV/camper vehicles',
        },
      }
    }
  }

  const vehicleRecord = {
    guest_id,
    property_id,
    vehicle_type: input.vehicle_type,
    make: input.make || null,
    model: input.model || null,
    year: input.year || null,
    color: input.color || null,
    license_plate: input.license_plate || null,
    license_plate_state: input.license_plate_state || null,
    personal_vehicle_type: input.personal_vehicle_type || null,
    rv_type: input.rv_type || null,
    rv_length_feet: input.rv_length_feet || null,
    rv_width_feet: input.rv_width_feet || null,
    num_slide_outs: input.num_slide_outs ?? 0,
    insurance_company: input.insurance_company || null,
    insurance_policy_number: input.insurance_policy_number || null,
    is_primary: input.is_primary ?? false,
  }

  const { data, error } = await supabase
    .from('guest_vehicles')
    .insert(vehicleRecord)
    .select()
    .single()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create vehicle record',
      },
    }
  }

  return { success: true, data: data as GuestVehicle }
}

/**
 * Create multiple vehicles for a guest
 *
 * @param guest_id - Guest ID to associate vehicles with
 * @param property_id - Property ID for multi-tenant isolation
 * @param vehicles - Array of vehicle information
 * @returns Created vehicle records
 */
export async function createGuestVehicles(
  guest_id: string,
  property_id: string,
  vehicles: CreateVehicleInputData[]
): Promise<BookingResult<GuestVehicle[]>> {
  if (vehicles.length === 0) {
    return { success: true, data: [] }
  }

  const supabase = createServiceRoleClient()

  // Validate all RV vehicles
  for (const vehicle of vehicles) {
    if (vehicle.vehicle_type === 'rv') {
      if (!vehicle.rv_type || !vehicle.rv_length_feet) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'RV type and length are required for RV/camper vehicles',
          },
        }
      }
    }
  }

  const vehicleRecords = vehicles.map((input) => ({
    guest_id,
    property_id,
    vehicle_type: input.vehicle_type,
    make: input.make || null,
    model: input.model || null,
    year: input.year || null,
    color: input.color || null,
    license_plate: input.license_plate || null,
    license_plate_state: input.license_plate_state || null,
    personal_vehicle_type: input.personal_vehicle_type || null,
    rv_type: input.rv_type || null,
    rv_length_feet: input.rv_length_feet || null,
    rv_width_feet: input.rv_width_feet || null,
    num_slide_outs: input.num_slide_outs ?? 0,
    insurance_company: input.insurance_company || null,
    insurance_policy_number: input.insurance_policy_number || null,
    is_primary: input.is_primary ?? false,
  }))

  const { data, error } = await supabase
    .from('guest_vehicles')
    .insert(vehicleRecords)
    .select()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create vehicle records',
      },
    }
  }

  return { success: true, data: data as GuestVehicle[] }
}

/**
 * Get all vehicles for a guest
 *
 * @param guest_id - Guest ID
 * @param property_id - Property ID for tenant isolation
 * @returns Array of guest vehicles
 */
export async function getGuestVehicles(
  guest_id: string,
  property_id: string
): Promise<BookingResult<GuestVehicle[]>> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('guest_vehicles')
    .select('*')
    .eq('guest_id', guest_id)
    .eq('property_id', property_id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch vehicles',
      },
    }
  }

  return { success: true, data: (data || []) as GuestVehicle[] }
}

/**
 * Get a single vehicle by ID
 *
 * @param vehicle_id - Vehicle ID
 * @returns Vehicle record or error
 */
export async function getVehicleById(
  vehicle_id: string
): Promise<BookingResult<GuestVehicle>> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('guest_vehicles')
    .select('*')
    .eq('id', vehicle_id)
    .single()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'VEHICLE_NOT_FOUND',
        message: 'Vehicle not found',
      },
    }
  }

  return { success: true, data: data as GuestVehicle }
}

/**
 * Update a guest vehicle
 *
 * @param vehicle_id - Vehicle ID to update
 * @param updates - Fields to update
 * @returns Updated vehicle record
 */
export async function updateGuestVehicle(
  vehicle_id: string,
  updates: Partial<CreateVehicleInputData>
): Promise<BookingResult<GuestVehicle>> {
  const supabase = createServiceRoleClient()

  // Build update object, only including provided fields
  const updateData: Record<string, unknown> = {}

  if (updates.vehicle_type !== undefined) updateData.vehicle_type = updates.vehicle_type
  if (updates.make !== undefined) updateData.make = updates.make || null
  if (updates.model !== undefined) updateData.model = updates.model || null
  if (updates.year !== undefined) updateData.year = updates.year || null
  if (updates.color !== undefined) updateData.color = updates.color || null
  if (updates.license_plate !== undefined) updateData.license_plate = updates.license_plate || null
  if (updates.license_plate_state !== undefined) updateData.license_plate_state = updates.license_plate_state || null
  if (updates.personal_vehicle_type !== undefined) updateData.personal_vehicle_type = updates.personal_vehicle_type || null
  if (updates.rv_type !== undefined) updateData.rv_type = updates.rv_type || null
  if (updates.rv_length_feet !== undefined) updateData.rv_length_feet = updates.rv_length_feet || null
  if (updates.rv_width_feet !== undefined) updateData.rv_width_feet = updates.rv_width_feet || null
  if (updates.num_slide_outs !== undefined) updateData.num_slide_outs = updates.num_slide_outs ?? 0
  if (updates.insurance_company !== undefined) updateData.insurance_company = updates.insurance_company || null
  if (updates.insurance_policy_number !== undefined) updateData.insurance_policy_number = updates.insurance_policy_number || null
  if (updates.is_primary !== undefined) updateData.is_primary = updates.is_primary

  const { data, error } = await supabase
    .from('guest_vehicles')
    .update(updateData)
    .eq('id', vehicle_id)
    .select()
    .single()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update vehicle',
      },
    }
  }

  return { success: true, data: data as GuestVehicle }
}

/**
 * Delete a guest vehicle
 *
 * @param vehicle_id - Vehicle ID to delete
 * @returns Success or error
 */
export async function deleteGuestVehicle(
  vehicle_id: string
): Promise<BookingResult<void>> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('guest_vehicles')
    .delete()
    .eq('id', vehicle_id)

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete vehicle',
      },
    }
  }

  return { success: true, data: undefined }
}

/**
 * Link vehicles to a reservation
 *
 * @param reservation_id - Reservation ID
 * @param vehicle_ids - Array of vehicle IDs to link
 * @returns Created link records
 */
export async function linkVehiclesToReservation(
  reservation_id: string,
  vehicle_ids: string[]
): Promise<BookingResult<ReservationVehicle[]>> {
  if (vehicle_ids.length === 0) {
    return { success: true, data: [] }
  }

  const supabase = createServiceRoleClient()

  const linkRecords = vehicle_ids.map((vehicle_id) => ({
    reservation_id,
    guest_vehicle_id: vehicle_id,
  }))

  const { data, error } = await supabase
    .from('reservation_vehicles')
    .insert(linkRecords)
    .select()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to link vehicles to reservation',
      },
    }
  }

  return { success: true, data: data as ReservationVehicle[] }
}

/**
 * Get vehicles linked to a reservation
 *
 * @param reservation_id - Reservation ID
 * @returns Array of linked vehicles with full vehicle details
 */
export async function getReservationVehicles(
  reservation_id: string
): Promise<BookingResult<GuestVehicle[]>> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('reservation_vehicles')
    .select(`
      guest_vehicle_id,
      guest_vehicles (*)
    `)
    .eq('reservation_id', reservation_id)

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch reservation vehicles',
      },
    }
  }

  // Extract the vehicle details from the joined data
  // Supabase returns joined data - we need to handle the structure correctly
  const vehicles = (data || [])
    .map((link) => {
      // The joined data can be an object (single relation) or array
      const vehicleData = (link as unknown as { guest_vehicles: GuestVehicle | GuestVehicle[] | null }).guest_vehicles
      // Handle both single object and array cases
      if (Array.isArray(vehicleData)) {
        return vehicleData[0] || null
      }
      return vehicleData
    })
    .filter((v): v is GuestVehicle => v !== null)

  return { success: true, data: vehicles }
}

/**
 * Unlink a vehicle from a reservation
 *
 * @param reservation_id - Reservation ID
 * @param vehicle_id - Vehicle ID to unlink
 * @returns Success or error
 */
export async function unlinkVehicleFromReservation(
  reservation_id: string,
  vehicle_id: string
): Promise<BookingResult<void>> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('reservation_vehicles')
    .delete()
    .eq('reservation_id', reservation_id)
    .eq('guest_vehicle_id', vehicle_id)

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to unlink vehicle from reservation',
      },
    }
  }

  return { success: true, data: undefined }
}

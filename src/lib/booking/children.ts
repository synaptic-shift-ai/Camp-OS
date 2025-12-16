/**
 * Children Management Functions
 *
 * Handles reservation children CRUD operations.
 * Children are stored per-reservation since family composition may vary per trip.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { BookingResult, CreateChildInputData } from './types'
import type { ReservationChild } from './vehicle-types'

/**
 * Create children records for a reservation
 *
 * @param reservation_id - Reservation ID to associate children with
 * @param property_id - Property ID for multi-tenant isolation
 * @param children - Array of child information
 * @returns Created child records
 */
export async function createReservationChildren(
  reservation_id: string,
  property_id: string,
  children: CreateChildInputData[]
): Promise<BookingResult<ReservationChild[]>> {
  if (children.length === 0) {
    return { success: true, data: [] }
  }

  const supabase = createServiceRoleClient()

  // Validate all children have either age or date_of_birth
  for (const child of children) {
    if (child.age === undefined && !child.date_of_birth) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Either age or date of birth is required for child: ${child.first_name}`,
        },
      }
    }
  }

  const childRecords = children.map((child) => ({
    reservation_id,
    property_id,
    first_name: child.first_name,
    age: child.age ?? null,
    date_of_birth: child.date_of_birth || null,
    special_needs_allergies: child.special_needs_allergies || null,
  }))

  const { data, error } = await supabase
    .from('reservation_children')
    .insert(childRecords)
    .select()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create children records',
      },
    }
  }

  return { success: true, data: data as ReservationChild[] }
}

/**
 * Get all children for a reservation
 *
 * @param reservation_id - Reservation ID
 * @returns Array of children for the reservation
 */
export async function getReservationChildren(
  reservation_id: string
): Promise<BookingResult<ReservationChild[]>> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('reservation_children')
    .select('*')
    .eq('reservation_id', reservation_id)
    .order('created_at', { ascending: true })

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch children',
      },
    }
  }

  return { success: true, data: (data || []) as ReservationChild[] }
}

/**
 * Get a single child by ID
 *
 * @param child_id - Child record ID
 * @returns Child record or error
 */
export async function getChildById(
  child_id: string
): Promise<BookingResult<ReservationChild>> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('reservation_children')
    .select('*')
    .eq('id', child_id)
    .single()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'CHILD_NOT_FOUND',
        message: 'Child record not found',
      },
    }
  }

  return { success: true, data: data as ReservationChild }
}

/**
 * Update a child record
 *
 * @param child_id - Child record ID to update
 * @param updates - Fields to update
 * @returns Updated child record
 */
export async function updateReservationChild(
  child_id: string,
  updates: Partial<CreateChildInputData>
): Promise<BookingResult<ReservationChild>> {
  const supabase = createServiceRoleClient()

  // Build update object, only including provided fields
  const updateData: Record<string, unknown> = {}

  if (updates.first_name !== undefined) updateData.first_name = updates.first_name
  if (updates.age !== undefined) updateData.age = updates.age ?? null
  if (updates.date_of_birth !== undefined) updateData.date_of_birth = updates.date_of_birth || null
  if (updates.special_needs_allergies !== undefined) {
    updateData.special_needs_allergies = updates.special_needs_allergies || null
  }

  const { data, error } = await supabase
    .from('reservation_children')
    .update(updateData)
    .eq('id', child_id)
    .select()
    .single()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update child record',
      },
    }
  }

  return { success: true, data: data as ReservationChild }
}

/**
 * Delete a child record
 *
 * @param child_id - Child record ID to delete
 * @returns Success or error
 */
export async function deleteReservationChild(
  child_id: string
): Promise<BookingResult<void>> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('reservation_children')
    .delete()
    .eq('id', child_id)

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete child record',
      },
    }
  }

  return { success: true, data: undefined }
}

/**
 * Delete all children for a reservation
 *
 * @param reservation_id - Reservation ID
 * @returns Success or error
 */
export async function deleteAllReservationChildren(
  reservation_id: string
): Promise<BookingResult<void>> {
  const supabase = createServiceRoleClient()

  const { error } = await supabase
    .from('reservation_children')
    .delete()
    .eq('reservation_id', reservation_id)

  if (error) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete children records',
      },
    }
  }

  return { success: true, data: undefined }
}

/**
 * Replace all children for a reservation
 * Deletes existing children and creates new ones
 *
 * @param reservation_id - Reservation ID
 * @param property_id - Property ID for multi-tenant isolation
 * @param children - New array of child information
 * @returns Created child records
 */
export async function replaceReservationChildren(
  reservation_id: string,
  property_id: string,
  children: CreateChildInputData[]
): Promise<BookingResult<ReservationChild[]>> {
  // Delete existing children
  const deleteResult = await deleteAllReservationChildren(reservation_id)
  if (!deleteResult.success) {
    return deleteResult as BookingResult<ReservationChild[]>
  }

  // Create new children
  return createReservationChildren(reservation_id, property_id, children)
}

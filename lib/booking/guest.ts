/**
 * Guest Management Functions
 *
 * Handles guest creation and lookup for bookings.
 * Prevents duplicate guest records by email.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Guest, CreateGuestInput, BookingResult } from './types'

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate guest input
 */
function validateGuestInput(input: CreateGuestInput): BookingResult<void> {
  if (!input.first_name || !input.last_name || !input.email || !input.phone) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Missing required fields: first_name, last_name, email, phone',
      },
    }
  }

  if (!isValidEmail(input.email)) {
    return {
      success: false,
      error: {
        code: 'INVALID_EMAIL',
        message: 'Invalid email format',
        field: 'email',
      },
    }
  }

  return { success: true, data: undefined }
}

/**
 * Create a new guest or return existing guest if email already exists
 *
 * Strategy:
 * 1. Check if guest with email already exists for this property
 * 2. If exists, return existing guest (prevents duplicates)
 * 3. If not exists, create new guest record
 *
 * @param property_id - Property ID for multi-tenant isolation
 * @param input - Guest information
 * @returns Created or existing guest record
 */
export async function createOrGetGuest(
  property_id: string,
  input: CreateGuestInput
): Promise<BookingResult<Guest>> {
  const supabase = createServiceRoleClient()

  // Validate input
  const validation = validateGuestInput(input)
  if (!validation.success) {
    return validation as BookingResult<Guest>
  }

  // Check if guest already exists by email for this property
  const { data: existingGuest, error: lookupError } = await supabase
    .from('guests')
    .select('*')
    .eq('property_id', property_id)
    .eq('email', input.email.toLowerCase())
    .maybeSingle()

  if (lookupError) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Error checking for existing guest',
      },
    }
  }

  // Return existing guest if found
  if (existingGuest) {
    return {
      success: true,
      data: existingGuest as Guest,
    }
  }

  // Create new guest
  const newGuest = {
    property_id,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email.toLowerCase(),
    phone: input.phone,
    address: input.address || null,
    city: input.city || null,
    state: input.state || null,
    zip_code: input.zip_code || null,
    country: input.country || null,
    emergency_contact_name: input.emergency_contact_name || null,
    emergency_contact_phone: input.emergency_contact_phone || null,
  }

  const { data: createdGuest, error: createError } = await supabase
    .from('guests')
    .insert(newGuest)
    .select()
    .single()

  if (createError || !createdGuest) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create guest record',
      },
    }
  }

  return {
    success: true,
    data: createdGuest as Guest,
  }
}

/**
 * Get guest by ID
 *
 * @param guestId - Guest ID to fetch
 * @returns Guest record or error
 */
export async function getGuestById(guestId: string): Promise<BookingResult<Guest>> {
  const supabase = createServiceRoleClient()

  const { data: guest, error } = await supabase
    .from('guests')
    .select('*')
    .eq('id', guestId)
    .maybeSingle()

  if (error || !guest) {
    return {
      success: false,
      error: {
        code: 'GUEST_NOT_FOUND',
        message: 'Guest not found',
      },
    }
  }

  return {
    success: true,
    data: guest as Guest,
  }
}

/**
 * Get guest by email and property
 *
 * @param property_id - Property ID for tenant isolation
 * @param email - Guest email address
 * @returns Guest record or error
 */
export async function getGuestByEmail(
  property_id: string,
  email: string
): Promise<BookingResult<Guest>> {
  const supabase = createServiceRoleClient()

  const { data: guest, error } = await supabase
    .from('guests')
    .select('*')
    .eq('property_id', property_id)
    .eq('email', email.toLowerCase())
    .maybeSingle()

  if (error || !guest) {
    return {
      success: false,
      error: {
        code: 'GUEST_NOT_FOUND',
        message: 'Guest not found',
      },
    }
  }

  return {
    success: true,
    data: guest as Guest,
  }
}

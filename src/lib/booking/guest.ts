/**
 * Guest Management Functions
 *
 * Handles guest creation and lookup for bookings.
 * Prevents duplicate guest records by email.
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import type { Guest, CreateGuestInput, BookingResult, SpousePartnerInput } from './types'
import type { GuestWithSpouse } from './vehicle-types'

/**
 * Extended guest input with spouse information
 */
export interface CreateGuestWithSpouseInput extends CreateGuestInput {
  spouse_partner?: SpousePartnerInput
}

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

  // Create new guest (with optional spouse info)
  const inputWithSpouse = input as CreateGuestWithSpouseInput
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
    // Spouse fields
    spouse_first_name: inputWithSpouse.spouse_partner?.first_name || null,
    spouse_last_name: inputWithSpouse.spouse_partner?.last_name || null,
    spouse_phone: inputWithSpouse.spouse_partner?.phone || null,
    spouse_email: inputWithSpouse.spouse_partner?.email || null,
    spouse_is_alternate_contact: inputWithSpouse.spouse_partner?.is_alternate_contact || false,
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

/**
 * Update spouse/partner information for a guest
 *
 * @param guest_id - Guest ID to update
 * @param property_id - Property ID for tenant isolation
 * @param spouse - Spouse/partner information (null to clear)
 * @returns Updated guest record with spouse info
 */
export async function updateGuestSpouse(
  guest_id: string,
  property_id: string,
  spouse: SpousePartnerInput | null
): Promise<BookingResult<GuestWithSpouse>> {
  const supabase = createServiceRoleClient()

  const spouseData = spouse
    ? {
        spouse_first_name: spouse.first_name,
        spouse_last_name: spouse.last_name,
        spouse_phone: spouse.phone || null,
        spouse_email: spouse.email || null,
        spouse_is_alternate_contact: spouse.is_alternate_contact,
      }
    : {
        spouse_first_name: null,
        spouse_last_name: null,
        spouse_phone: null,
        spouse_email: null,
        spouse_is_alternate_contact: false,
      }

  const { data, error } = await supabase
    .from('guests')
    .update(spouseData)
    .eq('id', guest_id)
    .eq('property_id', property_id) // Tenant isolation
    .select()
    .single()

  if (error || !data) {
    return {
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update spouse information',
      },
    }
  }

  return {
    success: true,
    data: data as GuestWithSpouse,
  }
}

/**
 * Get guest with spouse information
 *
 * @param guest_id - Guest ID to fetch
 * @returns Guest record with spouse info
 */
export async function getGuestWithSpouse(
  guest_id: string
): Promise<BookingResult<GuestWithSpouse>> {
  const supabase = createServiceRoleClient()

  const { data, error } = await supabase
    .from('guests')
    .select('*')
    .eq('id', guest_id)
    .single()

  if (error || !data) {
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
    data: data as GuestWithSpouse,
  }
}

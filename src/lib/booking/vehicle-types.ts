/**
 * Vehicle & Family Type Definitions
 *
 * Types for managing guest vehicles (personal and RV/camper),
 * family members (spouse/partner and children), and evacuation contacts.
 *
 * Vehicles are stored at guest level for reuse across reservations.
 * Children are stored per-reservation since family composition varies per trip.
 */

// ============================================================================
// Vehicle Types
// ============================================================================

/**
 * Personal vehicle type (matches DB CHECK constraint)
 */
export type PersonalVehicleType =
  | 'car'
  | 'truck'
  | 'suv'
  | 'motorcycle'
  | 'boat_trailer'
  | 'other'

/**
 * RV/Camper type classification (matches DB CHECK constraint)
 */
export type RVType =
  | 'class_a'        // Largest motorhomes, bus-style
  | 'class_b'        // Camper vans, smallest motorhomes
  | 'class_c'        // Medium motorhomes with cab-over
  | 'fifth_wheel'    // Towed, connects to truck bed
  | 'travel_trailer' // Towed, conventional hitch
  | 'popup'          // Folding/popup campers
  | 'truck_camper'   // Slides into truck bed
  | 'toy_hauler'     // Has garage for ATVs, motorcycles

/**
 * Vehicle record type category (matches DB CHECK constraint)
 */
export type VehicleRecordType = 'personal' | 'rv' | 'tow_vehicle'

/**
 * Guest vehicle record (matches DB guest_vehicles table)
 */
export interface GuestVehicle {
  id: string
  guest_id: string
  property_id: string
  vehicle_type: VehicleRecordType

  // Personal / Tow vehicle fields
  make: string | null
  model: string | null
  year: number | null
  color: string | null
  license_plate: string | null
  license_plate_state: string | null
  personal_vehicle_type: PersonalVehicleType | null

  // RV/Camper fields
  rv_type: RVType | null
  rv_length_feet: number | null
  rv_width_feet: number | null
  num_slide_outs: number

  // Compliance fields
  insurance_company: string | null
  insurance_policy_number: string | null

  // Metadata
  is_primary: boolean
  created_at: string
  updated_at: string
}

/**
 * Input for creating a new guest vehicle
 */
export interface CreateVehicleInput {
  vehicle_type: VehicleRecordType

  // Personal / Tow vehicle fields
  make?: string
  model?: string
  year?: number
  color?: string
  license_plate?: string
  license_plate_state?: string
  personal_vehicle_type?: PersonalVehicleType

  // RV/Camper fields
  rv_type?: RVType
  rv_length_feet?: number
  rv_width_feet?: number
  num_slide_outs?: number

  // Compliance fields
  insurance_company?: string
  insurance_policy_number?: string

  is_primary?: boolean
}

/**
 * Input for updating an existing vehicle
 */
export interface UpdateVehicleInput extends Partial<CreateVehicleInput> {
  id: string
}

// ============================================================================
// Family Member Types
// ============================================================================

/**
 * Spouse/Partner information (stored on guest record)
 */
export interface SpousePartnerInfo {
  first_name: string
  last_name: string
  phone?: string
  email?: string
  is_alternate_contact: boolean
}

/**
 * Reservation child record (matches DB reservation_children table)
 */
export interface ReservationChild {
  id: string
  reservation_id: string
  property_id: string
  first_name: string
  age: number | null
  date_of_birth: string | null // ISO 8601 date
  special_needs_allergies: string | null
  created_at: string
}

/**
 * Input for creating a child record
 */
export interface CreateChildInput {
  first_name: string
  age?: number
  date_of_birth?: string // YYYY-MM-DD format
  special_needs_allergies?: string
}

// ============================================================================
// Evacuation Contact Types
// ============================================================================

/**
 * Evacuation contact for emergency scenarios (stored on reservation)
 */
export interface EvacuationContact {
  name: string
  phone: string
  relationship?: string
}

// ============================================================================
// Reservation Vehicle Link Types
// ============================================================================

/**
 * Link between reservation and guest vehicle
 */
export interface ReservationVehicle {
  id: string
  reservation_id: string
  guest_vehicle_id: string
  created_at: string
}

// ============================================================================
// Extended Guest Type with Spouse
// ============================================================================

/**
 * Guest with spouse/partner information
 */
export interface GuestWithSpouse {
  id: string
  property_id: string
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  stripe_customer_id: string | null
  notes: string | null

  // Spouse fields
  spouse_first_name: string | null
  spouse_last_name: string | null
  spouse_phone: string | null
  spouse_email: string | null
  spouse_is_alternate_contact: boolean

  created_at: string
  updated_at: string
}

// ============================================================================
// Display Labels
// ============================================================================

/**
 * Human-readable labels for personal vehicle types
 */
export const PERSONAL_VEHICLE_TYPE_LABELS: Record<PersonalVehicleType, string> = {
  car: 'Car',
  truck: 'Truck',
  suv: 'SUV',
  motorcycle: 'Motorcycle',
  boat_trailer: 'Boat Trailer',
  other: 'Other',
}

/**
 * Human-readable labels for RV types
 */
export const RV_TYPE_LABELS: Record<RVType, string> = {
  class_a: 'Class A Motorhome',
  class_b: 'Class B (Camper Van)',
  class_c: 'Class C Motorhome',
  fifth_wheel: 'Fifth Wheel',
  travel_trailer: 'Travel Trailer',
  popup: 'Pop-up / Folding Camper',
  truck_camper: 'Truck Camper',
  toy_hauler: 'Toy Hauler',
}

/**
 * Human-readable labels for vehicle record types
 */
export const VEHICLE_RECORD_TYPE_LABELS: Record<VehicleRecordType, string> = {
  personal: 'Personal Vehicle',
  rv: 'RV / Camper',
  tow_vehicle: 'Tow Vehicle',
}

// ============================================================================
// US State Codes for License Plates
// ============================================================================

export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
] as const

export type USStateCode = typeof US_STATE_CODES[number]

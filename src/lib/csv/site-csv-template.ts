/**
 * Site CSV Template Generator
 *
 * Generates downloadable CSV template for bulk site upload.
 * Columns match the Add Site form fields (excluding image upload).
 */

export interface CsvColumn {
  key: string
  header: string
  required: boolean
  description: string
  example: string
  type: 'string' | 'number' | 'boolean' | 'json_array' | 'json_object' | 'enum'
  enumValues?: readonly string[]
}

/**
 * Complete CSV column definitions for site import.
 * Order mirrors the Add Site form: identification → type/capacity → status →
 * description → pricing/reservation types → hookups → amenities → pets/ADA.
 */
export const CSV_COLUMNS: readonly CsvColumn[] = [
  // ========== Identification (Required) ==========
  {
    key: 'site_number',
    header: 'Site Number',
    required: true,
    description: 'Unique site identifier within property (e.g., A-101, Site 5)',
    example: 'A-101',
    type: 'string',
  },
  {
    key: 'site_name',
    header: 'Site Name',
    required: false,
    description: 'Optional friendly name (e.g., Lakeview RV, Shady Grove)',
    example: 'Lakeview RV',
    type: 'string',
  },

  // ========== Type & Capacity ==========
  {
    key: 'site_type',
    header: 'Site Type',
    required: true,
    description: 'Type of site: tent, rv, cabin, glamping, yurt, or other',
    example: 'rv',
    type: 'enum',
    enumValues: ['tent', 'rv', 'cabin', 'glamping', 'yurt', 'other'] as const,
  },
  {
    key: 'max_occupancy',
    header: 'Max Occupancy',
    required: false,
    description: 'Maximum number of people (1-50)',
    example: '6',
    type: 'number',
  },
  {
    key: 'max_vehicles',
    header: 'Max Vehicles',
    required: false,
    description: 'Maximum number of vehicles (1-10)',
    example: '2',
    type: 'number',
  },
  {
    key: 'size_sqft',
    header: 'Size (sqft)',
    required: false,
    description: 'Site size in square feet',
    example: '1200',
    type: 'number',
  },

  // ========== Status ==========
  {
    key: 'status',
    header: 'Status',
    required: false,
    description:
      'Site status: available, reserved, booked, occupied, housekeeping, maintenance, or unavailable',
    example: 'available',
    type: 'enum',
    enumValues: [
      'available',
      'reserved',
      'booked',
      'occupied',
      'housekeeping',
      'maintenance',
      'unavailable',
    ] as const,
  },

  // ========== Description ==========
  {
    key: 'description',
    header: 'Description',
    required: false,
    description: 'Site description (max 1000 characters)',
    example: 'Spacious RV site with full hookups and lake view',
    type: 'string',
  },

  // ========== Pricing & Reservation Types ==========
  // use_property_defaults controls whether the site overrides property pricing.
  // Set FALSE + fill enabled_reservation_types + rate columns to override.
  {
    key: 'use_property_defaults',
    header: 'Use Property Defaults',
    required: false,
    description:
      'TRUE to inherit property pricing/reservation types; FALSE to set custom rates below (default: TRUE)',
    example: 'FALSE',
    type: 'boolean',
  },
  {
    key: 'enabled_reservation_types',
    header: 'Enabled Reservation Types',
    required: false,
    description:
      'Active reservation types when Use Property Defaults is FALSE. JSON array: ["nightly","weekly","monthly","seasonal"]',
    example: '["nightly","weekly"]',
    type: 'json_array',
  },
  {
    key: 'base_price',
    header: 'Base Price ($)',
    required: false,
    description:
      'Nightly base rate in dollars. Required (> 0) only when Use Property Defaults is FALSE. Leave empty or 0 to inherit the property nightly rate.',
    example: '45.00',
    type: 'number',
  },
  {
    key: 'weekend_price',
    header: 'Weekend Price ($)',
    required: false,
    description: 'Weekend nightly rate in dollars (Fri/Sat, optional)',
    example: '55.00',
    type: 'number',
  },
  {
    key: 'weekly_rate',
    header: 'Weekly Rate ($/night)',
    required: false,
    description: 'Weekly per-night rate in dollars. Leave empty to use base rate.',
    example: '40.00',
    type: 'number',
  },
  {
    key: 'monthly_rate',
    header: 'Monthly Rate ($/night)',
    required: false,
    description: 'Monthly per-night rate in dollars. Leave empty to use base rate.',
    example: '35.00',
    type: 'number',
  },
  {
    key: 'seasonal_rate',
    header: 'Seasonal Rate ($)',
    required: false,
    description: 'Seasonal flat rate in dollars. Leave empty to use property seasonal rate.',
    example: '',
    type: 'number',
  },
  {
    key: 'default_reservation_type',
    header: 'Default Reservation Type',
    required: false,
    description:
      'Suggested reservation type when guests book this site: nightly, weekly, monthly, or seasonal',
    example: 'nightly',
    type: 'enum',
    enumValues: ['nightly', 'weekly', 'monthly', 'seasonal'] as const,
  },

  // ========== Hookups ==========
  {
    key: 'hookups',
    header: 'Hookups',
    required: false,
    description: 'JSON array of hookups: ["water","electric","sewer"]',
    example: '["water","electric","sewer"]',
    type: 'json_array',
  },

  // ========== Amenities ==========
  {
    key: 'amenities',
    header: 'Amenities',
    required: false,
    description:
      'JSON array of amenities: ["fire_pit","picnic_table","grill","shade","pet_friendly","lake_view","waterfront"]',
    example: '["fire_pit","picnic_table","lake_view"]',
    type: 'json_array',
  },

  // ========== Pet Policy ==========
  {
    key: 'allow_pets',
    header: 'Allow Pets',
    required: false,
    description: 'Whether pets are allowed: TRUE or FALSE',
    example: 'TRUE',
    type: 'boolean',
  },
  {
    key: 'pet_fee',
    header: 'Pet Fee ($)',
    required: false,
    description: 'One-time pet fee in dollars (optional, only used when Allow Pets is TRUE)',
    example: '15.00',
    type: 'number',
  },

  // ========== ADA Accessibility ==========
  {
    key: 'ada_accessible',
    header: 'ADA Accessible',
    required: false,
    description: 'Whether site meets ADA standards: TRUE or FALSE',
    example: 'TRUE',
    type: 'boolean',
  },
  {
    key: 'accessibility_features',
    header: 'Accessibility Features',
    required: false,
    description:
      'JSON array of features (only when ADA Accessible is TRUE): ["wheelchair_accessible","wide_paths","accessible_table","accessible_restroom","handrails","level_ground"]',
    example: '["wheelchair_accessible","wide_paths","level_ground"]',
    type: 'json_array',
  },
] as const

/**
 * Generate CSV header row with column names
 */
export function generateCsvHeader(): string {
  return CSV_COLUMNS.map((col) => col.header).join(',')
}

/**
 * Generate CSV example row with sample data
 */
export function generateExampleRow(): string {
  return CSV_COLUMNS.map((col) => {
    const value = col.example
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }).join(',')
}

/**
 * Generate second example row — tent site using property defaults
 */
export function generateExampleRow2(): string {
  const examples: Record<string, string> = {
    site_number: 'T-205',
    site_name: 'Forest Tent Site',
    site_type: 'tent',
    max_occupancy: '4',
    max_vehicles: '1',
    size_sqft: '800',
    status: 'available',
    description: 'Shaded tent site with water hookup',
    use_property_defaults: 'TRUE',
    enabled_reservation_types: '',
    base_price: '',
    weekend_price: '',
    weekly_rate: '',
    monthly_rate: '',
    seasonal_rate: '',
    default_reservation_type: '',
    hookups: '["water"]',
    amenities: '["fire_pit","picnic_table","shade"]',
    allow_pets: 'TRUE',
    pet_fee: '10.00',
    ada_accessible: 'FALSE',
    accessibility_features: '',
  }

  return CSV_COLUMNS.map((col) => {
    const value = examples[col.key] ?? ''
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }).join(',')
}

/**
 * Generate complete CSV template with header and two example rows
 */
export function generateCsvTemplate(): string {
  const lines = [generateCsvHeader(), generateExampleRow(), generateExampleRow2()]
  return lines.join('\n')
}

/**
 * Generate CSV template as downloadable Blob
 */
export function generateCsvTemplateBlob(): Blob {
  const csv = generateCsvTemplate()
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' })
}

/**
 * Download CSV template file
 */
export function downloadCsvTemplate(filename: string = 'site-import-template.csv'): void {
  const blob = generateCsvTemplateBlob()
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'

  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Get CSV column by key
 */
export function getColumnByKey(key: string): CsvColumn | undefined {
  return CSV_COLUMNS.find((col) => col.key === key)
}

/**
 * Get all required column keys
 */
export function getRequiredColumns(): string[] {
  return CSV_COLUMNS.filter((col) => col.required).map((col) => col.key)
}

/**
 * Validate that CSV has all required columns
 */
export function validateRequiredColumns(headers: string[]): {
  valid: boolean
  missing: string[]
} {
  const requiredKeys = getRequiredColumns()
  const headerKeys = CSV_COLUMNS.filter((col) => headers.includes(col.header)).map((col) => col.key)

  const missing = requiredKeys.filter((key) => !headerKeys.includes(key))

  return {
    valid: missing.length === 0,
    missing: missing.map((key) => {
      const col = getColumnByKey(key)
      return col?.header || key
    }),
  }
}

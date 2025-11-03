/**
 * Site CSV Template Generator
 *
 * Generates downloadable CSV template for bulk site upload.
 * Includes all available fields with example data and descriptions.
 */

import type { SiteType, SiteStatus } from '@/lib/booking/types'

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
 * Complete CSV column definitions for site import
 * Ordered logically: identification → type/capacity → pricing → amenities → metadata
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
    required: false,
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

  // ========== Pricing (in dollars) ==========
  {
    key: 'base_price',
    header: 'Base Price ($)',
    required: true,
    description: 'Nightly rate in dollars (will be converted to cents)',
    example: '45.00',
    type: 'number',
  },
  {
    key: 'weekend_price',
    header: 'Weekend Price ($)',
    required: false,
    description: 'Weekend nightly rate in dollars (optional)',
    example: '55.00',
    type: 'number',
  },

  // ========== Status ==========
  {
    key: 'status',
    header: 'Status',
    required: false,
    description: 'Site status: available, unavailable, or maintenance',
    example: 'available',
    type: 'enum',
    enumValues: ['available', 'unavailable', 'maintenance'] as const,
  },

  // ========== Hookups & Basic Amenities ==========
  {
    key: 'hookups',
    header: 'Hookups',
    required: false,
    description: 'JSON array of hookups: ["water","electric","sewer"]',
    example: '["water","electric","sewer"]',
    type: 'json_array',
  },
  {
    key: 'amenities',
    header: 'Amenities',
    required: false,
    description: 'JSON array of amenities: ["fire_pit","picnic_table","grill","shade","pet_friendly","lake_view","waterfront"]',
    example: '["fire_pit","picnic_table","lake_view"]',
    type: 'json_array',
  },

  // ========== Pet & Accessibility ==========
  {
    key: 'allow_pets',
    header: 'Allow Pets',
    required: false,
    description: 'TRUE or FALSE (defaults to FALSE)',
    example: 'TRUE',
    type: 'boolean',
  },
  {
    key: 'pet_fee',
    header: 'Pet Fee ($)',
    required: false,
    description: 'One-time pet fee in dollars',
    example: '25.00',
    type: 'number',
  },
  {
    key: 'ada_accessible',
    header: 'ADA Accessible',
    required: false,
    description: 'TRUE or FALSE (defaults to FALSE)',
    example: 'FALSE',
    type: 'boolean',
  },

  // ========== Advanced Features (Optional) ==========
  {
    key: 'description',
    header: 'Description',
    required: false,
    description: 'Site description (max 1000 characters)',
    example: 'Spacious RV site with full hookups and lake view',
    type: 'string',
  },
  {
    key: 'accessibility_features',
    header: 'Accessibility Features',
    required: false,
    description: 'JSON array of features: ["wheelchair_accessible","wide_paths","accessible_table"]',
    example: '["wheelchair_accessible","wide_paths"]',
    type: 'json_array',
  },
  {
    key: 'seasonal_pricing',
    header: 'Seasonal Pricing',
    required: false,
    description: 'JSON array of seasonal prices: [{"season":"summer","start_date":"2024-06-01","end_date":"2024-08-31","price":75}]',
    example: '[{"season":"summer","price":75}]',
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
    // Wrap strings containing commas or quotes in quotes
    const value = col.example
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"` // Escape quotes
    }
    return value
  }).join(',')
}

/**
 * Generate second example row with different site type
 */
export function generateExampleRow2(): string {
  const examples: Record<string, string> = {
    site_number: 'T-205',
    site_name: 'Forest Tent Site',
    site_type: 'tent',
    max_occupancy: '4',
    max_vehicles: '1',
    size_sqft: '800',
    base_price: '30.00',
    weekend_price: '35.00',
    status: 'available',
    hookups: '["water"]',
    amenities: '["fire_pit","picnic_table","shade"]',
    allow_pets: 'TRUE',
    pet_fee: '15.00',
    ada_accessible: 'FALSE',
    description: 'Shaded tent site with water hookup',
    accessibility_features: '[]',
    seasonal_pricing: '[]',
  }

  return CSV_COLUMNS.map((col) => {
    const value = examples[col.key] || ''
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`
    }
    return value
  }).join(',')
}

/**
 * Generate complete CSV template with header and example rows
 */
export function generateCsvTemplate(): string {
  const lines = [
    generateCsvHeader(),
    generateExampleRow(),
    generateExampleRow2(),
  ]
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
 * @param filename - Name for downloaded file (defaults to "site-import-template.csv")
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

  // Cleanup
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
  const headerKeys = CSV_COLUMNS.filter((col) =>
    headers.includes(col.header)
  ).map((col) => col.key)

  const missing = requiredKeys.filter((key) => !headerKeys.includes(key))

  return {
    valid: missing.length === 0,
    missing: missing.map((key) => {
      const col = getColumnByKey(key)
      return col?.header || key
    }),
  }
}

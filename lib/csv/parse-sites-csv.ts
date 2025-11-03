/**
 * Site CSV Parser
 *
 * Parses and transforms CSV data for bulk site upload.
 * Handles type conversions, validation, and error reporting.
 */

import Papa from 'papaparse'
import type { SiteType, SiteStatus } from '@/lib/booking/types'
import { CSV_COLUMNS, getColumnByKey } from './site-csv-template'

// ============================================================================
// Constants
// ============================================================================

export const MAX_FILE_SIZE_MB = 5
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const MAX_ROW_COUNT = 500

// ============================================================================
// Types
// ============================================================================

/**
 * Raw CSV row data (string values from Papa Parse)
 */
export interface CsvRow {
  [key: string]: string
}

/**
 * Parsed site data ready for API submission
 * Matches the format expected by POST /api/dashboard/properties/[id]/sites
 */
export interface ParsedSite {
  site_number: string
  site_name?: string | null
  site_type?: SiteType
  max_occupancy?: number
  max_vehicles?: number
  size_sqft?: number | null
  base_price: number // cents
  weekend_price?: number | null // cents
  status?: SiteStatus
  hookups?: string[]
  amenities?: string[]
  allow_pets?: boolean
  pet_fee?: number | null // cents
  ada_accessible?: boolean
  description?: string | null
  accessibility_features?: string[]
  seasonal_pricing?: Array<{
    season?: string
    start_date?: string
    end_date?: string
    price?: number // cents
  }>
}

/**
 * Parsing error with row context
 */
export interface ParseError {
  row: number // 1-indexed row number (excluding header)
  field?: string
  message: string
  value?: string
}

/**
 * Result of CSV parsing operation
 */
export interface ParseResult {
  success: boolean
  data: ParsedSite[]
  errors: ParseError[]
  rowCount: number
  validRowCount: number
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert dollars to cents (integer)
 */
function dollarsToCents(dollars: string | number | null | undefined): number | null {
  if (dollars === null || dollars === undefined || dollars === '') {
    return null
  }

  const num = typeof dollars === 'string' ? parseFloat(dollars) : dollars

  if (isNaN(num)) {
    return null
  }

  return Math.round(num * 100)
}

/**
 * Parse boolean from string
 */
function parseBoolean(value: string | undefined): boolean {
  if (!value) return false
  const normalized = value.toLowerCase().trim()
  return normalized === 'true' || normalized === 't' || normalized === '1' || normalized === 'yes'
}

/**
 * Parse JSON array from string
 */
function parseJsonArray(value: string | undefined): any[] | null {
  if (!value || value.trim() === '') return null

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

/**
 * Parse JSON object from string
 */
function parseJsonObject(value: string | undefined): any | null {
  if (!value || value.trim() === '') return null

  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/**
 * Parse integer from string
 */
function parseInteger(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null
  const num = parseInt(value, 10)
  return isNaN(num) ? null : num
}

/**
 * Map CSV header to internal field key
 */
function mapHeaderToKey(header: string): string | null {
  const column = CSV_COLUMNS.find(
    (col) => col.header.toLowerCase() === header.toLowerCase().trim()
  )
  return column?.key || null
}

/**
 * Transform raw CSV row to ParsedSite format
 */
function transformRow(row: CsvRow, rowIndex: number): {
  site: ParsedSite | null
  errors: ParseError[]
} {
  const errors: ParseError[] = []
  const site: Partial<ParsedSite> = {}

  // Required: site_number
  const siteNumberKey = mapHeaderToKey('Site Number')
  if (siteNumberKey && row[siteNumberKey]) {
    site.site_number = row[siteNumberKey].trim()
  } else {
    errors.push({
      row: rowIndex,
      field: 'site_number',
      message: 'Site Number is required',
    })
  }

  // Required: base_price (in dollars, convert to cents)
  const basePriceKey = mapHeaderToKey('Base Price ($)')
  if (basePriceKey && row[basePriceKey]) {
    const cents = dollarsToCents(row[basePriceKey])
    if (cents === null || cents <= 0) {
      errors.push({
        row: rowIndex,
        field: 'base_price',
        message: 'Base Price must be greater than $0.00',
        value: row[basePriceKey],
      })
    } else {
      site.base_price = cents
    }
  } else {
    errors.push({
      row: rowIndex,
      field: 'base_price',
      message: 'Base Price is required',
    })
  }

  // If required fields are missing, return early
  if (!site.site_number || site.base_price === undefined) {
    return { site: null, errors }
  }

  // Optional: site_name
  const siteNameKey = mapHeaderToKey('Site Name')
  if (siteNameKey && row[siteNameKey]) {
    site.site_name = row[siteNameKey].trim() || null
  }

  // Optional: site_type
  const siteTypeKey = mapHeaderToKey('Site Type')
  if (siteTypeKey && row[siteTypeKey]) {
    const type = row[siteTypeKey].trim().toLowerCase()
    const validTypes: SiteType[] = ['tent', 'rv', 'cabin', 'glamping', 'yurt', 'other']
    if (validTypes.includes(type as SiteType)) {
      site.site_type = type as SiteType
    } else {
      errors.push({
        row: rowIndex,
        field: 'site_type',
        message: `Invalid site type. Must be one of: ${validTypes.join(', ')}`,
        value: row[siteTypeKey],
      })
    }
  }

  // Optional: max_occupancy
  const maxOccupancyKey = mapHeaderToKey('Max Occupancy')
  if (maxOccupancyKey && row[maxOccupancyKey]) {
    const occupancy = parseInteger(row[maxOccupancyKey])
    if (occupancy !== null) {
      if (occupancy < 1 || occupancy > 50) {
        errors.push({
          row: rowIndex,
          field: 'max_occupancy',
          message: 'Max Occupancy must be between 1 and 50',
          value: row[maxOccupancyKey],
        })
      } else {
        site.max_occupancy = occupancy
      }
    }
  }

  // Optional: max_vehicles
  const maxVehiclesKey = mapHeaderToKey('Max Vehicles')
  if (maxVehiclesKey && row[maxVehiclesKey]) {
    const vehicles = parseInteger(row[maxVehiclesKey])
    if (vehicles !== null) {
      if (vehicles < 1 || vehicles > 10) {
        errors.push({
          row: rowIndex,
          field: 'max_vehicles',
          message: 'Max Vehicles must be between 1 and 10',
          value: row[maxVehiclesKey],
        })
      } else {
        site.max_vehicles = vehicles
      }
    }
  }

  // Optional: size_sqft
  const sizeSqftKey = mapHeaderToKey('Size (sqft)')
  if (sizeSqftKey && row[sizeSqftKey]) {
    site.size_sqft = parseInteger(row[sizeSqftKey])
  }

  // Optional: weekend_price (in dollars, convert to cents)
  const weekendPriceKey = mapHeaderToKey('Weekend Price ($)')
  if (weekendPriceKey && row[weekendPriceKey]) {
    site.weekend_price = dollarsToCents(row[weekendPriceKey])
  }

  // Optional: status
  const statusKey = mapHeaderToKey('Status')
  if (statusKey && row[statusKey]) {
    const status = row[statusKey].trim().toLowerCase()
    const validStatuses: SiteStatus[] = ['available', 'unavailable', 'maintenance']
    if (validStatuses.includes(status as SiteStatus)) {
      site.status = status as SiteStatus
    } else {
      errors.push({
        row: rowIndex,
        field: 'status',
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        value: row[statusKey],
      })
    }
  }

  // Optional: hookups (JSON array)
  const hookupsKey = mapHeaderToKey('Hookups')
  if (hookupsKey && row[hookupsKey]) {
    const hookups = parseJsonArray(row[hookupsKey])
    if (hookups === null && row[hookupsKey].trim() !== '') {
      errors.push({
        row: rowIndex,
        field: 'hookups',
        message: 'Hookups must be a valid JSON array (e.g., ["water","electric"])',
        value: row[hookupsKey],
      })
    } else if (hookups) {
      site.hookups = hookups
    }
  }

  // Optional: amenities (JSON array)
  const amenitiesKey = mapHeaderToKey('Amenities')
  if (amenitiesKey && row[amenitiesKey]) {
    const amenities = parseJsonArray(row[amenitiesKey])
    if (amenities === null && row[amenitiesKey].trim() !== '') {
      errors.push({
        row: rowIndex,
        field: 'amenities',
        message: 'Amenities must be a valid JSON array (e.g., ["fire_pit","picnic_table"])',
        value: row[amenitiesKey],
      })
    } else if (amenities) {
      site.amenities = amenities
    }
  }

  // Optional: allow_pets
  const allowPetsKey = mapHeaderToKey('Allow Pets')
  if (allowPetsKey && row[allowPetsKey]) {
    site.allow_pets = parseBoolean(row[allowPetsKey])
  }

  // Optional: pet_fee (in dollars, convert to cents)
  const petFeeKey = mapHeaderToKey('Pet Fee ($)')
  if (petFeeKey && row[petFeeKey]) {
    site.pet_fee = dollarsToCents(row[petFeeKey])
  }

  // Optional: ada_accessible
  const adaAccessibleKey = mapHeaderToKey('ADA Accessible')
  if (adaAccessibleKey && row[adaAccessibleKey]) {
    site.ada_accessible = parseBoolean(row[adaAccessibleKey])
  }

  // Optional: description
  const descriptionKey = mapHeaderToKey('Description')
  if (descriptionKey && row[descriptionKey]) {
    const desc = row[descriptionKey].trim()
    if (desc.length > 1000) {
      errors.push({
        row: rowIndex,
        field: 'description',
        message: 'Description must be 1000 characters or less',
        value: `${desc.substring(0, 50)}...`,
      })
    } else {
      site.description = desc || null
    }
  }

  // Optional: accessibility_features (JSON array)
  const accessibilityFeaturesKey = mapHeaderToKey('Accessibility Features')
  if (accessibilityFeaturesKey && row[accessibilityFeaturesKey]) {
    const features = parseJsonArray(row[accessibilityFeaturesKey])
    if (features === null && row[accessibilityFeaturesKey].trim() !== '') {
      errors.push({
        row: rowIndex,
        field: 'accessibility_features',
        message: 'Accessibility Features must be a valid JSON array',
        value: row[accessibilityFeaturesKey],
      })
    } else if (features) {
      site.accessibility_features = features
    }
  }

  // Optional: seasonal_pricing (JSON array of objects)
  const seasonalPricingKey = mapHeaderToKey('Seasonal Pricing')
  if (seasonalPricingKey && row[seasonalPricingKey]) {
    const pricing = parseJsonArray(row[seasonalPricingKey])
    if (pricing === null && row[seasonalPricingKey].trim() !== '') {
      errors.push({
        row: rowIndex,
        field: 'seasonal_pricing',
        message: 'Seasonal Pricing must be a valid JSON array',
        value: row[seasonalPricingKey],
      })
    } else if (pricing) {
      // Convert prices from dollars to cents
      site.seasonal_pricing = pricing.map((p: any) => ({
        ...p,
        price: p.price ? dollarsToCents(p.price) || undefined : undefined,
      }))
    }
  }

  return { site: site as ParsedSite, errors }
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse CSV file and convert to ParsedSite array
 *
 * @param file - CSV file to parse
 * @returns Parse result with data and errors
 */
export async function parseSitesCsv(file: File): Promise<ParseResult> {
  const errors: ParseError[] = []

  // Validate file size
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      data: [],
      errors: [
        {
          row: 0,
          message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit`,
        },
      ],
      rowCount: 0,
      validRowCount: 0,
    }
  }

  // Validate file type
  if (!file.name.endsWith('.csv')) {
    return {
      success: false,
      data: [],
      errors: [
        {
          row: 0,
          message: 'File must be a CSV (.csv extension)',
        },
      ],
      rowCount: 0,
      validRowCount: 0,
    }
  }

  // Parse CSV with Papa Parse
  const parseResult = await new Promise<Papa.ParseResult<CsvRow>>((resolve) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => {
        // Map header to internal key
        return mapHeaderToKey(header) || header
      },
      complete: resolve,
    })
  })

  // Check for parsing errors
  if (parseResult.errors.length > 0) {
    return {
      success: false,
      data: [],
      errors: parseResult.errors.map((err) => ({
        row: err.row || 0,
        message: err.message,
      })),
      rowCount: 0,
      validRowCount: 0,
    }
  }

  // Validate row count
  const rows = parseResult.data
  if (rows.length > MAX_ROW_COUNT) {
    return {
      success: false,
      data: [],
      errors: [
        {
          row: 0,
          message: `CSV contains ${rows.length} rows, but maximum is ${MAX_ROW_COUNT}`,
        },
      ],
      rowCount: rows.length,
      validRowCount: 0,
    }
  }

  // Transform rows
  const sites: ParsedSite[] = []
  rows.forEach((row, index) => {
    const rowNumber = index + 1 // 1-indexed for user display
    const { site, errors: rowErrors } = transformRow(row, rowNumber)

    if (site) {
      sites.push(site)
    }

    errors.push(...rowErrors)
  })

  return {
    success: errors.length === 0,
    data: sites,
    errors,
    rowCount: rows.length,
    validRowCount: sites.length,
  }
}

/**
 * Generate error report CSV content
 *
 * @param errors - Parse errors to include in report
 * @returns CSV string with error details
 */
export function generateErrorReportCsv(errors: ParseError[]): string {
  const header = 'Row,Field,Error,Value\n'
  const rows = errors.map((err) => {
    const row = err.row || 'N/A'
    const field = err.field || 'N/A'
    const message = err.message.replace(/"/g, '""') // Escape quotes
    const value = err.value ? err.value.replace(/"/g, '""') : 'N/A'
    return `${row},"${field}","${message}","${value}"`
  })

  return header + rows.join('\n')
}

/**
 * Download error report as CSV file
 *
 * @param errors - Parse errors to include in report
 * @param filename - Name for downloaded file
 */
export function downloadErrorReport(
  errors: ParseError[],
  filename: string = 'site-import-errors.csv'
): void {
  const csv = generateErrorReportCsv(errors)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
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

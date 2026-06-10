/**
 * Site CSV Parser
 *
 * Parses and transforms CSV data for bulk site upload.
 * Handles type conversions, validation, and error reporting.
 */

import Papa from 'papaparse'
import {
  siteTypes,
  siteStatuses,
  reservationTypes,
} from '@/components/dashboard/setup-wizard/site-form-schema'
import { CSV_COLUMNS } from './site-csv-template'

// ============================================================================
// Constants
// ============================================================================

export const MAX_FILE_SIZE_MB = 5
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
export const MAX_ROW_COUNT = 500

// ============================================================================
// Types
// ============================================================================

type SiteType = (typeof siteTypes)[number]
type SiteStatus = (typeof siteStatuses)[number]
type ReservationType = (typeof reservationTypes)[number]

/**
 * Raw CSV row data (string values from Papa Parse)
 */
export interface CsvRow {
  [key: string]: string
}

/**
 * Parsed site data (snake_case, prices in cents).
 * Use parsedSiteToApiRequest() to convert to the v1 API camelCase format
 * before submitting to POST /api/v1/properties/[id]/sites/bulk.
 */
export interface ParsedSite {
  site_number: string
  site_name?: string | null
  site_type?: SiteType
  max_occupancy?: number
  max_vehicles?: number
  size_sqft?: number | null
  /** Nightly base price in cents */
  base_price: number
  /** Weekend price in cents */
  weekend_price?: number | null
  /** Weekly per-night rate in cents */
  weekly_rate?: number | null
  /** Monthly per-night rate in cents */
  monthly_rate?: number | null
  /** Seasonal flat rate in cents */
  seasonal_rate?: number | null
  default_reservation_type?: ReservationType
  /** TRUE = inherit property pricing/reservation types (default) */
  use_property_defaults?: boolean
  enabled_reservation_types?: ReservationType[]
  status?: SiteStatus
  hookups?: string[]
  amenities?: string[]
  allow_pets?: boolean
  pet_fee?: number | null
  ada_accessible?: boolean
  description?: string | null
  accessibility_features?: string[]
}

/**
 * Parsed site converted to v1 API camelCase format for submission.
 * All prices are in cents (integers).
 */
export interface SiteApiRequest {
  siteNumber: string
  siteName?: string
  siteType: SiteType
  description?: string
  basePrice: number
  weekendPrice?: number
  maxOccupancy?: number
  maxVehicles?: number
  sizeSqft?: number
  amenities?: string[]
  hookups?: string[]
  /** null = use property defaults */
  enabledReservationTypesOverride: ReservationType[] | null
  defaultReservationType?: ReservationType
  weeklyRateCents?: number
  monthlyRateCents?: number
  seasonalRateCents?: number
}

/**
 * Parsing error with row context
 */
export interface ParseError {
  row: number
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

function dollarsToCents(dollars: string | number | null | undefined): number | null {
  if (dollars === null || dollars === undefined || dollars === '') return null
  const num = typeof dollars === 'string' ? parseFloat(dollars) : dollars
  if (isNaN(num)) return null
  return Math.round(num * 100)
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false
  const v = value.toLowerCase().trim()
  return v === 'true' || v === 't' || v === '1' || v === 'yes'
}

function parseJsonArray(value: string | undefined): unknown[] | null {
  if (!value || value.trim() === '') return null
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function parseInteger(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null
  const num = parseInt(value, 10)
  return isNaN(num) ? null : num
}

function mapHeaderToKey(header: string): string | null {
  const column = CSV_COLUMNS.find(
    (col) => col.header.toLowerCase() === header.toLowerCase().trim()
  )
  return column?.key || null
}

// ============================================================================
// Row Transformer
// ============================================================================

function transformRow(
  row: CsvRow,
  rowIndex: number
): { site: ParsedSite | null; errors: ParseError[] } {
  const errors: ParseError[] = []
  const site: Partial<ParsedSite> = {}

  // Required: site_number
  const siteNumberKey = mapHeaderToKey('Site Number')
  if (siteNumberKey && row[siteNumberKey]) {
    site.site_number = row[siteNumberKey].trim()
  } else {
    errors.push({ row: rowIndex, field: 'site_number', message: 'Site Number is required' })
  }

  // Required: base_price — allowed to be 0 when use_property_defaults is TRUE
  const basePriceKey = mapHeaderToKey('Base Price ($)')
  if (basePriceKey && row[basePriceKey] !== undefined && row[basePriceKey] !== '') {
    const cents = dollarsToCents(row[basePriceKey])
    if (cents === null || cents < 0) {
      errors.push({
        row: rowIndex,
        field: 'base_price',
        message: 'Base Price must be a non-negative number',
        value: row[basePriceKey],
      })
    } else {
      site.base_price = cents
    }
  } else {
    // Default to 0 (API handles property-default substitution)
    site.base_price = 0
  }

  if (!site.site_number || site.base_price === undefined) {
    return { site: null, errors }
  }

  // Optional: site_name
  const siteNameKey = mapHeaderToKey('Site Name')
  if (siteNameKey && row[siteNameKey]) {
    site.site_name = row[siteNameKey].trim() || null
  }

  // Optional: site_type (defaults to 'tent' if missing — API requires it)
  const siteTypeKey = mapHeaderToKey('Site Type')
  if (siteTypeKey && row[siteTypeKey]) {
    const type = row[siteTypeKey].trim().toLowerCase()
    if (siteTypes.includes(type as SiteType)) {
      site.site_type = type as SiteType
    } else {
      errors.push({
        row: rowIndex,
        field: 'site_type',
        message: `Invalid site type. Must be one of: ${siteTypes.join(', ')}`,
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
      if (vehicles < 0 || vehicles > 10) {
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

  // Optional: status
  const statusKey = mapHeaderToKey('Status')
  if (statusKey && row[statusKey]) {
    const status = row[statusKey].trim().toLowerCase()
    if (siteStatuses.includes(status as SiteStatus)) {
      site.status = status as SiteStatus
    } else {
      errors.push({
        row: rowIndex,
        field: 'status',
        message: `Invalid status. Must be one of: ${siteStatuses.join(', ')}`,
        value: row[statusKey],
      })
    }
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

  // Optional: use_property_defaults
  const usePropertyDefaultsKey = mapHeaderToKey('Use Property Defaults')
  if (usePropertyDefaultsKey && row[usePropertyDefaultsKey] !== undefined && row[usePropertyDefaultsKey] !== '') {
    site.use_property_defaults = parseBoolean(row[usePropertyDefaultsKey])
  } else {
    site.use_property_defaults = true
  }

  // Optional: enabled_reservation_types (JSON array)
  const enabledTypesKey = mapHeaderToKey('Enabled Reservation Types')
  if (enabledTypesKey && row[enabledTypesKey]) {
    const types = parseJsonArray(row[enabledTypesKey])
    if (types === null && row[enabledTypesKey].trim() !== '') {
      errors.push({
        row: rowIndex,
        field: 'enabled_reservation_types',
        message: 'Enabled Reservation Types must be a valid JSON array (e.g., ["nightly","weekly"])',
        value: row[enabledTypesKey],
      })
    } else if (types) {
      const validTypes = types.filter((t) => reservationTypes.includes(t as ReservationType))
      const invalidTypes = types.filter((t) => !reservationTypes.includes(t as ReservationType))
      if (invalidTypes.length > 0) {
        errors.push({
          row: rowIndex,
          field: 'enabled_reservation_types',
          message: `Invalid reservation types: ${invalidTypes.join(', ')}. Must be: ${reservationTypes.join(', ')}`,
          value: row[enabledTypesKey],
        })
      } else {
        site.enabled_reservation_types = validTypes as ReservationType[]
      }
    }
  }

  // Optional: weekend_price
  const weekendPriceKey = mapHeaderToKey('Weekend Price ($)')
  if (weekendPriceKey && row[weekendPriceKey]) {
    site.weekend_price = dollarsToCents(row[weekendPriceKey])
  }

  // Optional: weekly_rate
  const weeklyRateKey = mapHeaderToKey('Weekly Rate ($/night)')
  if (weeklyRateKey && row[weeklyRateKey]) {
    site.weekly_rate = dollarsToCents(row[weeklyRateKey])
  }

  // Optional: monthly_rate
  const monthlyRateKey = mapHeaderToKey('Monthly Rate ($/night)')
  if (monthlyRateKey && row[monthlyRateKey]) {
    site.monthly_rate = dollarsToCents(row[monthlyRateKey])
  }

  // Optional: seasonal_rate
  const seasonalRateKey = mapHeaderToKey('Seasonal Rate ($)')
  if (seasonalRateKey && row[seasonalRateKey]) {
    site.seasonal_rate = dollarsToCents(row[seasonalRateKey])
  }

  // Optional: default_reservation_type
  const defaultTypeKey = mapHeaderToKey('Default Reservation Type')
  if (defaultTypeKey && row[defaultTypeKey]) {
    const type = row[defaultTypeKey].trim().toLowerCase()
    if (reservationTypes.includes(type as ReservationType)) {
      site.default_reservation_type = type as ReservationType
    } else {
      errors.push({
        row: rowIndex,
        field: 'default_reservation_type',
        message: `Invalid default reservation type. Must be one of: ${reservationTypes.join(', ')}`,
        value: row[defaultTypeKey],
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
      site.hookups = hookups as string[]
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
      site.amenities = amenities as string[]
    }
  }

  // Optional: allow_pets
  const allowPetsKey = mapHeaderToKey('Allow Pets')
  if (allowPetsKey && row[allowPetsKey] !== undefined && row[allowPetsKey] !== '') {
    site.allow_pets = parseBoolean(row[allowPetsKey])
  }

  // Optional: pet_fee
  const petFeeKey = mapHeaderToKey('Pet Fee ($)')
  if (petFeeKey && row[petFeeKey]) {
    site.pet_fee = dollarsToCents(row[petFeeKey])
  }

  // Optional: ada_accessible
  const adaKey = mapHeaderToKey('ADA Accessible')
  if (adaKey && row[adaKey] !== undefined && row[adaKey] !== '') {
    site.ada_accessible = parseBoolean(row[adaKey])
  }

  // Optional: accessibility_features (JSON array)
  const accessibilityKey = mapHeaderToKey('Accessibility Features')
  if (accessibilityKey && row[accessibilityKey]) {
    const features = parseJsonArray(row[accessibilityKey])
    if (features === null && row[accessibilityKey].trim() !== '') {
      errors.push({
        row: rowIndex,
        field: 'accessibility_features',
        message: 'Accessibility Features must be a valid JSON array',
        value: row[accessibilityKey],
      })
    } else if (features) {
      site.accessibility_features = features as string[]
    }
  }

  return { site: site as ParsedSite, errors }
}

// ============================================================================
// API Request Transformer
// ============================================================================

/**
 * Convert a ParsedSite (snake_case, cents) to the v1 API CreateSiteRequest
 * format (camelCase, cents) expected by POST .../sites and .../sites/bulk.
 */
export function parsedSiteToApiRequest(site: ParsedSite): SiteApiRequest {
  // null = use property defaults; array = override
  const enabledReservationTypesOverride: ReservationType[] | null =
    site.use_property_defaults !== false
      ? null
      : (site.enabled_reservation_types ?? ['nightly'])

  const req: SiteApiRequest = {
    siteNumber: site.site_number,
    siteType: site.site_type ?? 'tent',
    basePrice: site.base_price,
    enabledReservationTypesOverride,
  }

  if (site.site_name != null) req.siteName = site.site_name
  if (site.description != null) req.description = site.description
  if (site.weekend_price != null) req.weekendPrice = site.weekend_price
  if (site.max_occupancy != null) req.maxOccupancy = site.max_occupancy
  if (site.max_vehicles != null) req.maxVehicles = site.max_vehicles
  if (site.size_sqft != null) req.sizeSqft = site.size_sqft
  if (site.amenities != null) req.amenities = site.amenities
  if (site.hookups != null) req.hookups = site.hookups
  if (site.default_reservation_type != null) req.defaultReservationType = site.default_reservation_type
  if (site.weekly_rate != null) req.weeklyRateCents = site.weekly_rate
  if (site.monthly_rate != null) req.monthlyRateCents = site.monthly_rate
  if (site.seasonal_rate != null) req.seasonalRateCents = site.seasonal_rate

  return req
}

// ============================================================================
// Main Parser
// ============================================================================

/**
 * Parse CSV file and convert to ParsedSite array.
 */
export async function parseSitesCsv(file: File): Promise<ParseResult> {
  const errors: ParseError[] = []

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, message: `File size exceeds ${MAX_FILE_SIZE_MB}MB limit` }],
      rowCount: 0,
      validRowCount: 0,
    }
  }

  if (!file.name.endsWith('.csv')) {
    return {
      success: false,
      data: [],
      errors: [{ row: 0, message: 'File must be a CSV (.csv extension)' }],
      rowCount: 0,
      validRowCount: 0,
    }
  }

  const parseResult = await new Promise<Papa.ParseResult<CsvRow>>((resolve) => {
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => mapHeaderToKey(header) || header,
      complete: resolve,
    })
  })

  if (parseResult.errors.length > 0) {
    return {
      success: false,
      data: [],
      errors: parseResult.errors.map((err) => ({ row: err.row || 0, message: err.message })),
      rowCount: 0,
      validRowCount: 0,
    }
  }

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

  const sites: ParsedSite[] = []
  rows.forEach((row, index) => {
    const rowNumber = index + 1
    const { site, errors: rowErrors } = transformRow(row, rowNumber)
    if (site) sites.push(site)
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

// ============================================================================
// Error Report Utilities
// ============================================================================

export function generateErrorReportCsv(errors: ParseError[]): string {
  const header = 'Row,Field,Error,Value\n'
  const rows = errors.map((err) => {
    const row = err.row || 'N/A'
    const field = err.field || 'N/A'
    const message = err.message.replace(/"/g, '""')
    const value = err.value ? err.value.replace(/"/g, '""') : 'N/A'
    return `${row},"${field}","${message}","${value}"`
  })
  return header + rows.join('\n')
}

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

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

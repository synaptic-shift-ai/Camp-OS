/**
 * Site CSV Validator
 *
 * Additional validation layer for parsed CSV sites.
 * Checks for duplicates, business logic, and data integrity.
 */

import type { ParsedSite, ParseError } from './parse-sites-csv'
import { siteTypes, siteStatuses } from '@/components/dashboard/setup-wizard/site-form-schema'

// ============================================================================
// Types
// ============================================================================

export interface ValidationResult {
  valid: boolean
  errors: ParseError[]
  duplicates: Array<{
    site_number: string
    rows: number[]
  }>
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Check for duplicate site_number within CSV
 */
function findDuplicates(sites: ParsedSite[]): ValidationResult['duplicates'] {
  const siteNumberMap = new Map<string, number[]>()

  sites.forEach((site, index) => {
    const rowNumber = index + 1
    const existing = siteNumberMap.get(site.site_number) || []
    siteNumberMap.set(site.site_number, [...existing, rowNumber])
  })

  return Array.from(siteNumberMap.entries())
    .filter(([_, rows]) => rows.length > 1)
    .map(([site_number, rows]) => ({ site_number, rows }))
}

/**
 * Validate a single site for business logic
 */
function validateSite(site: ParsedSite, rowNumber: number): ParseError[] {
  const errors: ParseError[] = []

  // Validate site_number is not empty after trimming
  if (!site.site_number || site.site_number.trim() === '') {
    errors.push({
      row: rowNumber,
      field: 'site_number',
      message: 'Site number cannot be empty',
    })
  }

  // Validate site_number length
  if (site.site_number && site.site_number.length > 50) {
    errors.push({
      row: rowNumber,
      field: 'site_number',
      message: 'Site number must be 50 characters or less',
      value: site.site_number,
    })
  }

  // Validate site_name length if provided
  if (site.site_name && site.site_name.length > 255) {
    errors.push({
      row: rowNumber,
      field: 'site_name',
      message: 'Site name must be 255 characters or less',
      value: site.site_name,
    })
  }

  // Validate site_type enum
  if (site.site_type && !siteTypes.includes(site.site_type)) {
    errors.push({
      row: rowNumber,
      field: 'site_type',
      message: `Invalid site type. Must be one of: ${siteTypes.join(', ')}`,
      value: site.site_type,
    })
  }

  // Validate max_occupancy range
  if (site.max_occupancy !== undefined) {
    if (site.max_occupancy < 1) {
      errors.push({
        row: rowNumber,
        field: 'max_occupancy',
        message: 'Max occupancy must be at least 1',
        value: String(site.max_occupancy),
      })
    } else if (site.max_occupancy > 50) {
      errors.push({
        row: rowNumber,
        field: 'max_occupancy',
        message: 'Max occupancy cannot exceed 50',
        value: String(site.max_occupancy),
      })
    }
  }

  // Validate max_vehicles range
  if (site.max_vehicles !== undefined) {
    if (site.max_vehicles < 1) {
      errors.push({
        row: rowNumber,
        field: 'max_vehicles',
        message: 'Max vehicles must be at least 1',
        value: String(site.max_vehicles),
      })
    } else if (site.max_vehicles > 10) {
      errors.push({
        row: rowNumber,
        field: 'max_vehicles',
        message: 'Max vehicles cannot exceed 10',
        value: String(site.max_vehicles),
      })
    }
  }

  // Validate size_sqft is non-negative
  if (site.size_sqft !== null && site.size_sqft !== undefined && site.size_sqft < 0) {
    errors.push({
      row: rowNumber,
      field: 'size_sqft',
      message: 'Size must be a non-negative number',
      value: String(site.size_sqft),
    })
  }

  // Validate base_price only when NOT using property defaults
  // When use_property_defaults is TRUE, the property's nightly rate is used instead
  if (site.use_property_defaults !== true && site.base_price <= 0) {
    errors.push({
      row: rowNumber,
      field: 'base_price',
      message:
        'Base Price must be greater than $0.00 when Use Property Defaults is FALSE',
      value: `$${(site.base_price / 100).toFixed(2)}`,
    })
  }

  // Validate weekend_price is non-negative if provided
  if (site.weekend_price !== null && site.weekend_price !== undefined && site.weekend_price < 0) {
    errors.push({
      row: rowNumber,
      field: 'weekend_price',
      message: 'Weekend price cannot be negative',
      value: `$${(site.weekend_price / 100).toFixed(2)}`,
    })
  }

  // Validate status enum
  if (site.status && !siteStatuses.includes(site.status)) {
    errors.push({
      row: rowNumber,
      field: 'status',
      message: `Invalid status. Must be one of: ${siteStatuses.join(', ')}`,
      value: site.status,
    })
  }

  // Validate description length
  if (site.description && site.description.length > 1000) {
    errors.push({
      row: rowNumber,
      field: 'description',
      message: 'Description must be 1000 characters or less',
      value: `${site.description.substring(0, 50)}...`,
    })
  }

  // Validate hookups array contains valid values
  if (site.hookups && Array.isArray(site.hookups)) {
    const validHookups = ['water', 'electric', 'sewer']
    const invalidHookups = site.hookups.filter((h) => !validHookups.includes(h))
    if (invalidHookups.length > 0) {
      errors.push({
        row: rowNumber,
        field: 'hookups',
        message: `Invalid hookup types: ${invalidHookups.join(', ')}. Must be one of: ${validHookups.join(', ')}`,
        value: site.hookups.join(', '),
      })
    }
  }

  // Validate amenities array contains valid values
  if (site.amenities && Array.isArray(site.amenities)) {
    const validAmenities = [
      'fire_pit',
      'picnic_table',
      'grill',
      'shade',
      'pet_friendly',
      'lake_view',
      'waterfront',
    ]
    const invalidAmenities = site.amenities.filter((a) => !validAmenities.includes(a))
    if (invalidAmenities.length > 0) {
      errors.push({
        row: rowNumber,
        field: 'amenities',
        message: `Invalid amenity types: ${invalidAmenities.join(', ')}`,
        value: site.amenities.join(', '),
      })
    }
  }

  // Validate pet_fee is non-negative if provided
  if (site.pet_fee !== null && site.pet_fee !== undefined && site.pet_fee < 0) {
    errors.push({
      row: rowNumber,
      field: 'pet_fee',
      message: 'Pet fee cannot be negative',
      value: `$${(site.pet_fee / 100).toFixed(2)}`,
    })
  }

  // Validate seasonal_rate is non-negative if provided
  if (site.seasonal_rate !== null && site.seasonal_rate !== undefined && site.seasonal_rate < 0) {
    errors.push({
      row: rowNumber,
      field: 'seasonal_rate',
      message: 'Seasonal rate cannot be negative',
      value: `$${(site.seasonal_rate / 100).toFixed(2)}`,
    })
  }

  // Validate weekly_rate is non-negative if provided
  if (site.weekly_rate !== null && site.weekly_rate !== undefined && site.weekly_rate < 0) {
    errors.push({
      row: rowNumber,
      field: 'weekly_rate',
      message: 'Weekly rate cannot be negative',
      value: `$${(site.weekly_rate / 100).toFixed(2)}`,
    })
  }

  // Validate monthly_rate is non-negative if provided
  if (site.monthly_rate !== null && site.monthly_rate !== undefined && site.monthly_rate < 0) {
    errors.push({
      row: rowNumber,
      field: 'monthly_rate',
      message: 'Monthly rate cannot be negative',
      value: `$${(site.monthly_rate / 100).toFixed(2)}`,
    })
  }

  return errors
}

/**
 * Validate business logic: if allow_pets is true but pet_fee is 0
 * This is a warning, not an error - some properties allow pets for free
 */
function validateBusinessLogic(site: ParsedSite, rowNumber: number): ParseError[] {
  const warnings: ParseError[] = []

  // Weekend price should typically be higher than base price
  if (
    site.weekend_price !== null &&
    site.weekend_price !== undefined &&
    site.weekend_price < site.base_price
  ) {
    warnings.push({
      row: rowNumber,
      field: 'weekend_price',
      message: 'Weekend price is lower than base price (this may be intentional)',
      value: `Weekend: $${(site.weekend_price / 100).toFixed(2)}, Base: $${(site.base_price / 100).toFixed(2)}`,
    })
  }

  return warnings
}

// ============================================================================
// Main Validation
// ============================================================================

/**
 * Validate array of parsed sites
 *
 * Performs comprehensive validation including:
 * - Field validation (types, ranges, formats)
 * - Duplicate detection within CSV
 * - Business logic validation
 *
 * @param sites - Array of parsed sites to validate
 * @param includeWarnings - Include business logic warnings (default: false)
 * @returns Validation result with errors and duplicates
 */
export function validateSites(
  sites: ParsedSite[],
  includeWarnings: boolean = false
): ValidationResult {
  const errors: ParseError[] = []

  // Validate each site
  sites.forEach((site, index) => {
    const rowNumber = index + 1
    const siteErrors = validateSite(site, rowNumber)
    errors.push(...siteErrors)

    if (includeWarnings) {
      const warnings = validateBusinessLogic(site, rowNumber)
      errors.push(...warnings)
    }
  })

  // Check for duplicates
  const duplicates = findDuplicates(sites)

  // Add duplicate errors
  duplicates.forEach((dup) => {
    dup.rows.forEach((row) => {
      errors.push({
        row,
        field: 'site_number',
        message: `Duplicate site number "${dup.site_number}" found in rows: ${dup.rows.join(', ')}`,
        value: dup.site_number,
      })
    })
  })

  return {
    valid: errors.length === 0 && duplicates.length === 0,
    errors,
    duplicates,
  }
}

/**
 * Get summary statistics for validation result
 */
export function getValidationSummary(
  totalRows: number,
  validRowCount: number,
  result: ValidationResult
): {
  totalRows: number
  validRows: number
  invalidRows: number
  duplicateCount: number
  errorCount: number
} {
  return {
    totalRows,
    validRows: validRowCount - result.duplicates.length,
    invalidRows: totalRows - validRowCount,
    duplicateCount: result.duplicates.reduce((sum, dup) => sum + dup.rows.length, 0),
    errorCount: result.errors.length,
  }
}

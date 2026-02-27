/**
 * Pricing Calculator Implementation
 *
 * Calculates reservation pricing based on site rates, occupancy, and dates.
 * Uses a simple calculation approach with support for:
 * - Base nightly rates
 * - Weekend pricing differentials
 * - Pet fees
 * - Extra person fees
 * - Cleaning fees
 * - Tax calculation
 *
 * Note: Complex pricing (seasonal rates, dynamic pricing, ML-based pricing)
 * will be added via IPricingStrategy implementations during Phase 4 migration.
 */

import type { DateRange } from '../value-objects/DateRange'
import type { OccupancyInfo } from '../value-objects/OccupancyInfo'
import type {
  IPricingCalculator,
  PricingInput,
  PricingBreakdown,
  PricingOptions,
  SitePricingConfig,
  PriceLineItem,
} from './IPricingCalculator'

/**
 * Default pet fee in cents ($20.00)
 */
const DEFAULT_PET_FEE = 2000

/**
 * Default tax rate (0% - tax handled externally in most cases)
 */
const DEFAULT_TAX_RATE = 0

export class PricingCalculator implements IPricingCalculator {
  // Site repository would be injected here for database lookups
  // For now, using a simple implementation without DB dependency

  async calculatePrice(
    _input: PricingInput,
    _options?: PricingOptions
  ): Promise<PricingBreakdown> {
    // TODO: Fetch site pricing config from database
    // For now, this requires the calling code to use calculatePriceFromConfig
    // or the existing lib/booking/pricing.ts until full migration

    console.warn(
      '[PricingCalculator.calculatePrice] Not fully implemented. ' +
        'Use calculatePriceFromConfig or lib/booking/pricing.ts for full functionality.'
    )

    // Return placeholder breakdown
    return {
      lineItems: [],
      subtotal: 0,
      taxAmount: 0,
      total: 0,
      currency: 'USD',
    }
  }

  calculatePriceFromConfig(
    siteConfig: SitePricingConfig,
    dateRange: DateRange,
    occupancy: OccupancyInfo,
    options?: PricingOptions
  ): PricingBreakdown {
    const lineItems: PriceLineItem[] = []
    const nights = dateRange.nights

    // Calculate base accommodation
    const { weekdayNights, weekendNights } = this.countNightTypes(dateRange)

    // Weekday nights
    if (weekdayNights > 0) {
      lineItems.push({
        description: 'Weekday nights',
        quantity: weekdayNights,
        unitPrice: siteConfig.basePricePerNight,
        amount: weekdayNights * siteConfig.basePricePerNight,
        category: 'base',
      })
    }

    // Weekend nights (use weekend rate if available, otherwise base rate)
    if (weekendNights > 0) {
      const weekendRate = siteConfig.weekendPricePerNight ?? siteConfig.basePricePerNight
      lineItems.push({
        description: 'Weekend nights (Fri-Sat)',
        quantity: weekendNights,
        unitPrice: weekendRate,
        amount: weekendNights * weekendRate,
        category: 'base',
      })
    }

    // Extra person fees
    if (siteConfig.extraPersonFee && siteConfig.maxGuestsIncluded) {
      const extraGuests = Math.max(0, occupancy.totalPeople - siteConfig.maxGuestsIncluded)
      if (extraGuests > 0) {
        const extraPersonTotal = extraGuests * siteConfig.extraPersonFee * nights
        lineItems.push({
          description: `Extra guest fee (${extraGuests} guest${extraGuests > 1 ? 's' : ''})`,
          quantity: extraGuests * nights,
          unitPrice: siteConfig.extraPersonFee,
          amount: extraPersonTotal,
          category: 'fee',
        })
      }
    }

    // Pet fee (flat fee per stay)
    if (occupancy.hasPets()) {
      const petFee = siteConfig.petFee ?? DEFAULT_PET_FEE
      lineItems.push({
        description: 'Pet fee',
        quantity: 1,
        unitPrice: petFee,
        amount: petFee,
        category: 'fee',
      })
    }

    // Cleaning fee
    if (siteConfig.cleaningFee && siteConfig.cleaningFee > 0) {
      lineItems.push({
        description: 'Cleaning fee',
        quantity: 1,
        unitPrice: siteConfig.cleaningFee,
        amount: siteConfig.cleaningFee,
        category: 'fee',
      })
    }

    // Calculate subtotal
    const subtotal = lineItems.reduce((sum, item) => sum + item.amount, 0)

    // Calculate tax
    const taxRate = options?.taxRate ?? DEFAULT_TAX_RATE
    const taxAmount = options?.includeTax ? Math.round(subtotal * taxRate) : 0

    if (taxAmount > 0) {
      lineItems.push({
        description: `Tax (${(taxRate * 100).toFixed(1)}%)`,
        quantity: 1,
        unitPrice: taxAmount,
        amount: taxAmount,
        category: 'tax',
      })
    }

    return {
      lineItems,
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
      currency: 'USD',
    }
  }

  async getBaseNightlyRate(_siteId: string): Promise<number> {
    // TODO: Fetch from database via site repository
    // For now, return 0 to indicate not implemented
    console.warn(
      '[PricingCalculator.getBaseNightlyRate] Not implemented. ' +
        'Requires Site repository integration.'
    )
    return 0
  }

  /**
   * Count weekday vs weekend nights in a date range
   * Weekend nights are Friday and Saturday (guests stay the night of)
   */
  private countNightTypes(dateRange: DateRange): {
    weekdayNights: number
    weekendNights: number
  } {
    let weekdayNights = 0
    let weekendNights = 0

    const current = new Date(dateRange.checkIn)
    const end = dateRange.checkOut

    while (current < end) {
      const dayOfWeek = current.getDay()
      // Friday = 5, Saturday = 6 are weekend nights
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        weekendNights++
      } else {
        weekdayNights++
      }
      current.setDate(current.getDate() + 1)
    }

    return { weekdayNights, weekendNights }
  }
}

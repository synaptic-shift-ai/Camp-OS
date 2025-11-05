/**
 * Pricing Value Object
 *
 * Represents site pricing information. Immutable value object.
 * Prices are stored in cents to avoid floating point issues.
 *
 * @example
 * ```typescript
 * const pricing = Pricing.create(7500, 9000, 'USD') // $75 base, $90 weekend
 * const total = pricing.calculateTotal(2, true) // 2 nights on weekend
 * ```
 */
import { ValueObject } from '@/shared/domain'

type PricingProps = {
  basePrice: number // Price in cents
  weekendPrice: number // Weekend price in cents
  currency: string
}

export class Pricing extends ValueObject<PricingProps> {
  private constructor(props: PricingProps) {
    super(props)
  }

  /**
   * Create pricing from cents
   */
  static create(
    basePrice: number,
    weekendPrice: number,
    currency: string = 'USD'
  ): Pricing {
    if (basePrice < 0) {
      throw new Error('Base price cannot be negative')
    }
    if (weekendPrice < 0) {
      throw new Error('Weekend price cannot be negative')
    }
    if (!currency || currency.length !== 3) {
      throw new Error('Currency must be a 3-letter code (e.g., USD)')
    }

    return new Pricing({
      basePrice,
      weekendPrice,
      currency: currency.toUpperCase(),
    })
  }

  /**
   * Create pricing from dollars
   */
  static fromDollars(
    basePriceDollars: number,
    weekendPriceDollars: number,
    currency: string = 'USD'
  ): Pricing {
    return Pricing.create(
      Math.round(basePriceDollars * 100),
      Math.round(weekendPriceDollars * 100),
      currency
    )
  }

  get basePrice(): number {
    return this.props.basePrice
  }

  get weekendPrice(): number {
    return this.props.weekendPrice
  }

  get currency(): string {
    return this.props.currency
  }

  /**
   * Get base price in dollars
   */
  getBasePriceInDollars(): number {
    return this.props.basePrice / 100
  }

  /**
   * Get weekend price in dollars
   */
  getWeekendPriceInDollars(): number {
    return this.props.weekendPrice / 100
  }

  /**
   * Calculate total for given nights and weekend status
   */
  calculateTotal(nights: number, isWeekend: boolean): number {
    if (nights < 1) {
      throw new Error('Number of nights must be at least 1')
    }

    const pricePerNight = isWeekend ? this.props.weekendPrice : this.props.basePrice
    return pricePerNight * nights
  }

  /**
   * Check if weekend pricing is higher than base
   */
  hasWeekendSurcharge(): boolean {
    return this.props.weekendPrice > this.props.basePrice
  }

  /**
   * Get the weekend surcharge amount in cents
   */
  getWeekendSurcharge(): number {
    return this.props.weekendPrice - this.props.basePrice
  }

  /**
   * Get the surcharge percentage
   */
  getWeekendSurchargePercentage(): number {
    if (this.props.basePrice === 0) {
      return 0
    }
    return ((this.props.weekendPrice - this.props.basePrice) / this.props.basePrice) * 100
  }

  /**
   * Format price for display
   */
  formatPrice(priceInCents: number): string {
    const dollars = priceInCents / 100
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.props.currency,
    }).format(dollars)
  }

  /**
   * Format base price for display
   */
  formatBasePrice(): string {
    return this.formatPrice(this.props.basePrice)
  }

  /**
   * Format weekend price for display
   */
  formatWeekendPrice(): string {
    return this.formatPrice(this.props.weekendPrice)
  }
}

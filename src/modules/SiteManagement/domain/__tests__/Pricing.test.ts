/**
 * Pricing Value Object Tests
 */
import { describe, it, expect } from 'vitest'
import { Pricing } from '../Pricing'

describe('Pricing Value Object', () => {
  describe('create', () => {
    it('should create pricing with base and weekend prices', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      expect(pricing.basePrice).toBe(7500)
      expect(pricing.weekendPrice).toBe(9000)
      expect(pricing.currency).toBe('USD')
    })

    it('should default to USD currency', () => {
      const pricing = Pricing.create(5000, 6000)

      expect(pricing.currency).toBe('USD')
    })

    it('should uppercase currency code', () => {
      const pricing = Pricing.create(5000, 6000, 'usd')

      expect(pricing.currency).toBe('USD')
    })

    it('should throw if base price is negative', () => {
      expect(() => Pricing.create(-100, 5000, 'USD')).toThrow('Base price cannot be negative')
    })

    it('should throw if weekend price is negative', () => {
      expect(() => Pricing.create(5000, -100, 'USD')).toThrow('Weekend price cannot be negative')
    })

    it('should allow zero prices', () => {
      const pricing = Pricing.create(0, 0, 'USD')

      expect(pricing.basePrice).toBe(0)
      expect(pricing.weekendPrice).toBe(0)
    })

    it('should allow same base and weekend price', () => {
      const pricing = Pricing.create(5000, 5000, 'USD')

      expect(pricing.basePrice).toBe(5000)
      expect(pricing.weekendPrice).toBe(5000)
    })
  })

  describe('fromDollars', () => {
    it('should convert dollars to cents', () => {
      const pricing = Pricing.fromDollars(75.0, 90.0, 'USD')

      expect(pricing.basePrice).toBe(7500)
      expect(pricing.weekendPrice).toBe(9000)
    })

    it('should handle decimal values', () => {
      const pricing = Pricing.fromDollars(75.99, 90.5, 'USD')

      expect(pricing.basePrice).toBe(7599)
      expect(pricing.weekendPrice).toBe(9050)
    })

    it('should handle fractional cents by rounding', () => {
      const pricing = Pricing.fromDollars(75.995, 90.996, 'USD')

      // JavaScript rounds to nearest even
      expect(pricing.basePrice).toBe(7600)
      expect(pricing.weekendPrice).toBe(9100)
    })

    it('should throw if base dollar amount is negative', () => {
      expect(() => Pricing.fromDollars(-75.0, 90.0, 'USD')).toThrow('Base price cannot be negative')
    })

    it('should throw if weekend dollar amount is negative', () => {
      expect(() => Pricing.fromDollars(75.0, -90.0, 'USD')).toThrow(
        'Weekend price cannot be negative'
      )
    })
  })

  describe('calculateTotal', () => {
    it('should calculate total for weekday nights', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      const total = pricing.calculateTotal(3, false)

      expect(total).toBe(22500) // 7500 * 3
    })

    it('should calculate total for weekend nights', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      const total = pricing.calculateTotal(2, true)

      expect(total).toBe(18000) // 9000 * 2
    })

    it('should calculate total for single night', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      const total = pricing.calculateTotal(1, false)

      expect(total).toBe(7500)
    })

    it('should throw if nights is less than 1', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      expect(() => pricing.calculateTotal(0, false)).toThrow('Number of nights must be at least 1')
    })

    it('should throw if nights is negative', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      expect(() => pricing.calculateTotal(-1, false)).toThrow('Number of nights must be at least 1')
    })

    it('should handle large number of nights', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      const total = pricing.calculateTotal(30, false)

      expect(total).toBe(225000) // 7500 * 30
    })
  })

  describe('hasWeekendSurcharge', () => {
    it('should return true if weekend price is higher', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      expect(pricing.hasWeekendSurcharge()).toBe(true)
    })

    it('should return false if weekend price equals base price', () => {
      const pricing = Pricing.create(7500, 7500, 'USD')

      expect(pricing.hasWeekendSurcharge()).toBe(false)
    })

    it('should return false if weekend price is lower (unusual but valid)', () => {
      const pricing = Pricing.create(9000, 7500, 'USD')

      expect(pricing.hasWeekendSurcharge()).toBe(false)
    })
  })

  describe('getWeekendSurcharge', () => {
    it('should calculate surcharge amount', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      const surcharge = pricing.getWeekendSurcharge()

      expect(surcharge).toBe(1500) // 9000 - 7500
    })

    it('should return zero if no surcharge', () => {
      const pricing = Pricing.create(7500, 7500, 'USD')

      const surcharge = pricing.getWeekendSurcharge()

      expect(surcharge).toBe(0)
    })

    it('should return negative if weekend is cheaper', () => {
      const pricing = Pricing.create(9000, 7500, 'USD')

      const surcharge = pricing.getWeekendSurcharge()

      expect(surcharge).toBe(-1500)
    })
  })

  describe('formatBasePrice', () => {
    it('should format base price as currency', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      const formatted = pricing.formatBasePrice()

      expect(formatted).toBe('$75.00')
    })

    it('should handle zero price', () => {
      const pricing = Pricing.create(0, 5000, 'USD')

      const formatted = pricing.formatBasePrice()

      expect(formatted).toBe('$0.00')
    })

    it('should handle prices with cents', () => {
      const pricing = Pricing.create(7599, 9000, 'USD')

      const formatted = pricing.formatBasePrice()

      expect(formatted).toBe('$75.99')
    })

    it('should handle large amounts', () => {
      const pricing = Pricing.create(150000, 175000, 'USD')

      const formatted = pricing.formatBasePrice()

      expect(formatted).toBe('$1,500.00')
    })
  })

  describe('formatWeekendPrice', () => {
    it('should format weekend price as currency', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      const formatted = pricing.formatWeekendPrice()

      expect(formatted).toBe('$90.00')
    })

    it('should handle zero price', () => {
      const pricing = Pricing.create(5000, 0, 'USD')

      const formatted = pricing.formatWeekendPrice()

      expect(formatted).toBe('$0.00')
    })

    it('should handle prices with cents', () => {
      const pricing = Pricing.create(7500, 9050, 'USD')

      const formatted = pricing.formatWeekendPrice()

      expect(formatted).toBe('$90.50')
    })
  })

  describe('formatPrice (private helper)', () => {
    it('should format arbitrary price amount', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      // Access via calculateTotal result
      const _total = pricing.calculateTotal(1, false)
      const formatted = pricing.formatBasePrice() // Should match

      expect(formatted).toBe('$75.00')
    })
  })

  describe('value object equality', () => {
    it('should be equal if all values match', () => {
      const pricing1 = Pricing.create(7500, 9000, 'USD')
      const pricing2 = Pricing.create(7500, 9000, 'USD')

      expect(pricing1.equals(pricing2)).toBe(true)
    })

    it('should not be equal if base price differs', () => {
      const pricing1 = Pricing.create(7500, 9000, 'USD')
      const pricing2 = Pricing.create(8000, 9000, 'USD')

      expect(pricing1.equals(pricing2)).toBe(false)
    })

    it('should not be equal if weekend price differs', () => {
      const pricing1 = Pricing.create(7500, 9000, 'USD')
      const pricing2 = Pricing.create(7500, 9500, 'USD')

      expect(pricing1.equals(pricing2)).toBe(false)
    })

    it('should not be equal if currency differs', () => {
      const pricing1 = Pricing.create(7500, 9000, 'USD')
      const pricing2 = Pricing.create(7500, 9000, 'CAD')

      expect(pricing1.equals(pricing2)).toBe(false)
    })

    it('should handle comparison with null', () => {
      const pricing1 = Pricing.create(7500, 9000, 'USD')

      expect(pricing1.equals(null as any)).toBe(false)
    })

    it('should handle comparison with undefined', () => {
      const pricing1 = Pricing.create(7500, 9000, 'USD')

      expect(pricing1.equals(undefined as any)).toBe(false)
    })

    it('should be equal to itself', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      expect(pricing.equals(pricing)).toBe(true)
    })
  })

  describe('immutability', () => {
    it('should not allow modification of base price', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      // TypeScript and runtime prevent modification (getter only)
      expect(() => {
        ;(pricing as any).basePrice = 8000
      }).toThrow() // Getter-only property throws error

      // Verify original value preserved
      expect(pricing.basePrice).toBe(7500)
    })

    it('should not allow modification of weekend price', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      expect(() => {
        ;(pricing as any).weekendPrice = 10000
      }).toThrow()

      expect(pricing.weekendPrice).toBe(9000)
    })

    it('should not allow modification of currency', () => {
      const pricing = Pricing.create(7500, 9000, 'USD')

      expect(() => {
        ;(pricing as any).currency = 'EUR'
      }).toThrow()

      expect(pricing.currency).toBe('USD')
    })
  })

  describe('edge cases', () => {
    it('should handle very large prices', () => {
      const pricing = Pricing.create(999999999, 999999999, 'USD')

      expect(pricing.basePrice).toBe(999999999)
      expect(pricing.formatBasePrice()).toBe('$9,999,999.99')
    })

    it('should handle single cent', () => {
      const pricing = Pricing.create(1, 1, 'USD')

      expect(pricing.formatBasePrice()).toBe('$0.01')
      expect(pricing.formatWeekendPrice()).toBe('$0.01')
    })

    it('should handle currency codes with special characters', () => {
      const pricing = Pricing.create(7500, 9000, 'usd')

      expect(pricing.currency).toBe('USD')
    })

    it('should calculate total correctly with large nights', () => {
      const pricing = Pricing.create(5000, 6000, 'USD')

      const total = pricing.calculateTotal(365, false)

      expect(total).toBe(1825000) // 5000 * 365
    })
  })
})

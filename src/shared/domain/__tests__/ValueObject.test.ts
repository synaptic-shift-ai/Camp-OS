/**
 * ValueObject Tests
 */
import { describe, it, expect } from 'vitest'
import { ValueObject } from '../ValueObject'

// Test implementations
class Email extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props)
  }

  static create(email: string): Email {
    if (!this.isValid(email)) {
      throw new Error('Invalid email')
    }
    return new Email({ value: email })
  }

  private static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  get value(): string {
    return this.props.value
  }
}

class Money extends ValueObject<{ amount: number; currency: string }> {
  private constructor(props: { amount: number; currency: string }) {
    super(props)
  }

  static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new Error('Amount cannot be negative')
    }
    return new Money({ amount, currency })
  }

  get amount(): number {
    return this.props.amount
  }

  get currency(): string {
    return this.props.currency
  }
}

class Address extends ValueObject<{
  street: string
  city: string
  state: string
  zip: string
}> {
  constructor(street: string, city: string, state: string, zip: string) {
    super({ street, city, state, zip })
  }
}

describe('ValueObject', () => {
  describe('immutability', () => {
    it('should freeze props', () => {
      const email = Email.create('test@example.com')

      expect(() => {
        ;(email as any).props.value = 'changed@example.com'
      }).toThrow()
    })
  })

  describe('equals', () => {
    it('should return true for value objects with same values', () => {
      const email1 = Email.create('test@example.com')
      const email2 = Email.create('test@example.com')

      expect(email1.equals(email2)).toBe(true)
    })

    it('should return false for value objects with different values', () => {
      const email1 = Email.create('test@example.com')
      const email2 = Email.create('other@example.com')

      expect(email1.equals(email2)).toBe(false)
    })

    it('should return false when comparing to null', () => {
      const email = Email.create('test@example.com')

      expect(email.equals(null as any)).toBe(false)
    })

    it('should return false when comparing to undefined', () => {
      const email = Email.create('test@example.com')

      expect(email.equals(undefined as any)).toBe(false)
    })

    it('should handle multiple properties', () => {
      const money1 = Money.create(100, 'USD')
      const money2 = Money.create(100, 'USD')
      const money3 = Money.create(100, 'EUR')
      const money4 = Money.create(200, 'USD')

      expect(money1.equals(money2)).toBe(true)
      expect(money1.equals(money3)).toBe(false) // Different currency
      expect(money1.equals(money4)).toBe(false) // Different amount
    })

    it('should handle complex objects', () => {
      const address1 = new Address('123 Main St', 'City', 'ST', '12345')
      const address2 = new Address('123 Main St', 'City', 'ST', '12345')
      const address3 = new Address('456 Oak Ave', 'City', 'ST', '12345')

      expect(address1.equals(address2)).toBe(true)
      expect(address1.equals(address3)).toBe(false)
    })

    it('should handle Date objects', () => {
      class DateRange extends ValueObject<{ start: Date; end: Date }> {
        constructor(start: Date, end: Date) {
          super({ start, end })
        }
      }

      const date1 = new Date('2025-01-01')
      const date2 = new Date('2025-01-01')
      const date3 = new Date('2025-01-15')

      const range1 = new DateRange(date1, date3)
      const range2 = new DateRange(date2, date3)
      const range3 = new DateRange(date1, date2)

      expect(range1.equals(range2)).toBe(true)
      expect(range1.equals(range3)).toBe(false)
    })

    it('should handle nested value objects', () => {
      class Price extends ValueObject<{ money: Money; taxRate: number }> {
        constructor(money: Money, taxRate: number) {
          super({ money, taxRate })
        }
      }

      const money1 = Money.create(100, 'USD')
      const money2 = Money.create(100, 'USD')
      const money3 = Money.create(200, 'USD')

      const price1 = new Price(money1, 0.1)
      const price2 = new Price(money2, 0.1)
      const price3 = new Price(money3, 0.1)

      expect(price1.equals(price2)).toBe(true) // Same money value
      expect(price1.equals(price3)).toBe(false) // Different money
    })

    it('should handle arrays', () => {
      class Tags extends ValueObject<{ values: string[] }> {
        constructor(values: string[]) {
          super({ values })
        }
      }

      const tags1 = new Tags(['a', 'b', 'c'])
      const tags2 = new Tags(['a', 'b', 'c'])
      const tags3 = new Tags(['a', 'b'])

      expect(tags1.equals(tags2)).toBe(true)
      expect(tags1.equals(tags3)).toBe(false)
    })
  })

  describe('toJSON', () => {
    it('should serialize to plain object', () => {
      const email = Email.create('test@example.com')
      const json = email.toJSON()

      expect(json).toEqual({ value: 'test@example.com' })
    })

    it('should serialize complex objects', () => {
      const money = Money.create(100, 'USD')
      const json = money.toJSON()

      expect(json).toEqual({ amount: 100, currency: 'USD' })
    })
  })

  describe('validation', () => {
    it('should validate on creation', () => {
      expect(() => Email.create('invalid-email')).toThrow('Invalid email')
      expect(() => Email.create('test@example.com')).not.toThrow()
    })

    it('should enforce business rules', () => {
      expect(() => Money.create(-10, 'USD')).toThrow(
        'Amount cannot be negative'
      )
      expect(() => Money.create(10, 'USD')).not.toThrow()
    })
  })
})

import { describe, test, expect } from 'vitest'
import { ConfirmationNumber } from '../value-objects/ConfirmationNumber'

describe('ConfirmationNumber', () => {
  describe('create', () => {
    test('accepts valid CAMP format confirmation number', () => {
      const confirmationNumber = ConfirmationNumber.create('CAMP-2025-A1B2C3')
      
      expect(confirmationNumber.value).toBe('CAMP-2025-A1B2C3')
      expect(confirmationNumber.year).toBe(2025)
      expect(confirmationNumber.suffix).toBe('A1B2C3')
    })

    test('normalizes lowercase input to uppercase', () => {
      const confirmationNumber = ConfirmationNumber.create('camp-2025-a1b2c3')
      
      expect(confirmationNumber.value).toBe('CAMP-2025-A1B2C3')
    })

    test('trims whitespace from input', () => {
      const confirmationNumber = ConfirmationNumber.create('  CAMP-2025-A1B2C3  ')
      
      expect(confirmationNumber.value).toBe('CAMP-2025-A1B2C3')
    })

    test('rejects invalid format - wrong prefix', () => {
      expect(() => ConfirmationNumber.create('RES-123456')).toThrow(
        'Invalid confirmation number format'
      )
    })

    test('rejects invalid format - missing year', () => {
      expect(() => ConfirmationNumber.create('CAMP-A1B2C3')).toThrow(
        'Invalid confirmation number format'
      )
    })

    test('rejects invalid format - wrong suffix length', () => {
      expect(() => ConfirmationNumber.create('CAMP-2025-ABC')).toThrow(
        'Invalid confirmation number format'
      )
    })

    test('rejects empty string', () => {
      expect(() => ConfirmationNumber.create('')).toThrow(
        'Invalid confirmation number format'
      )
    })
  })

  describe('generate', () => {
    test('generates confirmation number in correct format', () => {
      const confirmationNumber = ConfirmationNumber.generate()
      
      expect(confirmationNumber.value).toMatch(/^CAMP-\d{4}-[A-Z0-9]{6}$/)
    })

    test('uses current year', () => {
      const confirmationNumber = ConfirmationNumber.generate()
      const currentYear = new Date().getFullYear()
      
      expect(confirmationNumber.year).toBe(currentYear)
    })

    test('generates unique values', () => {
      const numbers = new Set<string>()
      
      for (let i = 0; i < 100; i++) {
        numbers.add(ConfirmationNumber.generate().value)
      }
      
      // With 6 alphanumeric characters, collisions should be extremely rare
      expect(numbers.size).toBe(100)
    })
  })

  describe('toString', () => {
    test('returns the confirmation number value', () => {
      const confirmationNumber = ConfirmationNumber.create('CAMP-2025-A1B2C3')
      
      expect(confirmationNumber.toString()).toBe('CAMP-2025-A1B2C3')
    })
  })
})

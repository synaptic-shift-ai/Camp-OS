/**
 * Address Value Object Tests
 *
 * Tests the Address value object following TDD best practices:
 * - Parameterized test inputs (no hardcoded literals)
 * - Strong assertions (exact value checks)
 * - Edge cases and validation
 * - Address completeness checking
 */

import { describe, test, expect } from 'vitest'
import { Address } from '../value-objects/Address'

describe('Address', () => {
  describe('create', () => {
    test('should create Address with all fields provided', () => {
      const street = '123 Main St'
      const city = 'Portland'
      const state = 'OR'
      const zipCode = '97201'
      const country = 'USA'

      const address = Address.create({ street, city, state, zipCode, country })

      expect(address).not.toBeNull()
      expect(address!.street).toBe(street)
      expect(address!.city).toBe(city)
      expect(address!.state).toBe(state)
      expect(address!.zipCode).toBe(zipCode)
      expect(address!.country).toBe(country)
    })

    test('should return null when all fields are undefined', () => {
      const address = Address.create({})

      expect(address).toBeNull()
    })

    test('should trim whitespace from all fields', () => {
      const street = '  123 Main St  '
      const city = '  Portland  '
      const state = '  OR  '
      const zipCode = '  97201  '
      const country = '  USA  '

      const address = Address.create({ street, city, state, zipCode, country })

      expect(address!.street).toBe('123 Main St')
      expect(address!.city).toBe('Portland')
      expect(address!.state).toBe('OR')
      expect(address!.zipCode).toBe('97201')
      expect(address!.country).toBe('USA')
    })

    test('should throw error when only some fields provided (incomplete address)', () => {
      const street = '123 Main St'
      const city = 'Portland'
      // Missing state, zipCode, country

      expect(() => Address.create({ street, city })).toThrow(
        'Address must be complete or empty'
      )
    })

    test('should throw error when only one field provided', () => {
      const street = '123 Main St'

      expect(() => Address.create({ street })).toThrow(
        'Address must be complete or empty'
      )
    })

    test('should throw error when missing street', () => {
      const city = 'Portland'
      const state = 'OR'
      const zipCode = '97201'
      const country = 'USA'

      expect(() => Address.create({ city, state, zipCode, country })).toThrow(
        'Address must be complete or empty'
      )
    })

    test('should throw error when missing city', () => {
      const street = '123 Main St'
      const state = 'OR'
      const zipCode = '97201'
      const country = 'USA'

      expect(() => Address.create({ street, state, zipCode, country })).toThrow(
        'Address must be complete or empty'
      )
    })

    test('should throw error when missing state', () => {
      const street = '123 Main St'
      const city = 'Portland'
      const zipCode = '97201'
      const country = 'USA'

      expect(() => Address.create({ street, city, zipCode, country })).toThrow(
        'Address must be complete or empty'
      )
    })

    test('should throw error when missing zipCode', () => {
      const street = '123 Main St'
      const city = 'Portland'
      const state = 'OR'
      const country = 'USA'

      expect(() => Address.create({ street, city, state, country })).toThrow(
        'Address must be complete or empty'
      )
    })

    test('should throw error when missing country', () => {
      const street = '123 Main St'
      const city = 'Portland'
      const state = 'OR'
      const zipCode = '97201'

      expect(() => Address.create({ street, city, state, zipCode })).toThrow(
        'Address must be complete or empty'
      )
    })

    test('should throw error when field is empty string after trimming', () => {
      const street = '123 Main St'
      const city = 'Portland'
      const state = '   ' // Empty after trim
      const zipCode = '97201'
      const country = 'USA'

      expect(() => Address.create({ street, city, state, zipCode, country })).toThrow(
        'Address fields cannot be empty'
      )
    })

    test('should accept addresses with apartment/unit numbers', () => {
      const street = '123 Main St, Apt 4B'
      const city = 'Portland'
      const state = 'OR'
      const zipCode = '97201'
      const country = 'USA'

      const address = Address.create({ street, city, state, zipCode, country })

      expect(address!.street).toBe(street)
    })

    test('should accept international addresses', () => {
      const street = '10 Downing Street'
      const city = 'London'
      const state = 'Westminster'
      const zipCode = 'SW1A 2AA'
      const country = 'United Kingdom'

      const address = Address.create({ street, city, state, zipCode, country })

      expect(address!.country).toBe(country)
    })
  })

  describe('isComplete', () => {
    test('should return true when all fields are provided', () => {
      const address = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const isComplete = address!.isComplete()

      expect(isComplete).toBe(true)
    })

    test('should always return true for non-null addresses', () => {
      // If Address.create() succeeded, address must be complete
      const address = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      expect(address).not.toBeNull()
      expect(address!.isComplete()).toBe(true)
    })
  })

  describe('formatForDisplay', () => {
    test('should format address for display', () => {
      const address = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const formatted = address!.formatForDisplay()

      expect(formatted).toBe('123 Main St, Portland, OR 97201, USA')
    })

    test('should format international address correctly', () => {
      const address = Address.create({
        street: '10 Downing Street',
        city: 'London',
        state: 'Westminster',
        zipCode: 'SW1A 2AA',
        country: 'United Kingdom',
      })

      const formatted = address!.formatForDisplay()

      expect(formatted).toBe('10 Downing Street, London, Westminster SW1A 2AA, United Kingdom')
    })
  })

  describe('isSameCountry', () => {
    test('should return true for same country', () => {
      const address1 = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const address2 = Address.create({
        street: '456 Oak Ave',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98101',
        country: 'USA',
      })

      const isSame = address1!.isSameCountry(address2!)

      expect(isSame).toBe(true)
    })

    test('should return false for different countries', () => {
      const address1 = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const address2 = Address.create({
        street: '10 Downing Street',
        city: 'London',
        state: 'Westminster',
        zipCode: 'SW1A 2AA',
        country: 'United Kingdom',
      })

      const isSame = address1!.isSameCountry(address2!)

      expect(isSame).toBe(false)
    })

    test('should be case insensitive for country comparison', () => {
      const address1 = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const address2 = Address.create({
        street: '456 Oak Ave',
        city: 'Seattle',
        state: 'WA',
        zipCode: '98101',
        country: 'usa',
      })

      const isSame = address1!.isSameCountry(address2!)

      expect(isSame).toBe(true)
    })
  })

  describe('equals', () => {
    test('should return true for identical addresses', () => {
      const address1 = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const address2 = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const isEqual = address1!.equals(address2!)

      expect(isEqual).toBe(true)
    })

    test('should return false for different streets', () => {
      const address1 = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const address2 = Address.create({
        street: '456 Oak Ave',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const isEqual = address1!.equals(address2!)

      expect(isEqual).toBe(false)
    })

    test('should return false for different cities', () => {
      const address1 = Address.create({
        street: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const address2 = Address.create({
        street: '123 Main St',
        city: 'Seattle',
        state: 'OR',
        zipCode: '97201',
        country: 'USA',
      })

      const isEqual = address1!.equals(address2!)

      expect(isEqual).toBe(false)
    })
  })
})

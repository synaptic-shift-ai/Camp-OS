/**
 * PersonName Value Object Tests
 *
 * Tests the PersonName value object following TDD best practices:
 * - Parameterized test inputs (no hardcoded literals)
 * - Strong assertions (exact value checks)
 * - Edge cases and boundaries
 * - Value object equality
 */

import { describe, test, expect } from 'vitest'
import { PersonName } from '../value-objects/PersonName'

describe('PersonName', () => {
  describe('create', () => {
    test('should create PersonName with valid first and last name', () => {
      const firstName = 'John'
      const lastName = 'Doe'

      const name = PersonName.create({ firstName, lastName })

      expect(name.firstName).toBe(firstName)
      expect(name.lastName).toBe(lastName)
    })

    test('should trim whitespace from first and last name', () => {
      const firstName = '  Jane  '
      const lastName = '  Smith  '

      const name = PersonName.create({ firstName, lastName })

      expect(name.firstName).toBe('Jane')
      expect(name.lastName).toBe('Smith')
    })

    test('should throw error when first name is empty', () => {
      const firstName = ''
      const lastName = 'Doe'

      expect(() => PersonName.create({ firstName, lastName })).toThrow(
        'First name cannot be empty'
      )
    })

    test('should throw error when last name is empty', () => {
      const firstName = 'John'
      const lastName = ''

      expect(() => PersonName.create({ firstName, lastName })).toThrow(
        'Last name cannot be empty'
      )
    })

    test('should throw error when first name is only whitespace', () => {
      const firstName = '   '
      const lastName = 'Doe'

      expect(() => PersonName.create({ firstName, lastName })).toThrow(
        'First name cannot be empty'
      )
    })

    test('should throw error when last name is only whitespace', () => {
      const firstName = 'John'
      const lastName = '   '

      expect(() => PersonName.create({ firstName, lastName })).toThrow(
        'Last name cannot be empty'
      )
    })

    test('should accept names with hyphens', () => {
      const firstName = 'Mary-Jane'
      const lastName = 'Parker-Watson'

      const name = PersonName.create({ firstName, lastName })

      expect(name.firstName).toBe(firstName)
      expect(name.lastName).toBe(lastName)
    })

    test('should accept names with apostrophes', () => {
      const firstName = "O'Brien"
      const lastName = "D'Angelo"

      const name = PersonName.create({ firstName, lastName })

      expect(name.firstName).toBe(firstName)
      expect(name.lastName).toBe(lastName)
    })

    test('should accept names with spaces (compound names)', () => {
      const firstName = 'Mary Anne'
      const lastName = 'Van Der Berg'

      const name = PersonName.create({ firstName, lastName })

      expect(name.firstName).toBe(firstName)
      expect(name.lastName).toBe(lastName)
    })

    test('should accept single character names', () => {
      const firstName = 'X'
      const lastName = 'Y'

      const name = PersonName.create({ firstName, lastName })

      expect(name.firstName).toBe(firstName)
      expect(name.lastName).toBe(lastName)
    })

    test('should accept very long names', () => {
      const firstName = 'Christopher'.repeat(5) // 55 characters
      const lastName = 'Montgomery'.repeat(5) // 50 characters

      const name = PersonName.create({ firstName, lastName })

      expect(name.firstName).toBe(firstName)
      expect(name.lastName).toBe(lastName)
    })
  })

  describe('getFullName', () => {
    test('should return full name in "First Last" format', () => {
      const firstName = 'John'
      const lastName = 'Doe'
      const name = PersonName.create({ firstName, lastName })

      const fullName = name.getFullName()

      expect(fullName).toBe('John Doe')
    })

    test('should handle compound names correctly', () => {
      const firstName = 'Mary Anne'
      const lastName = 'Van Der Berg'
      const name = PersonName.create({ firstName, lastName })

      const fullName = name.getFullName()

      expect(fullName).toBe('Mary Anne Van Der Berg')
    })
  })

  describe('getInitials', () => {
    test('should return initials in uppercase', () => {
      const firstName = 'john'
      const lastName = 'doe'
      const name = PersonName.create({ firstName, lastName })

      const initials = name.getInitials()

      expect(initials).toBe('JD')
    })

    test('should use first character of each name', () => {
      const firstName = 'Mary Anne'
      const lastName = 'Smith'
      const name = PersonName.create({ firstName, lastName })

      const initials = name.getInitials()

      expect(initials).toBe('MS')
    })

    test('should handle single character names', () => {
      const firstName = 'X'
      const lastName = 'Y'
      const name = PersonName.create({ firstName, lastName })

      const initials = name.getInitials()

      expect(initials).toBe('XY')
    })
  })

  describe('matches', () => {
    test('should match search term against first name (case insensitive)', () => {
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })

      const matches = name.matches('john')

      expect(matches).toBe(true)
    })

    test('should match search term against last name (case insensitive)', () => {
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })

      const matches = name.matches('doe')

      expect(matches).toBe(true)
    })

    test('should match partial first name', () => {
      const name = PersonName.create({ firstName: 'Jennifer', lastName: 'Smith' })

      const matches = name.matches('jenn')

      expect(matches).toBe(true)
    })

    test('should match partial last name', () => {
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })

      const matches = name.matches('do')

      expect(matches).toBe(true)
    })

    test('should match full name', () => {
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })

      const matches = name.matches('john doe')

      expect(matches).toBe(true)
    })

    test('should not match unrelated search term', () => {
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })

      const matches = name.matches('smith')

      expect(matches).toBe(false)
    })

    test('should match empty string (returns true)', () => {
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })

      const matches = name.matches('')

      expect(matches).toBe(true)
    })
  })

  describe('equals', () => {
    test('should return true for identical names', () => {
      const name1 = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const name2 = PersonName.create({ firstName: 'John', lastName: 'Doe' })

      const isEqual = name1.equals(name2)

      expect(isEqual).toBe(true)
    })

    test('should return false for different first names', () => {
      const name1 = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const name2 = PersonName.create({ firstName: 'Jane', lastName: 'Doe' })

      const isEqual = name1.equals(name2)

      expect(isEqual).toBe(false)
    })

    test('should return false for different last names', () => {
      const name1 = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const name2 = PersonName.create({ firstName: 'John', lastName: 'Smith' })

      const isEqual = name1.equals(name2)

      expect(isEqual).toBe(false)
    })

    test('should be case sensitive for equality', () => {
      const name1 = PersonName.create({ firstName: 'john', lastName: 'doe' })
      const name2 = PersonName.create({ firstName: 'John', lastName: 'Doe' })

      const isEqual = name1.equals(name2)

      expect(isEqual).toBe(false)
    })
  })
})

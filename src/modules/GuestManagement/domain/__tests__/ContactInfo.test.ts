/**
 * ContactInfo Value Object Tests
 *
 * Tests the ContactInfo value object following TDD best practices:
 * - Parameterized test inputs (no hardcoded literals)
 * - Strong assertions (exact value checks)
 * - Edge cases and validation
 * - Email format validation
 */

import { describe, test, expect } from 'vitest'
import { ContactInfo } from '../ContactInfo'

describe('ContactInfo', () => {
  describe('create', () => {
    test('should create ContactInfo with valid email and phone', () => {
      const email = 'john.doe@example.com'
      const phone = '555-0100'

      const contact = ContactInfo.create({ email, phone })

      expect(contact.email).toBe(email)
      expect(contact.phone).toBe(phone)
    })

    test('should normalize email to lowercase', () => {
      const email = 'John.Doe@EXAMPLE.COM'
      const phone = '555-0100'

      const contact = ContactInfo.create({ email, phone })

      expect(contact.email).toBe('john.doe@example.com')
    })

    test('should trim whitespace from email', () => {
      const email = '  john.doe@example.com  '
      const phone = '555-0100'

      const contact = ContactInfo.create({ email, phone })

      expect(contact.email).toBe('john.doe@example.com')
    })

    test('should trim whitespace from phone', () => {
      const email = 'john@example.com'
      const phone = '  555-0100  '

      const contact = ContactInfo.create({ email, phone })

      expect(contact.phone).toBe('555-0100')
    })

    test('should throw error for invalid email format', () => {
      const email = 'not-an-email'
      const phone = '555-0100'

      expect(() => ContactInfo.create({ email, phone })).toThrow(
        'Invalid email format'
      )
    })

    test('should throw error for empty email', () => {
      const email = ''
      const phone = '555-0100'

      expect(() => ContactInfo.create({ email, phone })).toThrow(
        'Email cannot be empty'
      )
    })

    test('should throw error for email with only whitespace', () => {
      const email = '   '
      const phone = '555-0100'

      expect(() => ContactInfo.create({ email, phone })).toThrow(
        'Email cannot be empty'
      )
    })

    test('should throw error for empty phone', () => {
      const email = 'john@example.com'
      const phone = ''

      expect(() => ContactInfo.create({ email, phone })).toThrow(
        'Phone cannot be empty'
      )
    })

    test('should throw error for phone with only whitespace', () => {
      const email = 'john@example.com'
      const phone = '   '

      expect(() => ContactInfo.create({ email, phone })).toThrow(
        'Phone cannot be empty'
      )
    })

    test('should accept email with plus sign', () => {
      const email = 'john+test@example.com'
      const phone = '555-0100'

      const contact = ContactInfo.create({ email, phone })

      expect(contact.email).toBe(email)
    })

    test('should accept email with subdomain', () => {
      const email = 'john@mail.example.com'
      const phone = '555-0100'

      const contact = ContactInfo.create({ email, phone })

      expect(contact.email).toBe(email)
    })

    test('should accept email with dots in local part', () => {
      const email = 'john.doe.smith@example.com'
      const phone = '555-0100'

      const contact = ContactInfo.create({ email, phone })

      expect(contact.email).toBe(email)
    })

    test('should accept various phone formats', () => {
      const testCases = [
        '555-0100',
        '(555) 010-0100',
        '555.010.0100',
        '+1 555 010 0100',
        '5550100',
      ]

      testCases.forEach((phone) => {
        const contact = ContactInfo.create({
          email: 'test@example.com',
          phone,
        })
        expect(contact.phone).toBe(phone)
      })
    })
  })

  describe('create with emergency contact', () => {
    test('should create ContactInfo with emergency contact', () => {
      const email = 'john@example.com'
      const phone = '555-0100'
      const emergencyContactName = 'Jane Doe'
      const emergencyContactPhone = '555-0200'

      const contact = ContactInfo.create({
        email,
        phone,
        emergencyContactName,
        emergencyContactPhone,
      })

      expect(contact.emergencyContactName).toBe(emergencyContactName)
      expect(contact.emergencyContactPhone).toBe(emergencyContactPhone)
    })

    test('should handle undefined emergency contact', () => {
      const email = 'john@example.com'
      const phone = '555-0100'

      const contact = ContactInfo.create({ email, phone })

      expect(contact.emergencyContactName).toBeUndefined()
      expect(contact.emergencyContactPhone).toBeUndefined()
    })

    test('should throw error if emergency contact name provided without phone', () => {
      const email = 'john@example.com'
      const phone = '555-0100'
      const emergencyContactName = 'Jane Doe'

      expect(() =>
        ContactInfo.create({ email, phone, emergencyContactName })
      ).toThrow('Emergency contact phone is required when name is provided')
    })

    test('should throw error if emergency contact phone provided without name', () => {
      const email = 'john@example.com'
      const phone = '555-0100'
      const emergencyContactPhone = '555-0200'

      expect(() =>
        ContactInfo.create({ email, phone, emergencyContactPhone })
      ).toThrow('Emergency contact name is required when phone is provided')
    })

    test('should trim whitespace from emergency contact name', () => {
      const email = 'john@example.com'
      const phone = '555-0100'
      const emergencyContactName = '  Jane Doe  '
      const emergencyContactPhone = '555-0200'

      const contact = ContactInfo.create({
        email,
        phone,
        emergencyContactName,
        emergencyContactPhone,
      })

      expect(contact.emergencyContactName).toBe('Jane Doe')
    })

    test('should trim whitespace from emergency contact phone', () => {
      const email = 'john@example.com'
      const phone = '555-0100'
      const emergencyContactName = 'Jane Doe'
      const emergencyContactPhone = '  555-0200  '

      const contact = ContactInfo.create({
        email,
        phone,
        emergencyContactName,
        emergencyContactPhone,
      })

      expect(contact.emergencyContactPhone).toBe('555-0200')
    })

    test('should throw error for empty emergency contact name', () => {
      const email = 'john@example.com'
      const phone = '555-0100'
      const emergencyContactName = '   '
      const emergencyContactPhone = '555-0200'

      expect(() =>
        ContactInfo.create({
          email,
          phone,
          emergencyContactName,
          emergencyContactPhone,
        })
      ).toThrow('Emergency contact name cannot be empty')
    })

    test('should throw error for empty emergency contact phone', () => {
      const email = 'john@example.com'
      const phone = '555-0100'
      const emergencyContactName = 'Jane Doe'
      const emergencyContactPhone = '   '

      expect(() =>
        ContactInfo.create({
          email,
          phone,
          emergencyContactName,
          emergencyContactPhone,
        })
      ).toThrow('Emergency contact phone cannot be empty')
    })
  })

  describe('isEmailValid', () => {
    test('should return true for valid email', () => {
      const contact = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })

      const isValid = contact.isEmailValid()

      expect(isValid).toBe(true)
    })

    test('should validate email format on construction', () => {
      // Already tested in create() but verifying method exists
      const contact = ContactInfo.create({
        email: 'valid@example.com',
        phone: '555-0100',
      })

      expect(contact.isEmailValid()).toBe(true)
    })
  })

  describe('hasEmergencyContact', () => {
    test('should return true when emergency contact is provided', () => {
      const contact = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '555-0200',
      })

      const hasEmergency = contact.hasEmergencyContact()

      expect(hasEmergency).toBe(true)
    })

    test('should return false when emergency contact is not provided', () => {
      const contact = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })

      const hasEmergency = contact.hasEmergencyContact()

      expect(hasEmergency).toBe(false)
    })
  })

  describe('equals', () => {
    test('should return true for identical contact info', () => {
      const contact1 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })
      const contact2 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })

      const isEqual = contact1.equals(contact2)

      expect(isEqual).toBe(true)
    })

    test('should return false for different emails', () => {
      const contact1 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })
      const contact2 = ContactInfo.create({
        email: 'jane@example.com',
        phone: '555-0100',
      })

      const isEqual = contact1.equals(contact2)

      expect(isEqual).toBe(false)
    })

    test('should return false for different phones', () => {
      const contact1 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })
      const contact2 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0200',
      })

      const isEqual = contact1.equals(contact2)

      expect(isEqual).toBe(false)
    })

    test('should return true for identical emergency contacts', () => {
      const contact1 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '555-0200',
      })
      const contact2 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '555-0200',
      })

      const isEqual = contact1.equals(contact2)

      expect(isEqual).toBe(true)
    })

    test('should return false when one has emergency contact and other does not', () => {
      const contact1 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '555-0200',
      })
      const contact2 = ContactInfo.create({
        email: 'john@example.com',
        phone: '555-0100',
      })

      const isEqual = contact1.equals(contact2)

      expect(isEqual).toBe(false)
    })
  })
})

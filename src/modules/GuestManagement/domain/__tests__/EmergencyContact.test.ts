/**
 * EmergencyContact Value Object Tests
 */
import { describe, it, expect } from 'vitest'
import { EmergencyContact } from '../value-objects/EmergencyContact'

describe('EmergencyContact', () => {
  describe('create', () => {
    it('should create with name and phone', () => {
      const contact = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
      })

      expect(contact.name).toBe('Jane Doe')
      expect(contact.phone).toBe('555-0200')
      expect(contact.relationship).toBeUndefined()
    })

    it('should create with relationship', () => {
      const contact = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
        relationship: 'Spouse',
      })

      expect(contact.name).toBe('Jane Doe')
      expect(contact.phone).toBe('555-0200')
      expect(contact.relationship).toBe('Spouse')
    })

    it('should trim whitespace from all fields', () => {
      const contact = EmergencyContact.create({
        name: '  Jane Doe  ',
        phone: '  555-0200  ',
        relationship: '  Spouse  ',
      })

      expect(contact.name).toBe('Jane Doe')
      expect(contact.phone).toBe('555-0200')
      expect(contact.relationship).toBe('Spouse')
    })

    it('should throw for empty name', () => {
      expect(() =>
        EmergencyContact.create({
          name: '',
          phone: '555-0200',
        })
      ).toThrow('Emergency contact name cannot be empty')
    })

    it('should throw for whitespace-only name', () => {
      expect(() =>
        EmergencyContact.create({
          name: '   ',
          phone: '555-0200',
        })
      ).toThrow('Emergency contact name cannot be empty')
    })

    it('should throw for empty phone', () => {
      expect(() =>
        EmergencyContact.create({
          name: 'Jane Doe',
          phone: '',
        })
      ).toThrow('Emergency contact phone cannot be empty')
    })

    it('should throw for whitespace-only phone', () => {
      expect(() =>
        EmergencyContact.create({
          name: 'Jane Doe',
          phone: '   ',
        })
      ).toThrow('Emergency contact phone cannot be empty')
    })

    it('should ignore empty relationship', () => {
      const contact = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
        relationship: '   ',
      })

      expect(contact.relationship).toBeUndefined()
    })
  })

  describe('fromPersistence', () => {
    it('should create from database values', () => {
      const contact = EmergencyContact.fromPersistence('Jane Doe', '555-0200')

      expect(contact).not.toBeNull()
      expect(contact!.name).toBe('Jane Doe')
      expect(contact!.phone).toBe('555-0200')
    })

    it('should create with relationship from database', () => {
      const contact = EmergencyContact.fromPersistence(
        'Jane Doe',
        '555-0200',
        'Spouse'
      )

      expect(contact).not.toBeNull()
      expect(contact!.relationship).toBe('Spouse')
    })

    it('should return null for null name', () => {
      expect(EmergencyContact.fromPersistence(null, '555-0200')).toBeNull()
    })

    it('should return null for null phone', () => {
      expect(EmergencyContact.fromPersistence('Jane Doe', null)).toBeNull()
    })

    it('should return null for both null', () => {
      expect(EmergencyContact.fromPersistence(null, null)).toBeNull()
    })

    it('should handle null relationship', () => {
      const contact = EmergencyContact.fromPersistence(
        'Jane Doe',
        '555-0200',
        null
      )

      expect(contact).not.toBeNull()
      expect(contact!.relationship).toBeUndefined()
    })
  })

  describe('toPersistence', () => {
    it('should convert to database format', () => {
      const contact = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
      })
      const persistence = contact.toPersistence()

      expect(persistence).toEqual({
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '555-0200',
        emergency_contact_relationship: null,
      })
    })

    it('should include relationship in persistence', () => {
      const contact = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
        relationship: 'Spouse',
      })
      const persistence = contact.toPersistence()

      expect(persistence.emergency_contact_relationship).toBe('Spouse')
    })
  })

  describe('toString', () => {
    it('should format without relationship', () => {
      const contact = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
      })

      expect(contact.toString()).toBe('Jane Doe (555-0200)')
    })

    it('should format with relationship', () => {
      const contact = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
        relationship: 'Spouse',
      })

      expect(contact.toString()).toBe('Jane Doe (555-0200) - Spouse')
    })
  })

  describe('equals', () => {
    it('should return true for equal contacts', () => {
      const c1 = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
      })
      const c2 = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
      })

      expect(c1.equals(c2)).toBe(true)
    })

    it('should return false for different names', () => {
      const c1 = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
      })
      const c2 = EmergencyContact.create({
        name: 'John Doe',
        phone: '555-0200',
      })

      expect(c1.equals(c2)).toBe(false)
    })

    it('should return false for different phones', () => {
      const c1 = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0200',
      })
      const c2 = EmergencyContact.create({
        name: 'Jane Doe',
        phone: '555-0300',
      })

      expect(c1.equals(c2)).toBe(false)
    })
  })
})

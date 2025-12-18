/**
 * PetPolicy Value Object Tests
 */
import { describe, it, expect } from 'vitest'
import { PetPolicy } from '../PetPolicy'

describe('PetPolicy', () => {
  describe('create', () => {
    it('should create a pet-friendly policy with fee', () => {
      const policy = PetPolicy.create(true, 2500)

      expect(policy.allowPets).toBe(true)
      expect(policy.petFee).toBe(2500)
      expect(policy.petFeeInDollars).toBe(25)
    })

    it('should create a pet-friendly policy without fee', () => {
      const policy = PetPolicy.create(true)

      expect(policy.allowPets).toBe(true)
      expect(policy.petFee).toBeNull()
      expect(policy.petFeeInDollars).toBeNull()
    })

    it('should create a no-pets policy', () => {
      const policy = PetPolicy.create(false)

      expect(policy.allowPets).toBe(false)
      expect(policy.petFee).toBeNull()
      expect(policy.maxPets).toBeNull()
      expect(policy.restrictions).toBeNull()
    })

    it('should nullify fee and restrictions when pets not allowed', () => {
      const policy = PetPolicy.create(false, 1000, 2, 'Some restriction')

      expect(policy.allowPets).toBe(false)
      expect(policy.petFee).toBeNull()
      expect(policy.maxPets).toBeNull()
      expect(policy.restrictions).toBeNull()
    })

    it('should throw if pet fee is negative', () => {
      expect(() => PetPolicy.create(true, -100)).toThrow('Pet fee cannot be negative')
    })

    it('should throw if max pets is negative', () => {
      expect(() => PetPolicy.create(true, null, -1)).toThrow(
        'Max pets cannot be negative'
      )
    })

    it('should trim restrictions', () => {
      const policy = PetPolicy.create(true, 1000, 2, '  Dogs only  ')

      expect(policy.restrictions).toBe('Dogs only')
    })
  })

  describe('factory methods', () => {
    it('noPets should create policy that disallows pets', () => {
      const policy = PetPolicy.noPets()

      expect(policy.allowPets).toBe(false)
    })

    it('petsAllowed should create policy that allows pets', () => {
      const policy = PetPolicy.petsAllowed(3000)

      expect(policy.allowPets).toBe(true)
      expect(policy.petFee).toBe(3000)
    })
  })

  describe('hasFee', () => {
    it('should return true when fee is positive', () => {
      const policy = PetPolicy.create(true, 2500)

      expect(policy.hasFee()).toBe(true)
    })

    it('should return false when fee is zero', () => {
      const policy = PetPolicy.create(true, 0)

      expect(policy.hasFee()).toBe(false)
    })

    it('should return false when fee is null', () => {
      const policy = PetPolicy.create(true, null)

      expect(policy.hasFee()).toBe(false)
    })
  })

  describe('equals', () => {
    it('should return true for equal policies', () => {
      const policy1 = PetPolicy.create(true, 2500, 2, 'Dogs only')
      const policy2 = PetPolicy.create(true, 2500, 2, 'Dogs only')

      expect(policy1.equals(policy2)).toBe(true)
    })

    it('should return false for different allowPets', () => {
      const policy1 = PetPolicy.create(true, 2500)
      const policy2 = PetPolicy.create(false)

      expect(policy1.equals(policy2)).toBe(false)
    })

    it('should return false for different fees', () => {
      const policy1 = PetPolicy.create(true, 2500)
      const policy2 = PetPolicy.create(true, 3000)

      expect(policy1.equals(policy2)).toBe(false)
    })
  })

  describe('fromPersistence', () => {
    it('should create from database values', () => {
      const policy = PetPolicy.fromPersistence(true, 2500)

      expect(policy.allowPets).toBe(true)
      expect(policy.petFee).toBe(2500)
    })

    it('should handle null pet fee', () => {
      const policy = PetPolicy.fromPersistence(true, null)

      expect(policy.allowPets).toBe(true)
      expect(policy.petFee).toBeNull()
    })
  })

  describe('toPersistence', () => {
    it('should convert to database format', () => {
      const policy = PetPolicy.create(true, 2500)
      const persistence = policy.toPersistence()

      expect(persistence).toEqual({
        allow_pets: true,
        pet_fee: 2500,
      })
    })
  })
})

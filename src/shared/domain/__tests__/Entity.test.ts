/**
 * Entity Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { Entity } from '../Entity'

// Test implementation of Entity
class TestEntity extends Entity<string> {
  constructor(
    id: string,
    private _name: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt)
  }

  get name(): string {
    return this._name
  }

  updateName(newName: string): void {
    this._name = newName
    this.touch()
  }
}

describe('Entity', () => {
  let entity1: TestEntity
  let entity2: TestEntity
  let entity3: TestEntity

  beforeEach(() => {
    entity1 = new TestEntity('id-1', 'Entity 1')
    entity2 = new TestEntity('id-1', 'Entity 1 (duplicate)')
    entity3 = new TestEntity('id-2', 'Entity 2')
  })

  describe('constructor', () => {
    it('should create an entity with an ID', () => {
      expect(entity1.id).toBe('id-1')
    })

    it('should set createdAt to now if not provided', () => {
      const now = Date.now()
      const entity = new TestEntity('test-id', 'Test')

      expect(entity.createdAt.getTime()).toBeGreaterThanOrEqual(now)
      expect(entity.createdAt.getTime()).toBeLessThanOrEqual(Date.now())
    })

    it('should use provided createdAt date', () => {
      const customDate = new Date('2025-01-01')
      const entity = new TestEntity('test-id', 'Test', customDate)

      expect(entity.createdAt).toEqual(customDate)
    })

    it('should set updatedAt to now if not provided', () => {
      const now = Date.now()
      const entity = new TestEntity('test-id', 'Test')

      expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(now)
      expect(entity.updatedAt.getTime()).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('id getter', () => {
    it('should return the entity ID', () => {
      expect(entity1.id).toBe('id-1')
      expect(entity3.id).toBe('id-2')
    })
  })

  describe('equals', () => {
    it('should return true for entities with same ID', () => {
      expect(entity1.equals(entity2)).toBe(true)
    })

    it('should return false for entities with different IDs', () => {
      expect(entity1.equals(entity3)).toBe(false)
    })

    it('should return true when comparing entity to itself', () => {
      expect(entity1.equals(entity1)).toBe(true)
    })

    it('should return false when comparing to null', () => {
      expect(entity1.equals(null as any)).toBe(false)
    })

    it('should return false when comparing to undefined', () => {
      expect(entity1.equals(undefined)).toBe(false)
    })

    it('should return false when comparing to non-entity', () => {
      expect(entity1.equals({} as any)).toBe(false)
    })
  })

  describe('isSame', () => {
    it('should return true only for same reference', () => {
      expect(entity1.isSame(entity1)).toBe(true)
    })

    it('should return false for different references even with same ID', () => {
      expect(entity1.isSame(entity2)).toBe(false)
    })

    it('should return false for null', () => {
      expect(entity1.isSame(null as any)).toBe(false)
    })
  })

  describe('touch', () => {
    it('should update the updatedAt timestamp', async () => {
      const originalUpdatedAt = entity1.updatedAt

      // Wait a bit to ensure time difference
      await new Promise((resolve) => setTimeout(resolve, 10))

      entity1.updateName('New Name')

      expect(entity1.updatedAt.getTime()).toBeGreaterThan(
        originalUpdatedAt.getTime()
      )
    })
  })

  describe('timestamps', () => {
    it('should provide createdAt getter', () => {
      const entity = new TestEntity('test-id', 'Test')
      expect(entity.createdAt).toBeInstanceOf(Date)
    })

    it('should provide updatedAt getter', () => {
      const entity = new TestEntity('test-id', 'Test')
      expect(entity.updatedAt).toBeInstanceOf(Date)
    })

    it('should have updatedAt >= createdAt initially', () => {
      const entity = new TestEntity('test-id', 'Test')
      expect(entity.updatedAt.getTime()).toBeGreaterThanOrEqual(
        entity.createdAt.getTime()
      )
    })
  })
})

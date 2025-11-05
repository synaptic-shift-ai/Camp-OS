/**
 * AggregateRoot Tests
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { AggregateRoot } from '../AggregateRoot'
import { DomainEvent } from '../DomainEvent'

// Test domain events
class TestCreatedEvent extends DomainEvent {
  constructor(public readonly entityId: string) {
    super()
  }
}

class TestUpdatedEvent extends DomainEvent {
  constructor(
    public readonly entityId: string,
    public readonly field: string
  ) {
    super()
  }
}

// Test aggregate
class TestAggregate extends AggregateRoot<string> {
  constructor(id: string, private _status: string = 'pending') {
    super(id)
  }

  static create(id: string): TestAggregate {
    const aggregate = new TestAggregate(id)
    aggregate.addDomainEvent(new TestCreatedEvent(id))
    return aggregate
  }

  updateStatus(newStatus: string): void {
    this._status = newStatus
    this.touch()
    this.addDomainEvent(new TestUpdatedEvent(this.id, 'status'))
  }

  get status(): string {
    return this._status
  }
}

describe('AggregateRoot', () => {
  let aggregate: TestAggregate

  beforeEach(() => {
    aggregate = TestAggregate.create('test-id')
  })

  describe('domain events', () => {
    it('should collect domain events', () => {
      const events = aggregate.getDomainEvents()

      expect(events).toHaveLength(1)
      expect(events[0]).toBeInstanceOf(TestCreatedEvent)
      expect((events[0] as TestCreatedEvent).entityId).toBe('test-id')
    })

    it('should accumulate multiple events', () => {
      aggregate.updateStatus('active')
      aggregate.updateStatus('completed')

      const events = aggregate.getDomainEvents()

      expect(events).toHaveLength(3) // Created + 2 updates
    })

    it('should return a copy of events array', () => {
      const events1 = aggregate.getDomainEvents()
      const events2 = aggregate.getDomainEvents()

      // Should return a new array each time (not same reference)
      expect(events1).not.toBe(events2)

      // But with same contents
      expect(events1).toHaveLength(events2.length)
      expect(events1[0]).toBe(events2[0])
    })

    it('should clear domain events', () => {
      expect(aggregate.getDomainEvents()).toHaveLength(1)

      aggregate.clearDomainEvents()

      expect(aggregate.getDomainEvents()).toHaveLength(0)
    })

    it('should check if has domain events', () => {
      expect(aggregate.hasDomainEvents()).toBe(true)

      aggregate.clearDomainEvents()

      expect(aggregate.hasDomainEvents()).toBe(false)
    })

    it('should allow adding events after clearing', () => {
      aggregate.clearDomainEvents()
      aggregate.updateStatus('active')

      expect(aggregate.getDomainEvents()).toHaveLength(1)
    })
  })

  describe('inheritance from Entity', () => {
    it('should have entity properties', () => {
      expect(aggregate.id).toBe('test-id')
      expect(aggregate.createdAt).toBeInstanceOf(Date)
      expect(aggregate.updatedAt).toBeInstanceOf(Date)
    })

    it('should support equals', () => {
      const aggregate1 = TestAggregate.create('id-1')
      const aggregate2 = TestAggregate.create('id-1')
      const aggregate3 = TestAggregate.create('id-2')

      expect(aggregate1.equals(aggregate2)).toBe(true)
      expect(aggregate1.equals(aggregate3)).toBe(false)
    })

    it('should update timestamps', async () => {
      const originalUpdated = aggregate.updatedAt

      await new Promise((resolve) => setTimeout(resolve, 10))

      aggregate.updateStatus('active')

      expect(aggregate.updatedAt.getTime()).toBeGreaterThan(
        originalUpdated.getTime()
      )
    })
  })

  describe('typical usage pattern', () => {
    it('should follow create -> modify -> save -> publish events pattern', () => {
      // 1. Create aggregate
      const reservation = TestAggregate.create('res-123')

      // 2. Perform business operation
      reservation.updateStatus('confirmed')

      // 3. Check events before saving
      expect(reservation.hasDomainEvents()).toBe(true)
      const events = reservation.getDomainEvents()
      expect(events).toHaveLength(2) // Created + Updated

      // 4. After saving to database, publish events
      // (This would be done by repository in real code)
      const eventsToPublish = reservation.getDomainEvents()

      // 5. Clear events after publishing
      reservation.clearDomainEvents()
      expect(reservation.hasDomainEvents()).toBe(false)

      // Events still exist in our local copy
      expect(eventsToPublish).toHaveLength(2)
    })
  })
})

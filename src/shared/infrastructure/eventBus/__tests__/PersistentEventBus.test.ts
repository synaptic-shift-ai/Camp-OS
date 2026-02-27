/**
 * PersistentEventBus Tests
 *
 * Tests for the PersistentEventBus implementation.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { PersistentEventBus } from '../PersistentEventBus'
import { DomainEvent } from '../../../domain/DomainEvent'
import type { IEventStoreRepository, StoredEvent } from '../../eventStore/IEventStoreRepository'
import type { ILogger } from '../../logging/ILogger'

// Test event classes
class TestEvent extends DomainEvent {
  constructor(public readonly testId: string) {
    super()
  }
}

class AnotherTestEvent extends DomainEvent {
  constructor(public readonly anotherId: string) {
    super()
  }
}

// Mock implementations
function createMockEventStore(): IEventStoreRepository {
  return {
    append: vi.fn().mockResolvedValue({
      id: 'stored-1',
      eventId: 'event-1',
      eventType: 'TestEvent',
      aggregateId: null,
      aggregateType: null,
      payload: {},
      metadata: {},
      occurredAt: new Date(),
      createdAt: new Date(),
    } as StoredEvent),
    appendAll: vi.fn().mockResolvedValue([]),
    getByAggregateId: vi.fn().mockResolvedValue([]),
    getByEventType: vi.fn().mockResolvedValue([]),
    getByDateRange: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    getByEventId: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
  }
}

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn().mockReturnThis(),
    setLevel: vi.fn(),
    getLevel: vi.fn().mockReturnValue('info'),
  }
}

describe('PersistentEventBus', () => {
  let eventStore: IEventStoreRepository
  let logger: ILogger
  let eventBus: PersistentEventBus

  beforeEach(() => {
    eventStore = createMockEventStore()
    logger = createMockLogger()
    eventBus = new PersistentEventBus(eventStore, logger)
  })

  describe('publish', () => {
    test('should persist event to store and dispatch to subscribers', async () => {
      const handler = vi.fn()
      eventBus.subscribe(TestEvent, handler)

      const event = new TestEvent('test-123')
      await eventBus.publish(event)

      // Event should be persisted
      expect(eventStore.append).toHaveBeenCalledTimes(1)
      expect(eventStore.append).toHaveBeenCalledWith(
        event,
        expect.objectContaining({
          metadata: expect.any(Object),
        })
      )

      // Handler should be called
      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(event)
    })

    test('should include aggregate info when provided', async () => {
      const event = new TestEvent('test-123')
      await eventBus.publish(event, {
        aggregateId: 'agg-456',
        aggregateType: 'TestAggregate',
      })

      expect(eventStore.append).toHaveBeenCalledWith(
        event,
        expect.objectContaining({
          aggregateId: 'agg-456',
          aggregateType: 'TestAggregate',
        })
      )
    })

    test('should merge metadata with default metadata', async () => {
      const eventBusWithDefaults = new PersistentEventBus(eventStore, logger, {
        defaultMetadata: { service: 'test-service', env: 'test' },
      })

      const event = new TestEvent('test-123')
      await eventBusWithDefaults.publish(event, {
        metadata: { correlationId: 'corr-789' },
      })

      expect(eventStore.append).toHaveBeenCalledWith(
        event,
        expect.objectContaining({
          metadata: expect.objectContaining({
            service: 'test-service',
            env: 'test',
            correlationId: 'corr-789',
          }),
        })
      )
    })

    test('should skip persistence when skipPersistence is true', async () => {
      const handler = vi.fn()
      eventBus.subscribe(TestEvent, handler)

      const event = new TestEvent('test-123')
      await eventBus.publish(event, { skipPersistence: true })

      // Event should NOT be persisted
      expect(eventStore.append).not.toHaveBeenCalled()

      // Handler should still be called
      expect(handler).toHaveBeenCalledTimes(1)
    })

    test('should continue dispatching if persistence fails (default behavior)', async () => {
      const mockAppend = eventStore.append as ReturnType<typeof vi.fn>
      mockAppend.mockRejectedValueOnce(new Error('Database error'))

      const handler = vi.fn()
      eventBus.subscribe(TestEvent, handler)

      const event = new TestEvent('test-123')
      await eventBus.publish(event)

      // Error should be logged
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to persist event',
        expect.objectContaining({
          eventType: 'TestEvent',
          error: 'Database error',
        })
      )

      // Handler should still be called
      expect(handler).toHaveBeenCalledTimes(1)
    })

    test('should throw if persistence fails and failOnPersistError is true', async () => {
      const failingEventBus = new PersistentEventBus(eventStore, logger, {
        failOnPersistError: true,
      })

      const mockAppend = eventStore.append as ReturnType<typeof vi.fn>
      mockAppend.mockRejectedValueOnce(new Error('Database error'))

      const handler = vi.fn()
      failingEventBus.subscribe(TestEvent, handler)

      const event = new TestEvent('test-123')
      await expect(failingEventBus.publish(event)).rejects.toThrow('Database error')

      // Handler should NOT be called since we threw
      expect(handler).not.toHaveBeenCalled()
    })

    test('should log successful persistence at debug level', async () => {
      const event = new TestEvent('test-123')
      await eventBus.publish(event, { aggregateId: 'agg-456' })

      expect(logger.debug).toHaveBeenCalledWith(
        'Event persisted',
        expect.objectContaining({
          eventType: 'TestEvent',
          aggregateId: 'agg-456',
        })
      )
    })
  })

  describe('publishAll', () => {
    test('should publish all events in sequence', async () => {
      const handler = vi.fn()
      eventBus.subscribe(TestEvent, handler)

      const event1 = new TestEvent('test-1')
      const event2 = new TestEvent('test-2')
      const event3 = new TestEvent('test-3')

      await eventBus.publishAll([event1, event2, event3])

      expect(eventStore.append).toHaveBeenCalledTimes(3)
      expect(handler).toHaveBeenCalledTimes(3)
    })

    test('should apply options to all events', async () => {
      const event1 = new TestEvent('test-1')
      const event2 = new TestEvent('test-2')

      await eventBus.publishAll([event1, event2], {
        aggregateId: 'agg-shared',
        aggregateType: 'SharedAggregate',
      })

      expect(eventStore.append).toHaveBeenNthCalledWith(
        1,
        event1,
        expect.objectContaining({ aggregateId: 'agg-shared' })
      )
      expect(eventStore.append).toHaveBeenNthCalledWith(
        2,
        event2,
        expect.objectContaining({ aggregateId: 'agg-shared' })
      )
    })
  })

  describe('subscribe', () => {
    test('should call handler when matching event is published', async () => {
      const testHandler = vi.fn()
      const anotherHandler = vi.fn()

      eventBus.subscribe(TestEvent, testHandler)
      eventBus.subscribe(AnotherTestEvent, anotherHandler)

      await eventBus.publish(new TestEvent('test-1'))

      expect(testHandler).toHaveBeenCalledTimes(1)
      expect(anotherHandler).not.toHaveBeenCalled()
    })

    test('should return unsubscribe function', async () => {
      const handler = vi.fn()
      const unsubscribe = eventBus.subscribe(TestEvent, handler)

      await eventBus.publish(new TestEvent('test-1'))
      expect(handler).toHaveBeenCalledTimes(1)

      unsubscribe()

      await eventBus.publish(new TestEvent('test-2'))
      expect(handler).toHaveBeenCalledTimes(1) // Still 1, not called again
    })

    test('should support multiple handlers for same event type', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe(TestEvent, handler1)
      eventBus.subscribe(TestEvent, handler2)

      await eventBus.publish(new TestEvent('test-1'))

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })
  })

  describe('unsubscribe', () => {
    test('should remove handler from subscribers', async () => {
      const handler = vi.fn()
      eventBus.subscribe(TestEvent, handler)

      await eventBus.publish(new TestEvent('test-1'))
      expect(handler).toHaveBeenCalledTimes(1)

      eventBus.unsubscribe(TestEvent, handler)

      await eventBus.publish(new TestEvent('test-2'))
      expect(handler).toHaveBeenCalledTimes(1) // Still 1
    })
  })

  describe('clearSubscribers', () => {
    test('should remove all subscribers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe(TestEvent, handler1)
      eventBus.subscribe(AnotherTestEvent, handler2)

      eventBus.clearSubscribers()

      await eventBus.publish(new TestEvent('test-1'))
      await eventBus.publish(new AnotherTestEvent('another-1'))

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('getSubscriberCount', () => {
    test('should return correct count for event type', () => {
      expect(eventBus.getSubscriberCount(TestEvent)).toBe(0)

      eventBus.subscribe(TestEvent, vi.fn())
      expect(eventBus.getSubscriberCount(TestEvent)).toBe(1)

      eventBus.subscribe(TestEvent, vi.fn())
      expect(eventBus.getSubscriberCount(TestEvent)).toBe(2)
    })

    test('should return 0 for event type with no subscribers', () => {
      eventBus.subscribe(TestEvent, vi.fn())
      expect(eventBus.getSubscriberCount(AnotherTestEvent)).toBe(0)
    })
  })

  describe('error handling in handlers', () => {
    test('should continue processing other handlers if one throws', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('Handler error'))
      const successHandler = vi.fn()

      eventBus.subscribe(TestEvent, failingHandler)
      eventBus.subscribe(TestEvent, successHandler)

      await eventBus.publish(new TestEvent('test-1'))

      expect(failingHandler).toHaveBeenCalledTimes(1)
      expect(successHandler).toHaveBeenCalledTimes(1)
      expect(logger.error).toHaveBeenCalledWith(
        'Error in event handler',
        expect.objectContaining({
          eventType: 'TestEvent',
          error: 'Handler error',
        })
      )
    })
  })
})

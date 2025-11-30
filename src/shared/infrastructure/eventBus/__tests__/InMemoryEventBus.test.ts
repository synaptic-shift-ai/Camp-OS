/**
 * InMemoryEventBus Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InMemoryEventBus } from '../InMemoryEventBus'
import { DomainEvent } from '../../../domain/DomainEvent'

// Test events
class TestEvent extends DomainEvent {
  constructor(public readonly message: string) {
    super()
  }
}

class AnotherTestEvent extends DomainEvent {
  constructor(public readonly value: number) {
    super()
  }
}

describe('InMemoryEventBus', () => {
  let eventBus: InMemoryEventBus

  beforeEach(() => {
    eventBus = new InMemoryEventBus()
  })

  describe('publish/subscribe', () => {
    it('should publish events to subscribers', async () => {
      const handler = vi.fn()

      eventBus.subscribe(TestEvent, handler)
      await eventBus.publish(new TestEvent('Hello'))

      expect(handler).toHaveBeenCalledTimes(1)
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Hello' })
      )
    })

    it('should handle multiple subscribers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe(TestEvent, handler1)
      eventBus.subscribe(TestEvent, handler2)

      await eventBus.publish(new TestEvent('Hello'))

      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should only notify subscribers of matching event type', async () => {
      const testHandler = vi.fn()
      const anotherHandler = vi.fn()

      eventBus.subscribe(TestEvent, testHandler)
      eventBus.subscribe(AnotherTestEvent, anotherHandler)

      await eventBus.publish(new TestEvent('Hello'))

      expect(testHandler).toHaveBeenCalledTimes(1)
      expect(anotherHandler).not.toHaveBeenCalled()
    })

    it('should not throw error when publishing with no subscribers', async () => {
      await expect(
        eventBus.publish(new TestEvent('Hello'))
      ).resolves.not.toThrow()
    })

    it('should support async handlers', async () => {
      const handler = vi.fn(async (event: TestEvent) => {
        await new Promise((resolve) => setTimeout(resolve, 10))
      })

      eventBus.subscribe(TestEvent, handler)
      await eventBus.publish(new TestEvent('Hello'))

      expect(handler).toHaveBeenCalledTimes(1)
    })
  })

  describe('publishAll', () => {
    it('should publish multiple events in sequence', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe(TestEvent, handler1)
      eventBus.subscribe(AnotherTestEvent, handler2)

      await eventBus.publishAll([
        new TestEvent('First'),
        new AnotherTestEvent(42),
        new TestEvent('Second'),
      ])

      expect(handler1).toHaveBeenCalledTimes(2)
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should handle empty event array', async () => {
      await expect(eventBus.publishAll([])).resolves.not.toThrow()
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe handler', async () => {
      const handler = vi.fn()

      eventBus.subscribe(TestEvent, handler)
      await eventBus.publish(new TestEvent('Before'))

      eventBus.unsubscribe(TestEvent, handler)
      await eventBus.publish(new TestEvent('After'))

      expect(handler).toHaveBeenCalledTimes(1) // Only called before unsubscribe
    })

    it('should use unsubscribe function returned by subscribe', async () => {
      const handler = vi.fn()

      const unsubscribe = eventBus.subscribe(TestEvent, handler)
      await eventBus.publish(new TestEvent('Before'))

      unsubscribe()
      await eventBus.publish(new TestEvent('After'))

      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should not affect other subscribers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe(TestEvent, handler1)
      eventBus.subscribe(TestEvent, handler2)

      eventBus.unsubscribe(TestEvent, handler1)

      await eventBus.publish(new TestEvent('Hello'))

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should handle unsubscribing non-existent handler', () => {
      const handler = vi.fn()

      expect(() => {
        eventBus.unsubscribe(TestEvent, handler)
      }).not.toThrow()
    })
  })

  describe('clearSubscribers', () => {
    it('should remove all subscribers', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      eventBus.subscribe(TestEvent, handler1)
      eventBus.subscribe(AnotherTestEvent, handler2)

      eventBus.clearSubscribers()

      await eventBus.publish(new TestEvent('Hello'))
      await eventBus.publish(new AnotherTestEvent(42))

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).not.toHaveBeenCalled()
    })
  })

  describe('getSubscriberCount', () => {
    it('should return correct subscriber count', () => {
      expect(eventBus.getSubscriberCount(TestEvent)).toBe(0)

      eventBus.subscribe(TestEvent, vi.fn())
      expect(eventBus.getSubscriberCount(TestEvent)).toBe(1)

      eventBus.subscribe(TestEvent, vi.fn())
      expect(eventBus.getSubscriberCount(TestEvent)).toBe(2)
    })

    it('should return 0 for event type with no subscribers', () => {
      expect(eventBus.getSubscriberCount(AnotherTestEvent)).toBe(0)
    })
  })

  describe('error handling', () => {
    it('should not throw when handler throws error', async () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler error')
      })
      const normalHandler = vi.fn()

      eventBus.subscribe(TestEvent, errorHandler)
      eventBus.subscribe(TestEvent, normalHandler)

      // Should not throw
      await expect(
        eventBus.publish(new TestEvent('Hello'))
      ).resolves.not.toThrow()

      // Normal handler should still be called
      expect(normalHandler).toHaveBeenCalled()
    })

    it('should not throw when async handler rejects', async () => {
      const errorHandler = vi.fn(async () => {
        throw new Error('Async error')
      })
      const normalHandler = vi.fn()

      eventBus.subscribe(TestEvent, errorHandler)
      eventBus.subscribe(TestEvent, normalHandler)

      await expect(
        eventBus.publish(new TestEvent('Hello'))
      ).resolves.not.toThrow()

      expect(normalHandler).toHaveBeenCalled()
    })

    it('should log errors to console', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const errorHandler = vi.fn(() => {
        throw new Error('Test error')
      })

      eventBus.subscribe(TestEvent, errorHandler)
      await eventBus.publish(new TestEvent('Hello'))

      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('typical usage patterns', () => {
    it('should support module-to-module communication', async () => {
      // Simulate Module A publishing an event
      class OrderCreatedEvent extends DomainEvent {
        constructor(public readonly orderId: string) {
          super()
        }
      }

      // Module B subscribes
      const emailSent = vi.fn()
      eventBus.subscribe(OrderCreatedEvent, async (event) => {
        // Send email
        emailSent(event.orderId)
      })

      // Module C subscribes
      const inventoryUpdated = vi.fn()
      eventBus.subscribe(OrderCreatedEvent, async (event) => {
        // Update inventory
        inventoryUpdated(event.orderId)
      })

      // Module A publishes
      await eventBus.publish(new OrderCreatedEvent('order-123'))

      // Both modules should have been notified
      expect(emailSent).toHaveBeenCalledWith('order-123')
      expect(inventoryUpdated).toHaveBeenCalledWith('order-123')
    })

    it('should support aggregate event publishing after save', async () => {
      const events: DomainEvent[] = [
        new TestEvent('Event 1'),
        new TestEvent('Event 2'),
      ]

      const handler = vi.fn()
      eventBus.subscribe(TestEvent, handler)

      // Simulate repository publishing events after save
      await eventBus.publishAll(events)

      expect(handler).toHaveBeenCalledTimes(2)
    })
  })
})

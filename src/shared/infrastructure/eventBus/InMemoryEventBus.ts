/**
 * InMemoryEventBus Implementation
 *
 * Simple in-memory event bus for pub/sub within the same process.
 * Handlers are executed asynchronously but errors in handlers don't
 * affect other handlers or the publisher.
 *
 * For production at scale, consider:
 * - Redis pub/sub for multi-instance deployments
 * - Message queues (RabbitMQ, AWS SQS) for reliability
 * - Event sourcing with event store
 *
 * @example
 * ```typescript
 * const eventBus = new InMemoryEventBus()
 *
 * // Subscribe
 * eventBus.subscribe(SiteCreatedEvent, async (event) => {
 *   console.log('Site created:', event.siteId)
 * })
 *
 * // Publish
 * await eventBus.publish(new SiteCreatedEvent('site-123'))
 * ```
 */
import {
  IEventBus,
  EventHandler,
  EventConstructor,
} from './IEventBus'
import { DomainEvent } from '../../domain/DomainEvent'

export class InMemoryEventBus implements IEventBus {
  private subscribers: Map<string, Set<EventHandler>> = new Map()

  /**
   * Publish a domain event to all subscribers
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const eventType = event.constructor.name
    const handlers = this.subscribers.get(eventType)

    if (!handlers || handlers.size === 0) {
      // No subscribers - this is not an error
      return
    }

    // Execute all handlers asynchronously
    const promises = Array.from(handlers).map((handler) =>
      this.executeHandler(handler, event)
    )

    // Wait for all handlers to complete
    await Promise.all(promises)
  }

  /**
   * Publish multiple events in sequence
   */
  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event)
    }
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe<T extends DomainEvent>(
    eventType: EventConstructor<T>,
    handler: EventHandler<T>
  ): () => void {
    const eventTypeName = eventType.name

    if (!this.subscribers.has(eventTypeName)) {
      this.subscribers.set(eventTypeName, new Set())
    }

    this.subscribers.get(eventTypeName)!.add(handler as EventHandler)

    // Return unsubscribe function
    return () => this.unsubscribe(eventType, handler)
  }

  /**
   * Unsubscribe a handler from an event type
   */
  unsubscribe<T extends DomainEvent>(
    eventType: EventConstructor<T>,
    handler: EventHandler<T>
  ): void {
    const eventTypeName = eventType.name
    const handlers = this.subscribers.get(eventTypeName)

    if (handlers) {
      handlers.delete(handler as EventHandler)

      // Clean up empty sets
      if (handlers.size === 0) {
        this.subscribers.delete(eventTypeName)
      }
    }
  }

  /**
   * Clear all subscribers (useful for testing)
   */
  clearSubscribers(): void {
    this.subscribers.clear()
  }

  /**
   * Get the number of subscribers for an event type
   */
  getSubscriberCount(eventType: EventConstructor): number {
    const handlers = this.subscribers.get(eventType.name)
    return handlers ? handlers.size : 0
  }

  /**
   * Execute a handler and catch any errors to prevent one handler
   * from breaking others
   */
  private async executeHandler(
    handler: EventHandler,
    event: DomainEvent
  ): Promise<void> {
    try {
      await handler(event)
    } catch (error) {
      // Log error but don't throw - we don't want one handler
      // to break other handlers or the publisher
      console.error(
        `[EventBus] Error in handler for ${event.eventType}:`,
        error
      )

      // In production, you might want to:
      // - Send to error tracking service (Sentry)
      // - Add to dead letter queue for retry
      // - Emit a separate FailedEventHandler event
    }
  }
}

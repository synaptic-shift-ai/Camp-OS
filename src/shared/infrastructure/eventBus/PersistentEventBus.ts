/**
 * PersistentEventBus Implementation
 *
 * Event bus that persists all events to an event store while also
 * dispatching to in-memory subscribers. Provides durability and
 * audit trail for domain events.
 *
 * Features:
 * - Persists events to event store before dispatching
 * - Falls back to in-memory only if persistence fails (configurable)
 * - Supports metadata enrichment (correlation IDs, user context)
 * - Logs persistence failures for monitoring
 *
 * @example
 * ```typescript
 * const eventBus = new PersistentEventBus(eventStore, logger, {
 *   defaultMetadata: { service: 'booking-api' },
 *   failOnPersistError: false, // Continue even if persistence fails
 * })
 *
 * // Events are persisted and then dispatched to subscribers
 * await eventBus.publish(new ReservationCreatedEvent(...), {
 *   aggregateId: 'res-123',
 *   aggregateType: 'Reservation',
 * })
 * ```
 */

import type { IEventBus, EventHandler, EventConstructor } from './IEventBus'
import type { IEventStoreRepository, AppendEventOptions, EventMetadata } from '../eventStore/IEventStoreRepository'
import type { ILogger } from '../logging/ILogger'
import { type DomainEvent } from '../../domain/DomainEvent'

export interface PersistentEventBusOptions {
  /**
   * Default metadata to attach to all events
   */
  defaultMetadata?: EventMetadata

  /**
   * Whether to throw an error if event persistence fails
   * Default: false (log error but continue with in-memory dispatch)
   */
  failOnPersistError?: boolean
}

export interface PublishOptions extends AppendEventOptions {
  /**
   * Skip persistence for this event (useful for re-playing events)
   */
  skipPersistence?: boolean
}

export class PersistentEventBus implements IEventBus {
  private subscribers: Map<string, Set<EventHandler>> = new Map()
  private readonly options: Required<PersistentEventBusOptions>

  constructor(
    private readonly eventStore: IEventStoreRepository,
    private readonly logger: ILogger,
    options: PersistentEventBusOptions = {}
  ) {
    this.options = {
      defaultMetadata: options.defaultMetadata ?? {},
      failOnPersistError: options.failOnPersistError ?? false,
    }
  }

  /**
   * Publish a domain event - persists to store then dispatches to subscribers
   */
  async publish<T extends DomainEvent>(
    event: T,
    options?: PublishOptions
  ): Promise<void> {
    // Step 1: Persist to event store (unless skipped)
    if (!options?.skipPersistence) {
      await this.persistEvent(event, options)
    }

    // Step 2: Dispatch to in-memory subscribers
    await this.dispatchToSubscribers(event)
  }

  /**
   * Publish multiple events in sequence
   * Each event is persisted and dispatched before the next
   */
  async publishAll(
    events: readonly DomainEvent[],
    options?: PublishOptions
  ): Promise<void> {
    for (const event of events) {
      await this.publish(event, options)
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

      if (handlers.size === 0) {
        this.subscribers.delete(eventTypeName)
      }
    }
  }

  /**
   * Clear all subscribers
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
   * Persist event to the event store
   */
  private async persistEvent(
    event: DomainEvent,
    options?: PublishOptions
  ): Promise<void> {
    const mergedMetadata: EventMetadata = {
      ...this.options.defaultMetadata,
      ...options?.metadata,
    }

    try {
      const appendOptions: AppendEventOptions = {
        metadata: mergedMetadata,
      }
      if (options?.aggregateId) {
        appendOptions.aggregateId = options.aggregateId
      }
      if (options?.aggregateType) {
        appendOptions.aggregateType = options.aggregateType
      }
      await this.eventStore.append(event, appendOptions)

      this.logger.debug('Event persisted', {
        eventType: event.eventType,
        eventId: event.eventId,
        aggregateId: options?.aggregateId,
      })
    } catch (error) {
      this.logger.error('Failed to persist event', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      })

      if (this.options.failOnPersistError) {
        throw error
      }
      // Otherwise, continue with in-memory dispatch
    }
  }

  /**
   * Dispatch event to all subscribed handlers
   */
  private async dispatchToSubscribers(event: DomainEvent): Promise<void> {
    const eventType = event.constructor.name
    const handlers = this.subscribers.get(eventType)

    if (!handlers || handlers.size === 0) {
      return
    }

    const promises = Array.from(handlers).map((handler) =>
      this.executeHandler(handler, event)
    )

    await Promise.all(promises)
  }

  /**
   * Execute a handler and catch any errors
   */
  private async executeHandler(
    handler: EventHandler,
    event: DomainEvent
  ): Promise<void> {
    try {
      await handler(event)
    } catch (error) {
      this.logger.error('Error in event handler', {
        eventType: event.eventType,
        eventId: event.eventId,
        error: error instanceof Error ? error.message : String(error),
      })
      // Don't throw - we don't want one handler to break others
    }
  }
}

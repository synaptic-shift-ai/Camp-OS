/**
 * IEventStoreRepository Interface
 *
 * Defines the contract for persisting and retrieving domain events.
 * Used for audit trails, event sourcing, and persistent event bus.
 *
 * @example
 * ```typescript
 * // Store an event
 * await eventStore.append(new ReservationCreatedEvent(...))
 *
 * // Retrieve events for an aggregate
 * const events = await eventStore.getByAggregateId('res-123')
 *
 * // Retrieve events by type
 * const events = await eventStore.getByEventType('ReservationCreatedEvent')
 * ```
 */

import type { DomainEvent } from '../../domain/DomainEvent'

/**
 * Stored event record as persisted in the database
 */
export interface StoredEvent {
  id: string
  eventId: string
  eventType: string
  aggregateId: string | null
  aggregateType: string | null
  payload: Record<string, unknown>
  metadata: EventMetadata
  occurredAt: Date
  createdAt: Date
}

/**
 * Metadata attached to stored events
 */
export interface EventMetadata {
  correlationId?: string
  causationId?: string
  userId?: string
  propertyId?: string
  companyId?: string
  [key: string]: unknown
}

/**
 * Options for appending events
 */
export interface AppendEventOptions {
  aggregateId?: string
  aggregateType?: string
  metadata?: EventMetadata
}

/**
 * Query options for retrieving events
 */
export interface EventQueryOptions {
  limit?: number
  offset?: number
  fromDate?: Date
  toDate?: Date
  orderBy?: 'asc' | 'desc'
}

export interface IEventStoreRepository {
  /**
   * Append a single event to the store
   */
  append(event: DomainEvent, options?: AppendEventOptions): Promise<StoredEvent>

  /**
   * Append multiple events to the store (atomic operation)
   */
  appendAll(
    events: readonly DomainEvent[],
    options?: AppendEventOptions
  ): Promise<StoredEvent[]>

  /**
   * Get all events for an aggregate
   */
  getByAggregateId(
    aggregateId: string,
    options?: EventQueryOptions
  ): Promise<StoredEvent[]>

  /**
   * Get events by event type
   */
  getByEventType(
    eventType: string,
    options?: EventQueryOptions
  ): Promise<StoredEvent[]>

  /**
   * Get events within a time range
   */
  getByDateRange(
    fromDate: Date,
    toDate: Date,
    options?: EventQueryOptions
  ): Promise<StoredEvent[]>

  /**
   * Get a single event by its ID
   */
  getById(id: string): Promise<StoredEvent | null>

  /**
   * Get a single event by its event ID (domain event identifier)
   */
  getByEventId(eventId: string): Promise<StoredEvent | null>

  /**
   * Get the count of events matching criteria
   */
  count(options?: {
    eventType?: string
    aggregateId?: string
    fromDate?: Date
    toDate?: Date
  }): Promise<number>
}

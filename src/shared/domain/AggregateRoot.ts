/**
 * AggregateRoot Base Class
 *
 * Base class for aggregate roots in DDD. An aggregate root:
 * - Is the entry point for a cluster of related entities
 * - Maintains consistency boundaries
 * - Collects domain events that occurred during operations
 * - Ensures business rules are enforced
 *
 * @example
 * ```typescript
 * class Reservation extends AggregateRoot<string> {
 *   constructor(
 *     id: string,
 *     private status: ReservationStatus
 *   ) {
 *     super(id)
 *   }
 *
 *   confirm(): void {
 *     if (this.status !== ReservationStatus.Pending) {
 *       throw new Error('Can only confirm pending reservations')
 *     }
 *
 *     this.status = ReservationStatus.Confirmed
 *     this.touch()
 *
 *     // Record that this happened
 *     this.addDomainEvent(new ReservationConfirmedEvent(this.id))
 *   }
 *
 *   // After saving to database, collect events to publish
 *   const events = reservation.getDomainEvents()
 *   eventBus.publishAll(events)
 *   reservation.clearDomainEvents()
 * }
 * ```
 */
import { Entity } from './Entity'
import { type DomainEvent } from './DomainEvent'

export abstract class AggregateRoot<TId> extends Entity<TId> {
  private _domainEvents: DomainEvent[] = []

  constructor(id: TId, createdAt?: Date, updatedAt?: Date) {
    super(id, createdAt, updatedAt)
  }

  /**
   * Add a domain event that occurred during this operation.
   * Events will be collected and published after the aggregate is saved.
   */
  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event)
  }

  /**
   * Get all domain events that have occurred on this aggregate.
   * Used by the infrastructure layer to publish events after persistence.
   */
  getDomainEvents(): ReadonlyArray<DomainEvent> {
    return [...this._domainEvents]
  }

  /**
   * Clear all domain events.
   * Should be called after events have been published.
   */
  clearDomainEvents(): void {
    this._domainEvents = []
  }

  /**
   * Check if there are any unpublished domain events
   */
  hasDomainEvents(): boolean {
    return this._domainEvents.length > 0
  }
}

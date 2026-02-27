/**
 * IEventBus Interface
 *
 * Defines the contract for publishing and subscribing to domain events.
 * Enables loose coupling between modules through event-driven communication.
 *
 * @example
 * ```typescript
 * // Module A publishes an event
 * const event = new ReservationConfirmedEvent(reservationId)
 * eventBus.publish(event)
 *
 * // Module B subscribes to the event
 * eventBus.subscribe(ReservationConfirmedEvent, async (event) => {
 *   await sendConfirmationEmail(event.reservationId)
 * })
 * ```
 */
import { type DomainEvent } from '../../domain/DomainEvent'

export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T
) => void | Promise<void>

export type EventConstructor<T extends DomainEvent = DomainEvent> = new (
  ...args: any[]
) => T

export interface IEventBus {
  /**
   * Publish a domain event.
   * All subscribers to this event type will be notified.
   */
  publish<T extends DomainEvent>(event: T): Promise<void>

  /**
   * Publish multiple domain events.
   */
  publishAll(events: readonly DomainEvent[]): Promise<void>

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function.
   */
  subscribe<T extends DomainEvent>(
    eventType: EventConstructor<T>,
    handler: EventHandler<T>
  ): () => void

  /**
   * Unsubscribe a handler from an event type.
   */
  unsubscribe<T extends DomainEvent>(
    eventType: EventConstructor<T>,
    handler: EventHandler<T>
  ): void

  /**
   * Clear all subscribers (useful for testing)
   */
  clearSubscribers(): void

  /**
   * Get the number of subscribers for an event type (useful for testing)
   */
  getSubscriberCount(eventType: EventConstructor): number
}

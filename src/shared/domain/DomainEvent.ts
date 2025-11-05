/**
 * DomainEvent Base Class
 *
 * Base class for all domain events. Domain events represent
 * something significant that happened in the domain.
 *
 * Events are used for:
 * - Communication between modules (loose coupling)
 * - Audit trails
 * - Event sourcing (future)
 *
 * @example
 * ```typescript
 * class SiteCreatedEvent extends DomainEvent {
 *   constructor(
 *     public readonly siteId: string,
 *     public readonly propertyId: string,
 *     public readonly siteName: string
 *   ) {
 *     super()
 *   }
 * }
 *
 * // Publish event
 * const event = new SiteCreatedEvent('site-123', 'prop-456', 'Site A')
 * eventBus.publish(event)
 * ```
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date
  public readonly eventId: string

  constructor() {
    this.occurredAt = new Date()
    this.eventId = this.generateEventId()
  }

  /**
   * Get the event type (class name)
   */
  get eventType(): string {
    return this.constructor.name
  }

  /**
   * Generate a unique event ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Convert the event to a plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      occurredAt: this.occurredAt.toISOString(),
      ...this.getPayload(),
    }
  }

  /**
   * Override this to provide event-specific data for serialization
   */
  protected getPayload(): Record<string, unknown> {
    // Default: return all own properties except base class properties
    const payload: Record<string, unknown> = {}
    const ownProps = Object.getOwnPropertyNames(this)

    for (const prop of ownProps) {
      if (prop !== 'occurredAt' && prop !== 'eventId') {
        payload[prop] = (this as any)[prop]
      }
    }

    return payload
  }
}

/**
 * EventBus Exports
 *
 * Central export point for event bus infrastructure.
 */
export type { IEventBus, EventHandler, EventConstructor } from './IEventBus'
export { InMemoryEventBus } from './InMemoryEventBus'
export { PersistentEventBus } from './PersistentEventBus'
export type { PersistentEventBusOptions, PublishOptions } from './PersistentEventBus'

// Singleton instance for application-wide use
import { InMemoryEventBus } from './InMemoryEventBus'
import type { IEventBus } from './IEventBus'

let eventBusInstance: IEventBus | null = null

/**
 * Get the global event bus instance (singleton pattern)
 * By default returns InMemoryEventBus. Use setEventBus() to configure PersistentEventBus.
 */
export function getEventBus(): IEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new InMemoryEventBus()
  }
  return eventBusInstance
}

/**
 * Set a custom event bus instance (e.g., PersistentEventBus)
 */
export function setEventBus(eventBus: IEventBus): void {
  eventBusInstance = eventBus
}

/**
 * Reset the event bus instance (useful for testing)
 */
export function resetEventBus(): void {
  if (eventBusInstance) {
    eventBusInstance.clearSubscribers()
  }
  eventBusInstance = null
}

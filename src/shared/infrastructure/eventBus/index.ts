/**
 * EventBus Exports
 *
 * Central export point for event bus infrastructure.
 */
export type { IEventBus, EventHandler, EventConstructor } from './IEventBus'
export { InMemoryEventBus } from './InMemoryEventBus'

// Singleton instance for application-wide use
import { InMemoryEventBus } from './InMemoryEventBus'

let eventBusInstance: InMemoryEventBus | null = null

/**
 * Get the global event bus instance (singleton pattern)
 */
export function getEventBus(): InMemoryEventBus {
  if (!eventBusInstance) {
    eventBusInstance = new InMemoryEventBus()
  }
  return eventBusInstance
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

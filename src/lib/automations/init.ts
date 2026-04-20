/**
 * Automations Initialization
 *
 * Wires up the PersistentEventBus when the ENABLE_PERSISTENT_EVENT_BUS
 * environment variable is set. Call from app startup (e.g. instrumentation
 * or a layout server component).
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { SupabaseEventStoreRepository } from '@/shared/infrastructure/eventStore'
import { PersistentEventBus } from '@/shared/infrastructure/eventBus'
import { setEventBus } from '@/shared/infrastructure/eventBus'
import { getLogger } from '@/shared/infrastructure/logging'

/**
 * Initialize the automations event bus.
 *
 * When ENABLE_PERSISTENT_EVENT_BUS === 'true', creates a PersistentEventBus
 * backed by the Supabase event_store table. Otherwise the default
 * InMemoryEventBus is used (lazy-created by getEventBus()).
 */
export function initializeAutomations(): void {
  if (process.env.ENABLE_PERSISTENT_EVENT_BUS === 'true') {
    const serviceClient = createServiceRoleClient()
    const eventStore = new SupabaseEventStoreRepository(serviceClient)
    const logger = getLogger()

    const persistentBus = new PersistentEventBus(eventStore, logger)
    setEventBus(persistentBus)

    logger.info('PersistentEventBus initialized')
  } else {
    getLogger().info('Using InMemoryEventBus (default)')
  }
}

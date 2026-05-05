/**
 * Automations Initialization
 *
 * Wires up the PersistentEventBus backed by the Supabase event_store table.
 * Call from app startup (e.g. instrumentation or a layout server component).
 */

import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { SupabaseEventStoreRepository } from '@/shared/infrastructure/eventStore'
import { PersistentEventBus } from '@/shared/infrastructure/eventBus'
import { setEventBus } from '@/shared/infrastructure/eventBus'
import { getLogger } from '@/shared/infrastructure/logging'

/**
 * Initialize the automations event bus.
 *
 * Creates a PersistentEventBus backed by the Supabase event_store table.
 */
export function initializeAutomations(): void {
  const serviceClient = createServiceRoleClient()
  const eventStore = new SupabaseEventStoreRepository(serviceClient)
  const logger = getLogger()

  const persistentBus = new PersistentEventBus(eventStore, logger)
  setEventBus(persistentBus)

  logger.info('PersistentEventBus initialized')
}

// Lazy initialization state
let lazyInitialized = false
let lazyInitPromise: Promise<void> | null = null

/**
 * Ensure automations are initialized and the subscriber is registered.
 *
 * This is a safety net for serverless cold starts where instrumentation.ts
 * may not have run. The first call performs initialization; subsequent calls
 * are no-ops. Thread-safe: concurrent calls share the same promise.
 */
export async function ensureAutomationsInitialized(): Promise<void> {
  if (lazyInitialized) return

  if (!lazyInitPromise) {
    lazyInitPromise = (async () => {
      const logger = getLogger()
      logger.info('[Automations] Lazy initialization starting...')

      initializeAutomations()

      const { registerAutomationSubscriber } = await import('./subscriber')
      registerAutomationSubscriber()

      lazyInitialized = true
      logger.info('[Automations] Lazy initialization complete')
    })()
  }

  return lazyInitPromise
}

/**
 * Automation Subscriber
 *
 * Wires the EventBus to the automations pipeline.
 * Subscribes to domain events and dispatches matching automations.
 */

import { getEventBus } from '@/shared/infrastructure/eventBus'
import type { EventConstructor, EventHandler } from '@/shared/infrastructure/eventBus'
import { matchAutomations, type MatchedAutomation } from './trigger-matcher'
import { buildEventContext } from './event-context'
import { executePipeline } from './pipeline'
import { logAutomationExecution } from './execution-logger'
import { createActionRegistry } from './action-registry'
import { evaluateConditions } from './condition-evaluator'
import { getLogger } from '@/shared/infrastructure/logging'
import type { DomainEvent } from '@/shared/domain/DomainEvent'
import type { ActionHandlerMap } from './action-registry'

// Domain events
import {
  ReservationCreated,
  ReservationConfirmed,
  GuestCheckedIn,
  GuestCheckedOut,
  ReservationCancelled,
  ReservationModified,
  NoShowMarked,
} from '@/modules/BookingEngine/domain/events'
import {
  RefundProcessed,
} from '@/modules/Financial/domain/events'
import {
  MaintenanceTaskCreatedEvent,
  MaintenanceTaskCompletedEvent,
} from '@/modules/Maintenance/domain/events'
import {
  HousekeepingTaskCreatedEvent,
  HousekeepingTaskCompletedEvent,
} from '@/modules/Housekeeping/domain/events'
import { GuestUpdated } from '@/modules/GuestManagement/domain/events'
import {
  SiteStatusChangedEvent,
  SiteMaintenanceStartedEvent,
} from '@/modules/SiteManagement/domain/events'

/** Map domain event class → trigger type string */
const EVENT_TRIGGER_MAP = new Map<string, string>([
  ['ReservationCreated', 'reservation.created'],
  ['ReservationConfirmed', 'reservation.confirmed'],
  ['GuestCheckedIn', 'reservation.checked_in'],
  ['GuestCheckedOut', 'reservation.checked_out'],
  ['ReservationCancelled', 'reservation.cancelled'],
  ['ReservationModified', 'reservation.modified'],
  ['NoShowMarked', 'reservation.no_show'],
  ['RefundProcessed', 'refund.processed'],
  [MaintenanceTaskCreatedEvent.name, 'maintenance.task_created'],
  [MaintenanceTaskCompletedEvent.name, 'maintenance.task_completed'],
  [HousekeepingTaskCreatedEvent.name, 'housekeeping.task_created'],
  [HousekeepingTaskCompletedEvent.name, 'housekeeping.task_completed'],
  [GuestUpdated.name, 'guest.updated'],
  [SiteStatusChangedEvent.name, 'site.status_changed'],
  [SiteMaintenanceStartedEvent.name, 'site.maintenance_started'],
])

/** Events to subscribe to */
const SUBSCRIBED_EVENTS: EventConstructor<DomainEvent>[] = [
  ReservationCreated,
  ReservationConfirmed,
  GuestCheckedIn,
  GuestCheckedOut,
  ReservationCancelled,
  ReservationModified,
  NoShowMarked,
  RefundProcessed,
  MaintenanceTaskCreatedEvent,
  MaintenanceTaskCompletedEvent,
  HousekeepingTaskCreatedEvent,
  HousekeepingTaskCompletedEvent,
  GuestUpdated,
  SiteStatusChangedEvent,
  SiteMaintenanceStartedEvent,
]

// Singleton registry (created once)
let registry: ActionHandlerMap | null = null

function getRegistry(): ActionHandlerMap {
  if (!registry) {
    registry = createActionRegistry()
  }
  return registry
}

/**
 * Create a generic event handler for automations.
 */
function createAutomationHandler(): EventHandler<DomainEvent> {
  return async (event: DomainEvent) => {
    const logger = getLogger()
    const triggerType = EVENT_TRIGGER_MAP.get(event.eventType)

    console.log('[Automations] Event received:', event.eventType, '→ trigger:', triggerType)

    if (!triggerType) {
      logger.debug('[Automations] No trigger mapping for event', {
        eventType: event.eventType,
      })
      return
    }

    try {
      // Build enriched event context FIRST (resolves propertyId + companyId via DB lookups)
      const context = await buildEventContext(event)

      // Extract propertyId and companyId from context
      const propertyId = context.propertyId
      const companyId = context.companyId

      if (!propertyId) {
        logger.debug('[Automations] No propertyId resolved from context, skipping', {
          eventType: event.eventType,
        })
        return
      }

      // Match automations for this trigger + property + company
      const matched = await matchAutomations(triggerType, propertyId, companyId)

      console.log('[Automations] Matched:', matched.length, 'automations for trigger:', triggerType)

      if (matched.length === 0) {
        logger.debug('[Automations] 0 automations matched', {
          triggerType,
          propertyId,
          companyId,
        })
        return
      }

      // Evaluate conditions — filter to ONLY passing automations
      const passingAutomations: MatchedAutomation[] = []
      const evaluationResults: Array<{ ma: MatchedAutomation; passed: boolean }> = []

      for (const ma of matched) {
        const rootGroups = ma.conditionGroups.filter((g) => g.parent_group_id === null)
        const passed = evaluateConditions(
          rootGroups,
          ma.conditionGroups,
          ma.conditions,
          context,
        )
        evaluationResults.push({ ma, passed })
        if (passed) {
          passingAutomations.push(ma)
        }
      }

      if (passingAutomations.length === 0) {
        console.log('[Automations] Passed conditions: 0 /', matched.length)
        logger.debug('[Automations] 0 automations passed conditions', {
          triggerType,
          propertyId,
          total: matched.length,
        })
        // Still log evaluation results for non-passing automations
        for (const { ma, passed } of evaluationResults) {
          try {
            await logAutomationExecution(
              ma.automation,
              context,
              {
                totalDurationMs: 0,
                terminalGuardFired: false,
                phasesSkipped: [],
                phaseResults: new Map(),
              },
              passed,
              0,
            )
          } catch (logErr) {
            logger.error('[Automations] Failed to log execution', {
              automationId: ma.automation.id,
              error: logErr instanceof Error ? logErr.message : String(logErr),
            })
          }
        }
        return
      }

      // Execute pipeline with ONLY passing automations
      const actionRegistry = getRegistry()
      const pipelineStart = Date.now()
      const pipelineResult = await executePipeline(passingAutomations, context, actionRegistry)
      const pipelineDuration = Date.now() - pipelineStart

      // Log results for ALL evaluated automations (passing and non-passing)
      for (const { ma, passed } of evaluationResults) {
        try {
          await logAutomationExecution(
            ma.automation,
            context,
            pipelineResult,
            passed,
            pipelineDuration,
          )
        } catch (logErr) {
          logger.error('[Automations] Failed to log execution', {
            automationId: ma.automation.id,
            error: logErr instanceof Error ? logErr.message : String(logErr),
          })
        }
      }
    } catch (err) {
      // Never throw from subscriber
      logger.error('[Automations] Subscriber error', {
        eventType: event.eventType,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

/**
 * Register the automation subscriber to the global event bus.
 *
 * Subscribes to all relevant domain events and dispatches
 * matching automations through the pipeline.
 */
export function registerAutomationSubscriber(): () => void {
  const bus = getEventBus()
  const handler = createAutomationHandler()
  const unsubscribers: Array<() => void> = []

  for (const EventClass of SUBSCRIBED_EVENTS) {
    const unsub = bus.subscribe(EventClass, handler)
    unsubscribers.push(unsub)
  }

  getLogger().info('[Automations] Subscriber registered', {
    eventCount: SUBSCRIBED_EVENTS.length,
  })

  // Return a function to unsubscribe all
  return () => {
    for (const unsub of unsubscribers) {
      unsub()
    }
    getLogger().info('[Automations] Subscriber unregistered')
  }
}

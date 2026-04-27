/**
 * Automation Subscriber
 *
 * Wires the EventBus to the automations pipeline.
 * Subscribes to domain events and dispatches matching automations.
 */

import { getEventBus } from '@/shared/infrastructure/eventBus'
import type { EventConstructor, EventHandler } from '@/shared/infrastructure/eventBus'
import { matchAutomations } from './trigger-matcher'
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
  PaymentReceived,
  ReservationModified,
  NoShowMarked,
} from '@/modules/BookingEngine/domain/events'
import {
  TransactionRecorded,
  RefundProcessed,
} from '@/modules/Financial/domain/events'
import {
  MaintenanceTaskCreatedEvent,
  MaintenanceTaskCompletedEvent,
} from '@/modules/Maintenance/domain/events'

/** Map domain event class → trigger type string */
const EVENT_TRIGGER_MAP = new Map<string, string>([
  ['ReservationCreated', 'reservation.created'],
  ['ReservationConfirmed', 'reservation.confirmed'],
  ['GuestCheckedIn', 'reservation.checked_in'],
  ['GuestCheckedOut', 'reservation.checked_out'],
  ['ReservationCancelled', 'reservation.cancelled'],
  ['ReservationModified', 'reservation.modified'],
  ['NoShowMarked', 'reservation.no_show'],
  ['PaymentReceived', 'payment.received'],
  ['TransactionRecorded', 'payment.received'],
  ['RefundProcessed', 'refund.processed'],
  [MaintenanceTaskCreatedEvent.name, 'maintenance.task_created'],
  [MaintenanceTaskCompletedEvent.name, 'maintenance.task_completed'],
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
  PaymentReceived,
  TransactionRecorded,
  RefundProcessed,
  MaintenanceTaskCreatedEvent,
  MaintenanceTaskCompletedEvent,
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
 * Extract propertyId from a domain event payload.
 */
function extractPropertyId(event: DomainEvent): string | null {
  const payload = event.toJSON()
  const candidate = payload.propertyId ?? payload.property_id
  if (typeof candidate === 'string' && candidate.length > 0) return candidate
  return null
}

/**
 * Create a generic event handler for automations.
 */
function createAutomationHandler(): EventHandler<DomainEvent> {
  return async (event: DomainEvent) => {
    const logger = getLogger()
    const triggerType = EVENT_TRIGGER_MAP.get(event.eventType)

    if (!triggerType) {
      logger.debug('[Automations] No trigger mapping for event', {
        eventType: event.eventType,
      })
      return
    }

    try {
      const propertyId = extractPropertyId(event)
      if (!propertyId) {
        logger.debug('[Automations] No propertyId on event, skipping', {
          eventType: event.eventType,
        })
        return
      }

      // Match automations for this trigger + property
      const matched = await matchAutomations(triggerType, propertyId)

      if (matched.length === 0) {
        logger.debug('[Automations] 0 automations matched', {
          triggerType,
          propertyId,
        })
        return
      }

      // Build enriched event context
      const context = await buildEventContext(event)

      // Evaluate conditions for each matched automation
      const passingAutomations = []
      for (const ma of matched) {
        const rootGroups = ma.conditionGroups.filter((g) => g.parent_group_id === null)
        const passed = evaluateConditions(
          rootGroups,
          ma.conditionGroups,
          ma.conditions,
          context,
        )
        passingAutomations.push({ ma, passed })
      }

      // Execute pipeline with all matched automations (condition filtering is done inside)
      const actionRegistry = getRegistry()
      const pipelineStart = Date.now()
      const pipelineResult = await executePipeline(matched, context, actionRegistry)
      const pipelineDuration = Date.now() - pipelineStart

      // Log results for each automation
      for (const { ma, passed } of passingAutomations) {
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

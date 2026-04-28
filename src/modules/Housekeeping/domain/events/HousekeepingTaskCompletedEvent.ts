/**
 * HousekeepingTaskCompletedEvent Domain Event
 *
 * Published when a housekeeping task transitions to completed (done) status.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class HousekeepingTaskCompletedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly taskId: string,
    public readonly title: string,
    public readonly siteId: string,
  ) {
    super()
  }
}

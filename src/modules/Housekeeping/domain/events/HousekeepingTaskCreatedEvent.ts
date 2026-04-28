/**
 * HousekeepingTaskCreatedEvent Domain Event
 *
 * Published when a new housekeeping task is created.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class HousekeepingTaskCreatedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly taskId: string,
    public readonly title: string,
    public readonly priority: string,
    public readonly siteId: string | null,
  ) {
    super()
  }
}

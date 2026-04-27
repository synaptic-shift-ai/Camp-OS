/**
 * MaintenanceTaskCreatedEvent Domain Event
 *
 * Published when a new maintenance work order is created.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class MaintenanceTaskCreatedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly taskId: string,
    public readonly woNumber: string,
    public readonly category: string,
    public readonly priority: string,
  ) {
    super()
  }
}

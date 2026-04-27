/**
 * MaintenanceTaskCompletedEvent Domain Event
 *
 * Published when a maintenance work order transitions to completed status.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export class MaintenanceTaskCompletedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly taskId: string,
    public readonly woNumber: string,
    public readonly category: string,
    public readonly actualLaborCost: number,
    public readonly actualPartsCost: number,
  ) {
    super()
  }
}

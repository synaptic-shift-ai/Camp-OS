/**
 * CompanyUpdatedEvent Domain Event
 *
 * Fired when company details are updated.
 */

import { DomainEvent } from '@/shared/domain/DomainEvent'

export interface CompanyUpdatedEventProps {
  companyId: string
  updatedFields: string[]
}

export class CompanyUpdatedEvent extends DomainEvent {
  public readonly companyId: string
  public readonly updatedFields: string[]

  constructor(props: CompanyUpdatedEventProps) {
    super()
    this.companyId = props.companyId
    this.updatedFields = props.updatedFields
  }
}

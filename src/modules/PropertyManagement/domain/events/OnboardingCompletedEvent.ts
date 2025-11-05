/**
 * OnboardingCompletedEvent
 *
 * Domain event published when property onboarding is completed.
 * This is a critical event that triggers property activation.
 */
import { DomainEvent } from '@/shared/domain'

export class OnboardingCompletedEvent extends DomainEvent {
  constructor(
    public readonly propertyId: string,
    public readonly companyId: string,
    public readonly completedAt: Date
  ) {
    super()
  }

  getAggregateId(): string {
    return this.propertyId
  }

  getEventName(): string {
    return 'OnboardingCompleted'
  }

  getEventData(): Record<string, any> {
    return {
      propertyId: this.propertyId,
      companyId: this.companyId,
      completedAt: this.completedAt.toISOString(),
    }
  }
}

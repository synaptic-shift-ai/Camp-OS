/**
 * LinkStripeCustomerCommand
 *
 * Links a Stripe Customer ID to a guest for saved payment methods.
 */

import { Guest } from '../../domain/Guest'
import { IGuestRepository } from '../../domain/IGuestRepository'
import { IEventBus } from '@/shared/infrastructure/eventBus/IEventBus'

export interface LinkStripeCustomerInput {
  guestId: string
  stripeCustomerId: string
}

export class LinkStripeCustomerCommandHandler {
  constructor(
    private readonly repository: IGuestRepository,
    private readonly eventBus: IEventBus
  ) {}

  async execute(input: LinkStripeCustomerInput): Promise<void> {
    // Load guest
    const guest = await this.repository.findById(input.guestId)
    if (!guest) {
      throw new Error(`Guest not found: ${input.guestId}`)
    }

    // Link Stripe customer
    guest.linkStripeCustomer(input.stripeCustomerId)

    // Save changes
    await this.repository.save(guest)

    // Publish domain events
    await this.eventBus.publishAll(guest.getDomainEvents())
    guest.clearDomainEvents()
  }
}

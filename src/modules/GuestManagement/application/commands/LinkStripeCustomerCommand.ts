/**
 * LinkStripeCustomerCommand
 *
 * Links a Stripe Customer ID to a guest for saved payment methods.
 */

import { type IGuestRepository } from '../../domain/IGuestRepository'

export interface LinkStripeCustomerInput {
  guestId: string
  stripeCustomerId: string
}

export class LinkStripeCustomerCommandHandler {
  constructor(
    private readonly repository: IGuestRepository
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

    // Clear domain events
    guest.clearDomainEvents()
  }
}

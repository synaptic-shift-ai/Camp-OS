/**
 * HoldSecurityDepositCommand
 *
 * Holds a security deposit for a reservation.
 */

import type { ISecurityDepositRepository } from '../../domain/repositories/ISecurityDepositRepository'
import { SecurityDeposit } from '../../domain/aggregates/SecurityDeposit'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export interface HoldSecurityDepositDto {
  depositId: string
  propertyId: string
  reservationId: string
  amountCents: number
  stripePaymentIntentId?: string | null
}

export class HoldSecurityDepositCommandHandler {
  constructor(
    private readonly securityDepositRepository: ISecurityDepositRepository
  ) {}

  async execute(dto: HoldSecurityDepositDto): Promise<SecurityDeposit> {
    // Create deposit amount
    const amount = MoneyAmount.create(dto.amountCents)

    // Hold deposit
    const deposit = SecurityDeposit.hold(
      dto.depositId,
      dto.propertyId,
      dto.reservationId,
      amount,
      dto.stripePaymentIntentId || null
    )

    // Save deposit
    await this.securityDepositRepository.save(deposit)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll([...deposit.getDomainEvents()])
    deposit.clearDomainEvents()

    return deposit
  }
}

/**
 * CreatePaymentPlanCommand
 *
 * Creates an installment payment plan for a long-term reservation.
 */

import type { IPaymentPlanRepository } from '../../domain/repositories/IPaymentPlanRepository'
import { PaymentPlan } from '../../domain/aggregates/PaymentPlan'
import { MoneyAmount } from '@/modules/BookingEngine/domain/value-objects/MoneyAmount'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export interface CreatePaymentPlanDto {
  paymentPlanId: string
  propertyId: string
  reservationId: string
  totalAmountCents: number
  numberOfInstallments: number
  installmentIntervalDays: number
  startDate: Date
}

export class CreatePaymentPlanCommandHandler {
  constructor(private readonly paymentPlanRepository: IPaymentPlanRepository) {}

  async execute(dto: CreatePaymentPlanDto): Promise<PaymentPlan> {
    // Create total amount
    const totalAmount = MoneyAmount.create(dto.totalAmountCents)

    // Create payment plan
    const plan = PaymentPlan.create(
      dto.paymentPlanId,
      dto.propertyId,
      dto.reservationId,
      totalAmount,
      dto.numberOfInstallments,
      dto.installmentIntervalDays,
      dto.startDate
    )

    // Save payment plan
    await this.paymentPlanRepository.save(plan)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll([...plan.getDomainEvents()])
    plan.clearDomainEvents()

    return plan
  }
}

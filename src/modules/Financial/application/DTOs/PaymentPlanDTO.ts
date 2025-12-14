/**
 * PaymentPlanDTO
 *
 * Data Transfer Object for PaymentPlan aggregate.
 * Used for API responses.
 */

import type { PaymentPlan } from '../../domain/aggregates/PaymentPlan'

export interface PaymentPlanDTO {
  id: string
  propertyId: string
  reservationId: string
  totalAmountCents: number
  numberOfInstallments: number
  installmentIntervalDays: number
  startDate: string
  invoiceIds: string[]
  status: string
  createdAt: string
  updatedAt: string
}

export function toPaymentPlanDTO(plan: PaymentPlan): PaymentPlanDTO {
  return {
    id: plan.id,
    propertyId: plan.propertyId,
    reservationId: plan.reservationId,
    totalAmountCents: plan.totalAmount.amountInCents,
    numberOfInstallments: plan.numberOfInstallments,
    installmentIntervalDays: plan.installmentIntervalDays,
    startDate: plan.startDate.toISOString(),
    invoiceIds: plan.invoiceIds,
    status: plan.status,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
  }
}

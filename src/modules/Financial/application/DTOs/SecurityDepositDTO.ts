/**
 * SecurityDepositDTO
 *
 * Data Transfer Object for SecurityDeposit aggregate.
 * Used for API responses.
 */

import type { SecurityDeposit, DepositDeduction } from '../../domain/aggregates/SecurityDeposit'

export interface DepositDeductionDTO {
  amountCents: number
  reason: string
  deductedAt: string
  deductedBy: string
}

export interface SecurityDepositDTO {
  id: string
  propertyId: string
  reservationId: string
  depositAmountCents: number
  deductionsCents: number
  releasedAmountCents: number
  availableAmountCents: number
  status: string
  stripePaymentIntentId: string | null
  heldAt: string
  releasedAt: string | null
  forfeitedAt: string | null
  deductions: DepositDeductionDTO[]
  createdAt: string
  updatedAt: string
}

export function toSecurityDepositDTO(deposit: SecurityDeposit): SecurityDepositDTO {
  return {
    id: deposit.id,
    propertyId: deposit.propertyId,
    reservationId: deposit.reservationId,
    depositAmountCents: deposit.depositAmount.amountInCents,
    deductionsCents: deposit.totalDeductions.amountInCents,
    releasedAmountCents: deposit.releasedAmount.amountInCents,
    availableAmountCents: deposit.getAvailableAmount().amountInCents,
    status: deposit.status,
    stripePaymentIntentId: deposit.stripePaymentIntentId,
    heldAt: deposit.heldAt.toISOString(),
    releasedAt: deposit.releasedAt?.toISOString() || null,
    forfeitedAt: deposit.forfeitedAt?.toISOString() || null,
    deductions: deposit.deductions.map((d) => ({
      amountCents: d.amountCents,
      reason: d.reason,
      deductedAt: new Date(d.deductedAt).toISOString(),
      deductedBy: d.deductedBy,
    })),
    createdAt: deposit.createdAt.toISOString(),
    updatedAt: deposit.updatedAt.toISOString(),
  }
}

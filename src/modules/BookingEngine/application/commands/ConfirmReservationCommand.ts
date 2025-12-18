/**
 * ConfirmReservationCommand
 *
 * Command to confirm a reservation.
 * Uses IConfirmationPolicy to validate payment requirements.
 *
 * Policy enforcement happens here at the application layer,
 * keeping the domain model clean and policy-free.
 */
import type { IReservationRepository } from '../../domain/IReservationRepository'
import type { Reservation } from '../../domain/Reservation'
import type { IStrategyProvider } from '../../domain/policies'
import { getEventBus } from '@/shared/infrastructure/eventBus'

export interface ConfirmReservationDto {
  reservationId: string
  requestedBy?: string      // User ID making the request
  isAdminOverride?: boolean // Bypass payment policy (for admin use)
}

export interface ConfirmReservationResult {
  success: true
  reservation: Reservation
}

export interface ConfirmReservationError {
  success: false
  error: {
    code: 'NOT_FOUND' | 'INVALID_STATUS' | 'POLICY_VIOLATION'
    message: string
    policyType?: string | undefined
    minimumRequired?: number | undefined
  }
}

export type ConfirmReservationOutput = ConfirmReservationResult | ConfirmReservationError

export class ConfirmReservationCommandHandler {
  constructor(
    private readonly repository: IReservationRepository,
    private readonly strategyProvider: IStrategyProvider
  ) {}

  async execute(dto: ConfirmReservationDto): Promise<ConfirmReservationOutput> {
    // Find reservation
    const reservation = await this.repository.findById(dto.reservationId)

    if (!reservation) {
      return {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Reservation with ID '${dto.reservationId}' not found`,
        },
      }
    }

    // Check domain-level constraints
    if (!reservation.canBeConfirmed()) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Cannot confirm reservation in status '${reservation.status}'`,
        },
      }
    }

    // Get confirmation policy for this property
    const policy = await this.strategyProvider.getConfirmationPolicy(reservation.propertyId)

    // Evaluate policy
    const policyResult = policy.canConfirm({
      reservation,
      requestedBy: dto.requestedBy,
      isAdminOverride: dto.isAdminOverride,
    })

    if (!policyResult.allowed) {
      return {
        success: false,
        error: {
          code: 'POLICY_VIOLATION',
          message: policyResult.reason,
          policyType: policy.policyType,
          minimumRequired: policyResult.minimumRequired?.amountInCents,
        },
      }
    }

    // Policy passed - confirm the reservation
    reservation.confirm()

    // Save updated reservation
    await this.repository.save(reservation)

    // Publish domain events
    const eventBus = getEventBus()
    await eventBus.publishAll([...reservation.getDomainEvents()])
    reservation.clearDomainEvents()

    return {
      success: true,
      reservation,
    }
  }
}

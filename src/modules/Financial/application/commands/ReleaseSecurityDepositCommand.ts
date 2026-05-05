/**
 * ReleaseSecurityDepositCommand
 *
 * Releases a security deposit back to the guest.
 */

import type { ISecurityDepositRepository } from '../../domain/ISecurityDepositRepository'
import type { SecurityDeposit } from '../../domain/SecurityDeposit'

export interface ReleaseSecurityDepositDto {
  depositId: string
}

export class ReleaseSecurityDepositCommandHandler {
  constructor(
    private readonly securityDepositRepository: ISecurityDepositRepository
  ) {}

  async execute(dto: ReleaseSecurityDepositDto): Promise<SecurityDeposit> {
    // Find deposit
    const deposit = await this.securityDepositRepository.findById(dto.depositId)

    if (!deposit) {
      throw new Error(`Security deposit with ID '${dto.depositId}' not found`)
    }

    // Release deposit
    deposit.release()

    // Save updated deposit
    await this.securityDepositRepository.save(deposit)

    // Clear domain events
    deposit.clearDomainEvents()

    return deposit
  }
}

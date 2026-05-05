/**
 * UpdateSiteStatusCommand
 *
 * Command to update site status (e.g., mark as occupied, complete housekeeping).
 */
import { type ISiteRepository } from '../../domain/ISiteRepository'
import { type Site } from '../../domain/Site'

export type UpdateSiteStatusDto = {
  siteId: string
  action: 'mark_occupied' | 'mark_available' | 'mark_housekeeping' | 'complete_housekeeping' | 'mark_out_of_service'
}

export class UpdateSiteStatusCommandHandler {
  constructor(private readonly repository: ISiteRepository) {}

  async execute(dto: UpdateSiteStatusDto): Promise<Site> {
    // Load site
    const site = await this.repository.findById(dto.siteId)
    if (!site) {
      throw new Error(`Site not found: ${dto.siteId}`)
    }

    // Apply action
    switch (dto.action) {
      case 'mark_occupied':
        site.markAsOccupied()
        break
      case 'mark_available':
        site.markAsAvailable()
        break
      case 'mark_housekeeping':
        site.markAsNeedsHousekeeping()
        break
      case 'complete_housekeeping':
        site.completeHousekeeping()
        break
      case 'mark_out_of_service':
        site.markAsOutOfService()
        break
      default:
        throw new Error(`Unknown action: ${dto.action}`)
    }

    // Save
    await this.repository.save(site)

    // Clear domain events
    site.clearDomainEvents()

    return site
  }
}

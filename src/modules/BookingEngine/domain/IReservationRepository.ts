/**
 * IReservationRepository Interface
 *
 * Defines the contract for reservation persistence.
 * The domain layer depends on this interface, not on the concrete implementation.
 * This enables clean architecture and testability.
 */
import type { Reservation } from './Reservation'
import type { ReservationStatus } from './Reservation'
import type { DateRange } from './value-objects/DateRange'

export interface IReservationRepository {
  /**
   * Find a reservation by ID
   * Returns null if not found
   */
  findById(id: string): Promise<Reservation | null>

  /**
   * Find a reservation by confirmation number
   * Returns null if not found
   */
  findByConfirmationNumber(confirmationNumber: string): Promise<Reservation | null>

  /**
   * Find all reservations for a property
   */
  findByPropertyId(propertyId: string): Promise<Reservation[]>

  /**
   * Find reservations by property ID with filters
   */
  findByPropertyIdWithFilters(
    propertyId: string,
    filters: {
      status?: ReservationStatus
      guestId?: string
      siteId?: string
      checkInFrom?: Date
      checkInTo?: Date
      limit?: number
      offset?: number
    }
  ): Promise<{ reservations: Reservation[]; total: number }>

  /**
   * Find all reservations for a guest
   */
  findByGuestId(guestId: string): Promise<Reservation[]>

  /**
   * Find all reservations for a site
   */
  findBySiteId(siteId: string): Promise<Reservation[]>

  /**
   * Find reservations for a site that overlap with a date range
   * Used for availability checking
   */
  findBySiteIdAndDateRange(siteId: string, dateRange: DateRange): Promise<Reservation[]>

  /**
   * Check if a site has any confirmed/active reservations in a date range
   * Used for availability checking
   */
  existsForSiteInDateRange(siteId: string, dateRange: DateRange): Promise<boolean>

  /**
   * Save a reservation (create or update)
   */
  save(reservation: Reservation): Promise<void>

  /**
   * Delete a reservation
   */
  delete(id: string): Promise<void>

  /**
   * Find upcoming reservations (confirmed, not checked in yet, check-in within days)
   */
  findUpcoming(propertyId: string, withinDays: number): Promise<Reservation[]>

  /**
   * Find active reservations (currently checked in)
   */
  findActive(propertyId: string): Promise<Reservation[]>
}

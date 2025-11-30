/**
 * Reservation Aggregate Root
 *
 * Represents a campsite reservation in the system.
 * Enforces all business rules and invariants for reservations.
 *
 * Business Rules:
 * - Reservation must have a valid date range
 * - Guest count must not exceed site capacity
 * - Pricing must be calculated and balanced
 * - Status transitions must follow valid lifecycle
 * - Refunds cannot exceed payments
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { DateRange } from './DateRange'
import { ReservationPricing } from './ReservationPricing'
import { GuestCount } from './GuestCount'
import { ReservationCreatedEvent } from './events/ReservationCreatedEvent'
import { ReservationConfirmedEvent } from './events/ReservationConfirmedEvent'
import { ReservationCancelledEvent } from './events/ReservationCancelledEvent'
import { ReservationModifiedEvent } from './events/ReservationModifiedEvent'
import { PaymentRecordedEvent } from './events/PaymentRecordedEvent'
import { RefundIssuedEvent } from './events/RefundIssuedEvent'

// Type aliases for domain concepts
type ReservationId = string
type PropertyId = string
type SiteId = string
type GuestId = string
type ConfirmationNumber = string

/**
 * Reservation status lifecycle
 */
export enum ReservationStatus {
  PENDING = 'pending', // Awaiting payment
  CONFIRMED = 'confirmed', // Payment received, reservation active
  CHECKED_IN = 'checked_in', // Guest has checked in
  CHECKED_OUT = 'checked_out', // Guest has checked out
  CANCELLED = 'cancelled', // Reservation cancelled
  NO_SHOW = 'no_show', // Guest did not arrive
}

interface ReservationProps {
  propertyId: PropertyId
  siteId: SiteId
  guestId: GuestId
  confirmationNumber: ConfirmationNumber
  dateRange: DateRange
  guestCount: GuestCount
  pricing: ReservationPricing
  status: ReservationStatus
  specialRequests?: string | undefined
  notes?: string | undefined
  cancelledAt?: Date | undefined
  checkedInAt?: Date | undefined
  checkedOutAt?: Date | undefined
  source: string // 'online', 'phone', 'walk-in', etc.
}

export class Reservation extends AggregateRoot<ReservationId> {
  private props: ReservationProps

  private constructor(id: ReservationId, props: ReservationProps) {
    super(id)
    this.props = props
  }

  /**
   * Factory method to create a new reservation
   *
   * @param propertyId - Property the site belongs to
   * @param siteId - Site being reserved
   * @param guestId - Guest making the reservation
   * @param dateRange - Check-in/check-out dates
   * @param guestCount - Number of adults, children, pets, vehicles
   * @param pricing - Pricing information
   * @param source - How the reservation was created (online, phone, etc.)
   * @param specialRequests - Optional special requests from guest
   * @returns New Reservation instance
   */
  public static create(
    propertyId: PropertyId,
    siteId: SiteId,
    guestId: GuestId,
    dateRange: DateRange,
    guestCount: GuestCount,
    pricing: ReservationPricing,
    source = 'online',
    specialRequests?: string
  ): Reservation {
    // Generate confirmation number (will be replaced with proper generator)
    const confirmationNumber = Reservation.generateConfirmationNumber()

    // Generate new ID (will use UUID in production)
    const id = `res-${Date.now()}-${Math.random().toString(36).substring(7)}`

    const reservation = new Reservation(id, {
      propertyId,
      siteId,
      guestId,
      confirmationNumber,
      dateRange,
      guestCount,
      pricing,
      status: ReservationStatus.PENDING,
      source,
      ...(specialRequests !== undefined && { specialRequests }),
    })

    // Raise domain event
    reservation.addDomainEvent(
      new ReservationCreatedEvent(
        reservation.id,
        propertyId,
        siteId,
        guestId,
        dateRange.checkIn,
        dateRange.checkOut,
        guestCount.totalGuests,
        pricing.totalAmount,
        confirmationNumber
      )
    )

    return reservation
  }

  /**
   * Reconstruct reservation from persistence
   */
  public static fromPersistence(
    id: ReservationId,
    props: ReservationProps
  ): Reservation {
    return new Reservation(id, props)
  }

  /**
   * Generate a unique confirmation number
   * Format: RES-YYYYMMDD-XXXX (e.g., RES-20251108-A1B2)
   */
  private static generateConfirmationNumber(): ConfirmationNumber {
    const isoDate = new Date().toISOString()
    const datePart = isoDate.split('T')[0] ?? isoDate.substring(0, 10)
    const date = datePart.replace(/-/g, '')
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `RES-${date}-${random}`
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get propertyId(): PropertyId {
    return this.props.propertyId
  }

  get siteId(): SiteId {
    return this.props.siteId
  }

  get guestId(): GuestId {
    return this.props.guestId
  }

  get confirmationNumber(): ConfirmationNumber {
    return this.props.confirmationNumber
  }

  get dateRange(): DateRange {
    return this.props.dateRange
  }

  get guestCount(): GuestCount {
    return this.props.guestCount
  }

  get pricing(): ReservationPricing {
    return this.props.pricing
  }

  get status(): ReservationStatus {
    return this.props.status
  }

  get specialRequests(): string | undefined {
    return this.props.specialRequests
  }

  get notes(): string | undefined {
    return this.props.notes
  }

  get source(): string {
    return this.props.source
  }

  get cancelledAt(): Date | undefined {
    return this.props.cancelledAt
  }

  get checkedInAt(): Date | undefined {
    return this.props.checkedInAt
  }

  get checkedOutAt(): Date | undefined {
    return this.props.checkedOutAt
  }

  // ============================================================================
  // Business Logic - Status Checks
  // ============================================================================

  public isPending(): boolean {
    return this.props.status === ReservationStatus.PENDING
  }

  public isConfirmed(): boolean {
    return this.props.status === ReservationStatus.CONFIRMED
  }

  public isCheckedIn(): boolean {
    return this.props.status === ReservationStatus.CHECKED_IN
  }

  public isCheckedOut(): boolean {
    return this.props.status === ReservationStatus.CHECKED_OUT
  }

  public isCancelled(): boolean {
    return this.props.status === ReservationStatus.CANCELLED
  }

  public isNoShow(): boolean {
    return this.props.status === ReservationStatus.NO_SHOW
  }

  public isActive(): boolean {
    return (
      this.props.status === ReservationStatus.CONFIRMED ||
      this.props.status === ReservationStatus.CHECKED_IN
    )
  }

  // ============================================================================
  // Business Logic - Lifecycle Actions
  // ============================================================================

  /**
   * Confirm reservation after payment
   */
  public confirm(): void {
    if (this.props.status !== ReservationStatus.PENDING) {
      throw new Error(
        `Cannot confirm reservation with status ${this.props.status}. Must be pending.`
      )
    }

    if (!this.props.pricing.isPaidInFull()) {
      throw new Error('Cannot confirm reservation that is not paid in full')
    }

    this.props.status = ReservationStatus.CONFIRMED

    this.addDomainEvent(
      new ReservationConfirmedEvent(
        this.id,
        this.props.propertyId,
        this.props.siteId,
        this.props.confirmationNumber,
        this.props.dateRange.checkIn,
        this.props.dateRange.checkOut
      )
    )
  }

  /**
   * Cancel reservation
   *
   * @param reason - Reason for cancellation
   */
  public cancel(reason?: string): void {
    if (this.isCancelled()) {
      throw new Error('Reservation is already cancelled')
    }

    if (this.isCheckedOut()) {
      throw new Error('Cannot cancel a checked-out reservation')
    }

    const previousStatus = this.props.status
    this.props.status = ReservationStatus.CANCELLED
    this.props.cancelledAt = new Date()

    if (reason) {
      this.props.notes = this.props.notes
        ? `${this.props.notes}\n\nCancellation reason: ${reason}`
        : `Cancellation reason: ${reason}`
    }

    this.addDomainEvent(
      new ReservationCancelledEvent(
        this.id,
        this.props.propertyId,
        this.props.siteId,
        previousStatus,
        this.props.cancelledAt,
        this.props.pricing.netPayment
      )
    )
  }

  /**
   * Check in guest
   */
  public checkIn(): void {
    if (this.props.status !== ReservationStatus.CONFIRMED) {
      throw new Error(
        `Cannot check in reservation with status ${this.props.status}. Must be confirmed.`
      )
    }

    this.props.status = ReservationStatus.CHECKED_IN
    this.props.checkedInAt = new Date()
  }

  /**
   * Check out guest
   */
  public checkOut(): void {
    if (this.props.status !== ReservationStatus.CHECKED_IN) {
      throw new Error(
        `Cannot check out reservation with status ${this.props.status}. Must be checked in.`
      )
    }

    this.props.status = ReservationStatus.CHECKED_OUT
    this.props.checkedOutAt = new Date()
  }

  /**
   * Mark reservation as no-show
   */
  public markNoShow(): void {
    if (this.props.status !== ReservationStatus.CONFIRMED) {
      throw new Error(
        `Cannot mark as no-show with status ${this.props.status}. Must be confirmed.`
      )
    }

    this.props.status = ReservationStatus.NO_SHOW
  }

  // ============================================================================
  // Business Logic - Modifications
  // ============================================================================

  /**
   * Record a payment
   *
   * @param amount - Amount paid (in cents)
   * @param paymentMethod - Payment method used
   */
  public recordPayment(amount: number, paymentMethod = 'card'): void {
    if (this.isCancelled()) {
      throw new Error('Cannot record payment for cancelled reservation')
    }

    const previousPricing = this.props.pricing
    this.props.pricing = this.props.pricing.recordPayment(amount)

    this.addDomainEvent(
      new PaymentRecordedEvent(
        this.id,
        this.props.propertyId,
        amount,
        paymentMethod,
        this.props.pricing.balanceDue
      )
    )

    // Auto-confirm if now paid in full and still pending
    if (this.isPending() && this.props.pricing.isPaidInFull()) {
      this.confirm()
    }
  }

  /**
   * Issue a refund
   *
   * @param amount - Amount to refund (in cents)
   * @param reason - Reason for refund
   */
  public issueRefund(amount: number, reason?: string): void {
    this.props.pricing = this.props.pricing.recordRefund(amount)

    if (reason) {
      this.props.notes = this.props.notes
        ? `${this.props.notes}\n\nRefund: ${reason}`
        : `Refund: ${reason}`
    }

    this.addDomainEvent(
      new RefundIssuedEvent(
        this.id,
        this.props.propertyId,
        amount,
        this.props.pricing.balanceDue,
        reason
      )
    )
  }

  /**
   * Modify reservation dates
   *
   * @param newDateRange - New date range
   * @param newPricing - Updated pricing for new dates
   */
  public modifyDates(newDateRange: DateRange, newPricing: ReservationPricing): void {
    if (this.isCancelled()) {
      throw new Error('Cannot modify cancelled reservation')
    }

    if (this.isCheckedIn() || this.isCheckedOut()) {
      throw new Error('Cannot modify dates for checked-in or checked-out reservation')
    }

    const oldDateRange = this.props.dateRange
    this.props.dateRange = newDateRange
    this.props.pricing = newPricing

    this.addDomainEvent(
      new ReservationModifiedEvent(
        this.id,
        this.props.propertyId,
        'dates',
        oldDateRange.checkIn,
        oldDateRange.checkOut,
        newDateRange.checkIn,
        newDateRange.checkOut
      )
    )
  }

  /**
   * Modify guest count
   *
   * @param newGuestCount - New guest count
   * @param siteMaxOccupancy - Maximum occupancy of the site (for validation)
   */
  public modifyGuestCount(newGuestCount: GuestCount, siteMaxOccupancy: number): void {
    if (this.isCancelled()) {
      throw new Error('Cannot modify cancelled reservation')
    }

    if (newGuestCount.exceedsCapacity(siteMaxOccupancy)) {
      throw new Error(
        `Guest count (${newGuestCount.totalGuests}) exceeds site capacity (${siteMaxOccupancy})`
      )
    }

    this.props.guestCount = newGuestCount

    this.addDomainEvent(
      new ReservationModifiedEvent(
        this.id,
        this.props.propertyId,
        'guest_count'
      )
    )
  }

  /**
   * Add notes to reservation
   *
   * @param note - Note to add
   */
  public addNote(note: string): void {
    this.props.notes = this.props.notes
      ? `${this.props.notes}\n\n${note}`
      : note
  }

  /**
   * Update special requests
   *
   * @param requests - Special requests
   */
  public updateSpecialRequests(requests: string): void {
    this.props.specialRequests = requests
  }
}

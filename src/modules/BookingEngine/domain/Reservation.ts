/**
 * Reservation Aggregate Root
 *
 * Represents a campsite reservation with its complete lifecycle.
 * Enforces business rules around booking, payment, and guest workflows.
 *
 * Business Rules:
 * - Reservations must have valid dates and site assignments
 * - Payment must be tracked accurately (total vs. paid)
 * - State transitions follow defined workflow (pending → confirmed → checked_in → checked_out)
 * - Cancellations can only occur before check-in
 * - Check-in requires confirmed status
 * - Check-out requires checked-in status
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { DateRange } from './value-objects/DateRange'
import { MoneyAmount } from './value-objects/MoneyAmount'
import { ConfirmationNumber } from './value-objects/ConfirmationNumber'
import { OccupancyInfo } from './value-objects/OccupancyInfo'
import { ReservationCreated } from './events/ReservationCreated'
import { ReservationConfirmed } from './events/ReservationConfirmed'
import { ReservationCancelled } from './events/ReservationCancelled'
import { ReservationModified } from './events/ReservationModified'
import { NoShowMarked } from './events/NoShowMarked'
import { RefundInitiated, type RefundReason } from './events/RefundInitiated'
import { GuestCheckedIn } from './events/GuestCheckedIn'
import { GuestCheckedOut } from './events/GuestCheckedOut'
import { PaymentReceived } from './events/PaymentReceived'

/**
 * Reservation lifecycle status
 */
export enum ReservationStatus {
  PENDING = 'pending',           // Reservation created, awaiting payment
  CONFIRMED = 'confirmed',       // Payment received, reservation confirmed
  CHECKED_IN = 'checked_in',     // Guest has checked in
  CHECKED_OUT = 'checked_out',   // Guest has checked out
  COMPLETED = 'completed',  
  PARTIALLY_REFUNDED = 'partially_refunded',
  CANCELLED = 'cancelled',       // Reservation cancelled
  NO_SHOW = 'no_show',           // Guest did not arrive for check-in
}

/**
 * Payment status tracking
 */
export enum PaymentStatus {
  PENDING = 'pending',           // No payment received
  PARTIAL = 'partial',           // Partial payment received
  PAID = 'paid',                 // Fully paid
  PARTIALLY_REFUNDED = 'partially_refunded',
  REFUNDED = 'refunded',         // Payment refunded (after cancellation)
}

export interface ReservationProps {
  propertyId: string
  siteId: string
  guestId: string
  confirmationNumber: ConfirmationNumber
  dateRange: DateRange
  occupancy: OccupancyInfo
  totalAmount: MoneyAmount
  paidAmount: MoneyAmount
  status: ReservationStatus
  paymentStatus: PaymentStatus
  specialRequests: string | null
  notes: string | null
  source: string // 'online', 'phone', 'walkin'

  // Check-in workflow
  checkedInAt: Date | null
  checkedInBy: string | null // Staff user ID
  balancePaidAtCheckIn: MoneyAmount | null
  checkInNotes: string | null

  // Check-out workflow
  checkedOutAt: Date | null
  checkedOutBy: string | null // Staff user ID
  hasDamages: boolean
  checkOutNotes: string | null

  // Cancellation
  cancelledAt: Date | null
  cancellationReason: string | null
  refundAmount: MoneyAmount | null

  createdAt: Date
  updatedAt: Date
}

export class Reservation extends AggregateRoot<string> {
  private props: ReservationProps

  private constructor(
    id: string,
    props: ReservationProps,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt)
    this.props = props
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  /**
   * Create a new reservation (pending status)
   */
  static create(
    id: string,
    propertyId: string,
    siteId: string,
    guestId: string,
    confirmationNumber: ConfirmationNumber,
    dateRange: DateRange,
    occupancy: OccupancyInfo,
    totalAmount: MoneyAmount,
    specialRequests?: string | null,
    source: string = 'online'
  ): Reservation {
    // Validate date range is not in the past
    if (dateRange.isPast()) {
      throw new Error('Cannot create reservation for past dates')
    }

    const reservation = new Reservation(
      id,
      {
        propertyId,
        siteId,
        guestId,
        confirmationNumber,
        dateRange,
        occupancy,
        totalAmount,
        paidAmount: MoneyAmount.zero(),
        status: ReservationStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        specialRequests: specialRequests || null,
        notes: null,
        source,
        checkedInAt: null,
        checkedInBy: null,
        balancePaidAtCheckIn: null,
        checkInNotes: null,
        checkedOutAt: null,
        checkedOutBy: null,
        hasDamages: false,
        checkOutNotes: null,
        cancelledAt: null,
        cancellationReason: null,
        refundAmount: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    )

    // Publish domain event
    reservation.addDomainEvent(
      new ReservationCreated(
        reservation.id,
        propertyId,
        siteId,
        guestId,
        confirmationNumber.value,
        dateRange.checkIn,
        dateRange.checkOut,
        totalAmount.amountInCents
      )
    )

    return reservation
  }

  /**
   * Reconstitute reservation from database
   */
  static reconstitute(
    id: string,
    props: ReservationProps
  ): Reservation {
    return new Reservation(id, props, props.createdAt, props.updatedAt)
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get propertyId(): string {
    return this.props.propertyId
  }

  get siteId(): string {
    return this.props.siteId
  }

  get guestId(): string {
    return this.props.guestId
  }

  get confirmationNumber(): ConfirmationNumber {
    return this.props.confirmationNumber
  }

  get dateRange(): DateRange {
    return this.props.dateRange
  }

  get checkInDate(): Date {
    return this.dateRange.checkIn
  }

  get checkOutDate(): Date {
    return this.dateRange.checkOut
  }

  get nights(): number {
    return this.dateRange.nights
  }

  get occupancy(): OccupancyInfo {
    return this.props.occupancy
  }

  get totalAmount(): MoneyAmount {
    return this.props.totalAmount
  }

  get paidAmount(): MoneyAmount {
    return this.props.paidAmount
  }

  get status(): ReservationStatus {
    return this.props.status
  }

  get paymentStatus(): PaymentStatus {
    return this.props.paymentStatus
  }

  get specialRequests(): string | null {
    return this.props.specialRequests
  }

  get notes(): string | null {
    return this.props.notes
  }

  get source(): string {
    return this.props.source
  }

  get checkedInAt(): Date | null {
    return this.props.checkedInAt
  }

  get checkedOutAt(): Date | null {
    return this.props.checkedOutAt
  }

  get cancelledAt(): Date | null {
    return this.props.cancelledAt
  }

  get domainEvents() {
    return this.getDomainEvents()
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Calculate remaining balance owed (amount still due).
   * When paid meets or exceeds total (including overpayment), returns zero — MoneyAmount cannot represent negative balances.
   */
  calculateBalance(): MoneyAmount {
    if (this.paidAmount.isGreaterThanOrEqual(this.totalAmount)) {
      return MoneyAmount.zero()
    }
    return this.totalAmount.subtract(this.paidAmount)
  }

  /**
   * Get remaining balance (alias for calculateBalance)
   * Convenience getter for policy implementations
   */
  get remainingBalance(): MoneyAmount {
    return this.calculateBalance()
  }

  /**
   * Check if reservation is fully paid
   */
  isFullyPaid(): boolean {
    return this.paidAmount.isGreaterThanOrEqual(this.totalAmount)
  }

  /**
   * Check if reservation can be cancelled
   */
  canBeCancelled(): boolean {
    // Can only cancel if not yet checked in and not already cancelled/no-show
    return (
      this.status !== ReservationStatus.CHECKED_IN &&
      this.status !== ReservationStatus.CHECKED_OUT &&
      this.status !== ReservationStatus.COMPLETED &&
      this.status !== ReservationStatus.CANCELLED &&
      this.status !== ReservationStatus.NO_SHOW
    )
  }

  /**
   * Receive payment for the reservation
   */
  receivePayment(
    amount: MoneyAmount,
    paymentMethod: string,
    stripePaymentIntentId: string | null = null
  ): void {
    if (this.status === ReservationStatus.CANCELLED) {
      throw new Error('Cannot receive payment for cancelled reservation')
    }

    // Overpayment is allowed (e.g. check-in adjustments); do not cap paid_amount at total.
    const newPaidAmount = this.paidAmount.add(amount)
    // if (newPaidAmount.isGreaterThan(this.totalAmount)) {
    //   throw new Error('Payment amount exceeds reservation total')
    // }

    // Update paid amount
    this.props.paidAmount = newPaidAmount

    // Update payment status
    if (newPaidAmount.isGreaterThanOrEqual(this.totalAmount)) {
      this.props.paymentStatus = PaymentStatus.PAID
    } else if (newPaidAmount.isGreaterThan(MoneyAmount.zero())) {
      this.props.paymentStatus = PaymentStatus.PARTIAL
    }

    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new PaymentReceived(
        this.id,
        this.confirmationNumber.value,
        amount.amountInCents,
        paymentMethod,
        stripePaymentIntentId
      )
    )
  }

  /**
   * Confirm the reservation
   *
   * IMPORTANT: This method handles only the domain state transition.
   * Payment validation is handled by IConfirmationPolicy at the
   * application layer. This design allows property owners to configure
   * different confirmation rules (full payment, deposit, no payment).
   *
   * @see IConfirmationPolicy for payment rule enforcement
   */
  confirm(): void {
    if (!this.canBeConfirmed()) {
      throw new Error('Can only confirm pending reservations')
    }

    this.props.status = ReservationStatus.CONFIRMED
    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new ReservationConfirmed(
        this.id,
        this.confirmationNumber.value
      )
    )
  }

  /**
   * Check if reservation can be confirmed (domain invariant)
   *
   * Only checks domain-level constraints (status).
   * Policy constraints (payment requirements) are checked separately.
   */
  canBeConfirmed(): boolean {
    return this.status === ReservationStatus.PENDING
  }

  /**
   * Cancel the reservation
   */
  cancel(reason: string | null, refundAmount: MoneyAmount): void {
    if (!this.canBeCancelled()) {
      throw new Error('Reservation cannot be cancelled in current status')
    }

    // Validate refund doesn't exceed paid amount
    if (refundAmount.isGreaterThan(this.paidAmount)) {
      throw new Error('Refund amount cannot exceed paid amount')
    }

    this.props.status = ReservationStatus.CANCELLED
    this.props.cancelledAt = new Date()
    this.props.cancellationReason = reason
    this.props.refundAmount = refundAmount

    // Update payment status if refunded
    if (refundAmount.isGreaterThan(MoneyAmount.zero())) {
      this.props.paymentStatus = refundAmount.isLessThan(this.paidAmount)
        ? PaymentStatus.PARTIALLY_REFUNDED
        : PaymentStatus.REFUNDED
    }

    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new ReservationCancelled(
        this.id,
        this.confirmationNumber.value,
        reason,
        refundAmount.amountInCents
      )
    )
  }

  /**
   * Check in the guest
   */
  checkIn(
    staffUserId: string,
    balancePaid: MoneyAmount = MoneyAmount.zero(),
    notes: string | null = null
  ): void {
    if (this.status !== ReservationStatus.CONFIRMED) {
      throw new Error('Can only check in confirmed reservations')
    }

    // Check if check-in date is today or in the past
    if (!this.dateRange.isToday() && !this.dateRange.isPast()) {
      throw new Error('Cannot check in before check-in date')
    }

    // If balance was paid, record it
    if (balancePaid.isGreaterThan(MoneyAmount.zero())) {
      this.receivePayment(balancePaid, 'cash') // Assume cash at check-in
    }

    this.props.status = ReservationStatus.CHECKED_IN
    this.props.checkedInAt = new Date()
    this.props.checkedInBy = staffUserId
    this.props.balancePaidAtCheckIn = balancePaid
    this.props.checkInNotes = notes
    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new GuestCheckedIn(
        this.id,
        this.confirmationNumber.value,
        staffUserId,
        balancePaid.amountInCents
      )
    )
  }

  /**
   * Check out the guest
   */
  checkOut(
    staffUserId: string,
    hasDamages: boolean = false,
    notes: string | null = null
  ): void {
    if (this.status !== ReservationStatus.CHECKED_IN) {
      throw new Error('Can only check out checked-in reservations')
    }

    this.props.status = ReservationStatus.CHECKED_OUT
    this.props.checkedOutAt = new Date()
    this.props.checkedOutBy = staffUserId
    this.props.hasDamages = hasDamages
    this.props.checkOutNotes = notes
    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new GuestCheckedOut(
        this.id,
        this.confirmationNumber.value,
        staffUserId,
        hasDamages
      )
    )
  }

  /**
   * Mark reservation as completed (for record-keeping)
   */
  complete(): void {
    if (this.status !== ReservationStatus.CHECKED_OUT) {
      throw new Error('Can only complete checked-out reservations')
    }

    this.props.status = ReservationStatus.COMPLETED
    this.props.updatedAt = new Date()
  }

  /**
   * Update notes
   */
  updateNotes(notes: string): void {
    this.props.notes = notes.trim() || null
    this.props.updatedAt = new Date()
  }

  // ============================================================================
  // Modification Methods
  // ============================================================================

  /**
   * Check if reservation can be modified
   * Modifications are only allowed for pending or confirmed reservations
   */
  canBeModified(): boolean {
    return (
      this.status === ReservationStatus.PENDING ||
      this.status === ReservationStatus.CONFIRMED
    )
  }

  /**
   * Modify reservation dates
   *
   * @param newDateRange - New check-in and check-out dates
   * @param newTotalAmount - Recalculated total based on new dates
   */
  modifyDates(newDateRange: DateRange, newTotalAmount: MoneyAmount): void {
    if (!this.canBeModified()) {
      throw new Error('Cannot modify reservation in current status')
    }

    if (newDateRange.isPast()) {
      throw new Error('Cannot modify reservation to past dates')
    }

    const previousCheckIn = this.dateRange.checkIn
    const previousCheckOut = this.dateRange.checkOut
    const previousTotal = this.totalAmount

    this.props.dateRange = newDateRange
    this.props.totalAmount = newTotalAmount
    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new ReservationModified(
        this.id,
        this.confirmationNumber.value,
        'dates',
        {
          previousCheckIn,
          previousCheckOut,
          newCheckIn: newDateRange.checkIn,
          newCheckOut: newDateRange.checkOut,
        },
        null,
        newTotalAmount.amountInCents,
        previousTotal.amountInCents
      )
    )
  }

  /**
   * Modify guest count
   *
   * @param newOccupancy - New occupancy information
   * @param newTotalAmount - Recalculated total based on new guest count
   */
  modifyGuestCount(newOccupancy: OccupancyInfo, newTotalAmount: MoneyAmount): void {
    if (!this.canBeModified()) {
      throw new Error('Cannot modify reservation in current status')
    }

    const previousAdults = this.occupancy.numAdults
    const previousChildren = this.occupancy.numChildren
    const previousTotal = this.totalAmount

    this.props.occupancy = newOccupancy
    this.props.totalAmount = newTotalAmount
    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new ReservationModified(
        this.id,
        this.confirmationNumber.value,
        'guests',
        null,
        {
          previousAdults,
          previousChildren,
          newAdults: newOccupancy.numAdults,
          newChildren: newOccupancy.numChildren,
        },
        newTotalAmount.amountInCents,
        previousTotal.amountInCents
      )
    )
  }

  /**
   * Mark reservation as no-show
   *
   * A no-show occurs when the guest does not arrive by the check-in deadline.
   * This is typically done on the day after the scheduled check-in date.
   */
  markNoShow(staffUserId: string): void {
    if (
      this.status !== ReservationStatus.CONFIRMED &&
      this.status !== ReservationStatus.PENDING
    ) {
      throw new Error('Can only mark confirmed or pending reservations as no-show')
    }

    this.props.status = ReservationStatus.NO_SHOW
    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new NoShowMarked(
        this.id,
        this.confirmationNumber.value,
        staffUserId,
        this.dateRange.checkIn
      )
    )
  }

  /**
   * Initiate a refund for this reservation
   *
   * This method tracks refund requests. The actual refund processing
   * is handled by the payment infrastructure (e.g., Stripe).
   * Refunds can be issued for cancellations, service issues, etc.
   *
   * @param amount - The refund amount (cannot exceed paid amount)
   * @param reason - The reason for the refund
   * @param staffUserId - The staff member initiating the refund
   * @param notes - Optional notes about the refund
   */
  issueRefund(
    amount: MoneyAmount,
    reason: RefundReason,
    staffUserId: string,
    notes: string | null = null
  ): void {
    // Validate refund doesn't exceed paid amount
    if (amount.isGreaterThan(this.paidAmount)) {
      throw new Error('Refund amount cannot exceed paid amount')
    }

    // Validate there's something to refund
    if (!amount.isGreaterThan(MoneyAmount.zero())) {
      throw new Error('Refund amount must be positive')
    }

    // Track the refund
    this.props.refundAmount = this.props.refundAmount
      ? this.props.refundAmount.add(amount)
      : amount

    // Update payment status if fully refunded
    if (this.props.refundAmount.isGreaterThanOrEqual(this.paidAmount)) {
      this.props.paymentStatus = PaymentStatus.REFUNDED
    }

    this.props.updatedAt = new Date()

    // Publish domain event
    this.addDomainEvent(
      new RefundInitiated(
        this.id,
        this.confirmationNumber.value,
        amount.amountInCents,
        reason,
        notes,
        staffUserId
      )
    )
  }

  /**
   * Get total refunded amount
   */
  get totalRefunded(): MoneyAmount {
    return this.props.refundAmount ?? MoneyAmount.zero()
  }

  /**
   * Check if refund can be issued
   */
  canIssueRefund(): boolean {
    // Can refund if there's paid amount and not fully refunded
    return (
      this.paidAmount.isGreaterThan(MoneyAmount.zero()) &&
      this.totalRefunded.isLessThan(this.paidAmount)
    )
  }

  /**
   * Get maximum refundable amount
   */
  get maxRefundableAmount(): MoneyAmount {
    return this.paidAmount.subtract(this.totalRefunded)
  }

  /**
   * Check if reservation is currently active (guest is checked in)
   */
  isActive(): boolean {
    return this.status === ReservationStatus.CHECKED_IN
  }

  /**
   * Check if reservation is upcoming
   */
  isUpcoming(): boolean {
    return (
      (this.status === ReservationStatus.CONFIRMED ||
        this.status === ReservationStatus.PENDING) &&
      !this.dateRange.isPast()
    )
  }

  // ============================================================================
  // Persistence Methods
  // ============================================================================

  /**
   * Convert to database persistence format
   */
  toPersistence(): Record<string, any> {
    return {
      id: this.id,
      property_id: this.props.propertyId,
      site_id: this.props.siteId,
      guest_id: this.props.guestId,
      confirmation_number: this.props.confirmationNumber.value,
      check_in_date: this.props.dateRange.checkIn,
      check_out_date: this.props.dateRange.checkOut,
      num_adults: this.props.occupancy.numAdults,
      num_children: this.props.occupancy.numChildren,
      num_pets: this.props.occupancy.numPets,
      num_vehicles: this.props.occupancy.numVehicles,
      total_amount: this.props.totalAmount.amountInCents,
      paid_amount: this.props.paidAmount.amountInCents,
      status: this.props.status,
      payment_status: this.props.paymentStatus,
      special_requests: this.props.specialRequests,
      notes: this.props.notes,
      source: this.props.source,
      checked_in_at: this.props.checkedInAt,
      checked_in_by: this.props.checkedInBy,
      balance_paid_at_checkin: this.props.balancePaidAtCheckIn?.amountInCents || null,
      check_in_notes: this.props.checkInNotes,
      checked_out_at: this.props.checkedOutAt,
      checked_out_by: this.props.checkedOutBy,
      check_out_notes: this.props.checkOutNotes,
      cancelled_at: this.props.cancelledAt,
      refund_amount_cents: this.props.refundAmount?.amountInCents ?? null,
      created_at: this.createdAt,
      updated_at: this.props.updatedAt,
    }
  }

  /**
   * Reconstitute from database persistence format
   */
  static fromPersistence(data: Record<string, any>): Reservation {
    // Reconstruct value objects
    const confirmationNumber = ConfirmationNumber.create(data.confirmation_number)
    const dateRange = DateRange.create(
      new Date(data.check_in_date),
      new Date(data.check_out_date)
    )
    const occupancy = OccupancyInfo.create(
      data.num_adults,
      data.num_children,
      data.num_pets,
      data.num_vehicles
    )
    // Database columns: total_amount, paid_amount (stored in cents, no _cents suffix)
    // Ensure integer values for MoneyAmount (database may return as number)
    const totalAmount = MoneyAmount.create(Math.round(data.total_amount ?? 0))
    const paidAmount = MoneyAmount.create(Math.round(data.paid_amount ?? 0))
    // Database column: balance_paid_at_checkin (not balance_paid_at_check_in_cents)
    const balancePaidAtCheckIn = data.balance_paid_at_checkin != null
      ? MoneyAmount.create(Math.round(data.balance_paid_at_checkin))
      : null
    // refund_amount column does not exist in production schema
    const refundAmount = data.refund_amount_cents != null && data.refund_amount_cents > 0
      ? MoneyAmount.create(Math.round(data.refund_amount_cents))
      : null

    const props: ReservationProps = {
      propertyId: data.property_id,
      siteId: data.site_id,
      guestId: data.guest_id,
      confirmationNumber,
      dateRange,
      occupancy,
      totalAmount,
      paidAmount,
      status: data.status as ReservationStatus,
      paymentStatus: data.payment_status as PaymentStatus,
      specialRequests: data.special_requests,
      notes: data.notes,
      source: data.source,
      checkedInAt: data.checked_in_at ? new Date(data.checked_in_at) : null,
      checkedInBy: data.checked_in_by,
      balancePaidAtCheckIn,
      checkInNotes: data.check_in_notes,
      checkedOutAt: data.checked_out_at ? new Date(data.checked_out_at) : null,
      checkedOutBy: data.checked_out_by,
      hasDamages: data.has_damages || false,
      checkOutNotes: data.check_out_notes,
      cancelledAt: data.cancelled_at ? new Date(data.cancelled_at) : null,
      cancellationReason: data.cancellation_reason,
      refundAmount,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    }

    return new Reservation(
      data.id,
      props,
      new Date(data.created_at),
      new Date(data.updated_at)
    )
  }
}

/**
 * Reservation Aggregate Tests
 *
 * Tests for Reservation domain entity business logic and state machine.
 * Follows TDD best practices from CLAUDE.md.
 */

import { describe, test, expect } from 'vitest'
import { randomUUID } from 'crypto'
import { Reservation, ReservationStatus, PaymentStatus } from './Reservation'
import { DateRange } from './value-objects/DateRange'
import { MoneyAmount } from './value-objects/MoneyAmount'
import { ConfirmationNumber } from './value-objects/ConfirmationNumber'
import { OccupancyInfo } from './value-objects/OccupancyInfo'
import { addDays } from 'date-fns'

describe('Reservation', () => {
  const propertyId = randomUUID()
  const siteId = randomUUID()
  const guestId = randomUUID()

  describe('create', () => {
    test('should create a new pending reservation with valid data', () => {
      const confirmationNumber = ConfirmationNumber.generate()
      const checkIn = addDays(new Date(), 7)
      const checkOut = addDays(new Date(), 10)
      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2, 1, 0, 1)
      const totalAmount = MoneyAmount.fromDollars(300)

      const reservation = Reservation.create(
        randomUUID(),
        propertyId,
        siteId,
        guestId,
        confirmationNumber,
        dateRange,
        occupancy,
        totalAmount
      )

      expect(reservation.propertyId).toBe(propertyId)
      expect(reservation.siteId).toBe(siteId)
      expect(reservation.guestId).toBe(guestId)
      expect(reservation.confirmationNumber.value).toBe(confirmationNumber.value)
      expect(reservation.status).toBe(ReservationStatus.PENDING)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PENDING)
      expect(reservation.totalAmount.dollars).toBe(300)
      expect(reservation.paidAmount.dollars).toBe(0)
      expect(reservation.nights).toBe(3)
    })

    test('should reject reservation for past dates', () => {
      const confirmationNumber = ConfirmationNumber.generate()
      const checkIn = addDays(new Date(), -7) // Past date
      const checkOut = addDays(new Date(), -4)
      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2)
      const totalAmount = MoneyAmount.fromDollars(200)

      expect(() =>
        Reservation.create(
          randomUUID(),
          propertyId,
          siteId,
          guestId,
          confirmationNumber,
          dateRange,
          occupancy,
          totalAmount
        )
      ).toThrow('Cannot create reservation for past dates')
    })

    test('should publish ReservationCreated domain event', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('ReservationCreated')
    })

    test('should set source to online by default', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      expect(reservation.source).toBe('online')
    })

    test('should accept custom source', () => {
      const confirmationNumber = ConfirmationNumber.generate()
      const dateRange = DateRange.create(addDays(new Date(), 1), addDays(new Date(), 2))
      const occupancy = OccupancyInfo.create(2)
      const totalAmount = MoneyAmount.fromDollars(100)

      const reservation = Reservation.create(
        randomUUID(),
        propertyId,
        siteId,
        guestId,
        confirmationNumber,
        dateRange,
        occupancy,
        totalAmount,
        'Special request note',
        'phone'
      )

      expect(reservation.source).toBe('phone')
    })
  })

  describe('receivePayment', () => {
    test('should accept partial payment', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.clearDomainEvents()

      const payment = MoneyAmount.fromDollars(150)
      reservation.receivePayment(payment, 'credit_card', 'pi_123456')

      expect(reservation.paidAmount.dollars).toBe(150)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PARTIAL)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('PaymentReceived')
    })

    test('should accept full payment', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      const payment = MoneyAmount.fromDollars(300)
      reservation.receivePayment(payment, 'credit_card', 'pi_123456')

      expect(reservation.paidAmount.dollars).toBe(300)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PAID)
      expect(reservation.isFullyPaid()).toBe(true)
    })

    test('should accept multiple payments to reach full amount', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')
      expect(reservation.paymentStatus).toBe(PaymentStatus.PARTIAL)

      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')
      expect(reservation.paymentStatus).toBe(PaymentStatus.PARTIAL)

      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')
      expect(reservation.paymentStatus).toBe(PaymentStatus.PAID)
      expect(reservation.isFullyPaid()).toBe(true)
    })

    test('should reject payment exceeding total amount', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      const overpayment = MoneyAmount.fromDollars(400)

      expect(() =>
        reservation.receivePayment(overpayment, 'credit_card')
      ).toThrow('Payment amount exceeds reservation total')
    })

    test('should reject payment for cancelled reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.cancel('Guest cancelled', MoneyAmount.zero())

      expect(() =>
        reservation.receivePayment(MoneyAmount.fromDollars(100), 'cash')
      ).toThrow('Cannot receive payment for cancelled reservation')
    })

    test('should publish PaymentReceived event', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.clearDomainEvents()

      reservation.receivePayment(MoneyAmount.fromDollars(150), 'credit_card', 'pi_123')

      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('PaymentReceived')
    })
  })

  describe('confirm', () => {
    test('should confirm fully paid pending reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.clearDomainEvents()

      reservation.confirm()

      expect(reservation.status).toBe(ReservationStatus.CONFIRMED)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('ReservationConfirmed')
    })

    test('should reject confirming non-pending reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      expect(() => reservation.confirm()).toThrow('Can only confirm pending reservations')
    })

    test('should reject confirming without full payment', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(150), 'credit_card') // Partial only

      expect(() => reservation.confirm()).toThrow('Reservation must be fully paid before confirmation')
    })
  })

  describe('cancel', () => {
    test('should cancel pending reservation with refund', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')
      reservation.clearDomainEvents()

      const refund = MoneyAmount.fromDollars(90) // Minus cancellation fee
      reservation.cancel('Guest cancelled', refund)

      expect(reservation.status).toBe(ReservationStatus.CANCELLED)
      expect(reservation.paymentStatus).toBe(PaymentStatus.REFUNDED)
      expect(reservation.cancelledAt).toBeInstanceOf(Date)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('ReservationCancelled')
    })

    test('should cancel confirmed reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      const refund = MoneyAmount.fromDollars(270)
      reservation.cancel('Guest cancelled', refund)

      expect(reservation.status).toBe(ReservationStatus.CANCELLED)
    })

    test('should reject cancelling checked-in reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0) // Today
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn('staff_123')

      expect(() =>
        reservation.cancel('Too late', MoneyAmount.zero())
      ).toThrow('Reservation cannot be cancelled in current status')
    })

    test('should reject cancelling already cancelled reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.cancel('First cancellation', MoneyAmount.zero())

      expect(() =>
        reservation.cancel('Second cancellation', MoneyAmount.zero())
      ).toThrow('Reservation cannot be cancelled in current status')
    })

    test('should reject refund exceeding paid amount', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')

      const excessiveRefund = MoneyAmount.fromDollars(150)

      expect(() =>
        reservation.cancel('Guest cancelled', excessiveRefund)
      ).toThrow('Refund amount cannot exceed paid amount')
    })

    test('should allow no refund cancellation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')

      reservation.cancel('Late cancellation - no refund', MoneyAmount.zero())

      expect(reservation.status).toBe(ReservationStatus.CANCELLED)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PARTIAL) // Not refunded
    })
  })

  describe('checkIn', () => {
    test('should check in confirmed reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0) // Today
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      reservation.checkIn(staffId)

      expect(reservation.status).toBe(ReservationStatus.CHECKED_IN)
      expect(reservation.checkedInAt).toBeInstanceOf(Date)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('GuestCheckedIn')
      expect(reservation.isActive()).toBe(true)
    })

    test('should reject overpayment at check-in', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      const staffId = randomUUID()
      const extraPayment = MoneyAmount.fromDollars(50) // Would exceed total

      // Overpayment not allowed
      expect(() =>
        reservation.checkIn(staffId, extraPayment, 'Attempted overpayment')
      ).toThrow('Payment amount exceeds reservation total')
    })

    test('should reject checking in non-confirmed reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)

      expect(() =>
        reservation.checkIn(randomUUID())
      ).toThrow('Can only check in confirmed reservations')
    })

    test('should reject early check-in', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 7) // 7 days future
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      expect(() =>
        reservation.checkIn(randomUUID())
      ).toThrow('Cannot check in before check-in date')
    })

    test('should allow check-in notes', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      const notes = 'Late arrival, no issues'
      reservation.checkIn(randomUUID(), MoneyAmount.zero(), notes)

      expect(reservation.status).toBe(ReservationStatus.CHECKED_IN)
    })
  })

  describe('checkOut', () => {
    test('should check out checked-in reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      reservation.checkOut(staffId)

      expect(reservation.status).toBe(ReservationStatus.CHECKED_OUT)
      expect(reservation.checkedOutAt).toBeInstanceOf(Date)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('GuestCheckedOut')
      expect(reservation.isActive()).toBe(false)
    })

    test('should record damages at checkout', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())

      const staffId = randomUUID()
      reservation.checkOut(staffId, true, 'Broken picnic table')

      expect(reservation.status).toBe(ReservationStatus.CHECKED_OUT)
    })

    test('should reject checking out non-checked-in reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      expect(() =>
        reservation.checkOut(randomUUID())
      ).toThrow('Can only check out checked-in reservations')
    })
  })

  describe('complete', () => {
    test('should mark checked-out reservation as completed', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())
      reservation.checkOut(randomUUID())

      reservation.complete()

      expect(reservation.status).toBe(ReservationStatus.COMPLETED)
    })

    test('should reject completing non-checked-out reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      expect(() => reservation.complete()).toThrow('Can only complete checked-out reservations')
    })
  })

  describe('calculateBalance', () => {
    test('should calculate remaining balance', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(150), 'credit_card')

      const balance = reservation.calculateBalance()

      expect(balance.dollars).toBe(150)
    })

    test('should return zero for fully paid reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')

      const balance = reservation.calculateBalance()

      expect(balance.dollars).toBe(0)
    })
  })

  describe('canBeCancelled', () => {
    test('should allow cancelling pending reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      expect(reservation.canBeCancelled()).toBe(true)
    })

    test('should allow cancelling confirmed reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      expect(reservation.canBeCancelled()).toBe(true)
    })

    test('should reject cancelling checked-in reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())

      expect(reservation.canBeCancelled()).toBe(false)
    })

    test('should reject cancelling already cancelled reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.cancel('Guest cancelled', MoneyAmount.zero())

      expect(reservation.canBeCancelled()).toBe(false)
    })
  })

  describe('isUpcoming', () => {
    test('should return true for confirmed future reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 7)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      expect(reservation.isUpcoming()).toBe(true)
    })

    test('should return true for pending future reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 7)

      expect(reservation.isUpcoming()).toBe(true)
    })

    test('should return false for checked-in reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())

      expect(reservation.isUpcoming()).toBe(false)
    })

    test('should return false for cancelled reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 7)
      reservation.cancel('Guest cancelled', MoneyAmount.zero())

      expect(reservation.isUpcoming()).toBe(false)
    })
  })

  describe('updateNotes', () => {
    test('should update notes', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      reservation.updateNotes('Guest requested early check-in')

      expect(reservation.notes).toBe('Guest requested early check-in')
    })

    test('should trim whitespace', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      reservation.updateNotes('  Notes with spaces  ')

      expect(reservation.notes).toBe('Notes with spaces')
    })

    test('should set to null for empty string', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.updateNotes('Some notes')

      reservation.updateNotes('   ')

      expect(reservation.notes).toBe(null)
    })
  })

  describe('reconstitute', () => {
    test('should reconstitute reservation from database', () => {
      const id = randomUUID()
      const confirmationNumber = ConfirmationNumber.generate()
      const dateRange = DateRange.create(addDays(new Date(), 1), addDays(new Date(), 4))
      const occupancy = OccupancyInfo.create(2)
      const totalAmount = MoneyAmount.fromDollars(300)

      const props = {
        propertyId,
        siteId,
        guestId,
        confirmationNumber,
        dateRange,
        occupancy,
        totalAmount,
        paidAmount: MoneyAmount.fromDollars(150),
        status: ReservationStatus.PENDING,
        paymentStatus: PaymentStatus.PARTIAL,
        specialRequests: 'Late arrival',
        notes: null,
        source: 'phone',
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

      const reservation = Reservation.reconstitute(id, props)

      expect(reservation.id).toBe(id)
      expect(reservation.propertyId).toBe(propertyId)
      expect(reservation.paidAmount.dollars).toBe(150)
      expect(reservation.status).toBe(ReservationStatus.PENDING)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PARTIAL)
      expect(reservation.domainEvents).toHaveLength(0) // No events on reconstitute
    })
  })

  describe('fromPersistence', () => {
    test('should reconstitute from database row with correct column names', () => {
      // This test uses ACTUAL database column names (not _cents suffix)
      // to ensure fromPersistence matches the production schema
      const dbRow = {
        id: randomUUID(),
        property_id: propertyId,
        site_id: siteId,
        guest_id: guestId,
        confirmation_number: 'CAMP-2025-ABC123',
        check_in_date: addDays(new Date(), 7).toISOString(),
        check_out_date: addDays(new Date(), 10).toISOString(),
        num_adults: 2,
        num_children: 1,
        num_pets: 0,
        num_vehicles: 1,
        // CRITICAL: Database uses total_amount, NOT total_amount_cents
        total_amount: 30000, // $300.00 in cents
        paid_amount: 15000,  // $150.00 in cents
        status: 'pending',
        payment_status: 'partial',
        special_requests: 'Late arrival',
        notes: null,
        source: 'online',
        checked_in_at: null,
        checked_in_by: null,
        // CRITICAL: Database uses balance_paid_at_checkin, NOT balance_paid_at_check_in_cents
        balance_paid_at_checkin: null,
        check_in_notes: null,
        checked_out_at: null,
        checked_out_by: null,
        has_damages: false,
        check_out_notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const reservation = Reservation.fromPersistence(dbRow)

      expect(reservation.id).toBe(dbRow.id)
      expect(reservation.propertyId).toBe(propertyId)
      expect(reservation.confirmationNumber.value).toBe('CAMP-2025-ABC123')
      expect(reservation.totalAmount.amountInCents).toBe(30000)
      expect(reservation.totalAmount.dollars).toBe(300)
      expect(reservation.paidAmount.amountInCents).toBe(15000)
      expect(reservation.paidAmount.dollars).toBe(150)
      expect(reservation.status).toBe(ReservationStatus.PENDING)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PARTIAL)
    })

    test('should handle balance_paid_at_checkin when present', () => {
      const dbRow = {
        id: randomUUID(),
        property_id: propertyId,
        site_id: siteId,
        guest_id: guestId,
        confirmation_number: 'CAMP-2025-DEF456',
        check_in_date: new Date().toISOString(),
        check_out_date: addDays(new Date(), 3).toISOString(),
        num_adults: 2,
        num_children: 0,
        num_pets: 0,
        num_vehicles: 1,
        total_amount: 30000,
        paid_amount: 30000,
        status: 'checked_in',
        payment_status: 'paid',
        special_requests: null,
        notes: null,
        source: 'online',
        checked_in_at: new Date().toISOString(),
        checked_in_by: randomUUID(),
        balance_paid_at_checkin: 15000, // $150.00 paid at check-in
        check_in_notes: 'Arrived on time',
        checked_out_at: null,
        checked_out_by: null,
        has_damages: false,
        check_out_notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const reservation = Reservation.fromPersistence(dbRow)

      expect(reservation.status).toBe(ReservationStatus.CHECKED_IN)
      expect(reservation.checkedInAt).toBeInstanceOf(Date)
    })

    test('should handle decimal money amounts from database', () => {
      // Some databases may return numbers with floating point
      const dbRow = {
        id: randomUUID(),
        property_id: propertyId,
        site_id: siteId,
        guest_id: guestId,
        confirmation_number: 'CAMP-2025-GHI789',
        check_in_date: addDays(new Date(), 1).toISOString(),
        check_out_date: addDays(new Date(), 2).toISOString(),
        num_adults: 1,
        num_children: 0,
        num_pets: 0,
        num_vehicles: 0,
        total_amount: 10050.5, // Floating point from DB
        paid_amount: 5025.25,
        status: 'pending',
        payment_status: 'partial',
        special_requests: null,
        notes: null,
        source: 'online',
        checked_in_at: null,
        checked_in_by: null,
        balance_paid_at_checkin: null,
        check_in_notes: null,
        checked_out_at: null,
        checked_out_by: null,
        has_damages: false,
        check_out_notes: null,
        cancelled_at: null,
        cancellation_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      const reservation = Reservation.fromPersistence(dbRow)

      // Should round to nearest integer
      expect(reservation.totalAmount.amountInCents).toBe(10051)
      expect(reservation.paidAmount.amountInCents).toBe(5025)
    })
  })
})

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test reservation with sensible defaults
 *
 * @param propertyId - Property ID
 * @param siteId - Site ID
 * @param guestId - Guest ID
 * @param daysFromNow - Number of days from now for check-in (default: 7)
 */
function createTestReservation(
  propertyId: string,
  siteId: string,
  guestId: string,
  daysFromNow = 7
): Reservation {
  const confirmationNumber = ConfirmationNumber.generate()
  const checkIn = addDays(new Date(), daysFromNow)
  const checkOut = addDays(checkIn, 3) // 3 nights
  const dateRange = DateRange.create(checkIn, checkOut)
  const occupancy = OccupancyInfo.create(2, 1, 0, 1)
  const totalAmount = MoneyAmount.fromDollars(300)

  return Reservation.create(
    randomUUID(),
    propertyId,
    siteId,
    guestId,
    confirmationNumber,
    dateRange,
    occupancy,
    totalAmount
  )
}

/**
 * Reservation Aggregate Tests
 *
 * Tests for Reservation domain entity business logic and state machine.
 * Follows TDD best practices from CLAUDE.md.
 */

import { describe, test, expect } from 'vitest'
import { randomUUID } from 'crypto'
import { Reservation, ReservationStatus, PaymentStatus } from '../Reservation'
import { DateRange } from '../value-objects/DateRange'
import { MoneyAmount } from '../value-objects/MoneyAmount'
import { ConfirmationNumber } from '../value-objects/ConfirmationNumber'
import { OccupancyInfo } from '../value-objects/OccupancyInfo'
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

    test('should accept payment exceeding total amount', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      const overpayment = MoneyAmount.fromDollars(400)
      reservation.receivePayment(overpayment, 'credit_card')

      expect(reservation.paidAmount.dollars).toBe(400)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PAID)
      expect(reservation.isFullyPaid()).toBe(true)
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

    test('should allow confirming with partial payment (policy-free domain)', () => {
      // NOTE: Payment validation is now handled by IConfirmationPolicy at the
      // application layer, not by the domain model. This allows property owners
      // to configure different payment rules (full, deposit, none).
      // See: domain/policies/IConfirmationPolicy.ts
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(150), 'credit_card') // Partial only

      // Domain confirm() succeeds - policy validation happens at application layer
      reservation.confirm()

      expect(reservation.status).toBe(ReservationStatus.CONFIRMED)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PARTIAL)
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

    test('should allow overpayment at check-in', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      const extraPayment = MoneyAmount.fromDollars(50)
      reservation.checkIn(staffId, extraPayment, 'Extra collected at check-in')

      expect(reservation.status).toBe(ReservationStatus.CHECKED_IN)
      expect(reservation.paidAmount.dollars).toBe(350)
      expect(reservation.paymentStatus).toBe(PaymentStatus.PAID)
      const eventNames = reservation.domainEvents.map((e) => e.constructor.name)
      expect(eventNames).toContain('PaymentReceived')
      expect(eventNames).toContain('GuestCheckedIn')
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

    test('should return zero when paid exceeds total (overpayment)', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(350), 'credit_card')

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
        incidentalsPaymentMethodId: null,
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
        incidentals_payment_method_id: null,
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
        incidentals_payment_method_id: 'pm_1234567890',
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
        incidentals_payment_method_id: null,
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

  // ============================================================================
  // Schema Validation Tests (TE-4)
  // ============================================================================

  describe('toPersistence schema validation', () => {
    // These are the ACTUAL column names from src/contracts/db.ts reservations table
    const VALID_DB_COLUMNS = [
      'id',
      'property_id',
      'site_id',
      'guest_id',
      'confirmation_number',
      'check_in_date',
      'check_out_date',
      'num_adults',
      'num_children',
      'num_pets',
      'num_vehicles',
      'total_amount',        // NOT total_amount_cents
      'paid_amount',         // NOT paid_amount_cents
      'status',
      'payment_status',
      'special_requests',
      'notes',
      'source',
      'checked_in_at',
      'checked_in_by',
      'balance_paid_at_checkin', // NOT balance_paid_at_check_in_cents
      'check_in_notes',
      'incidentals_payment_method_id',
      'checked_out_at',
      'checked_out_by',
      'check_out_notes',
      'cancelled_at',
      'created_at',
      'updated_at',
      // Additional columns that exist in DB but may not be used by this entity:
      'booking_period',
      'booking_type',
      'damage_inspection_data',
      'equipment_length',
      'equipment_type',
      'is_extension_of',
      'original_check_in',
      'original_check_out',
      'parent_reservation_id',
      'renewal_deadline',
      'renewal_notes',
      'renewal_offered_at',
      'renewal_status',
      'reserved_until',
      'times_extended',
      'times_modified',
      'vehicle_info',
    ]

    test('toPersistence outputs only valid database column names', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      const persisted = reservation.toPersistence()

      // Check that all keys in persisted object are valid DB columns
      const persistedKeys = Object.keys(persisted)

      persistedKeys.forEach((key) => {
        expect(
          VALID_DB_COLUMNS,
          `Column "${key}" does not exist in database schema`
        ).toContain(key)
      })
    })

    test('toPersistence does NOT output _cents suffix columns', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      const persisted = reservation.toPersistence()
      const persistedKeys = Object.keys(persisted)

      // These column names are WRONG and should NOT appear
      expect(persistedKeys).not.toContain('total_amount_cents')
      expect(persistedKeys).not.toContain('paid_amount_cents')
      expect(persistedKeys).not.toContain('balance_paid_at_check_in_cents')
      expect(persistedKeys).not.toContain('refund_amount_cents')
    })

    test('toPersistence does NOT output columns that do not exist', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      const persisted = reservation.toPersistence()
      const persistedKeys = Object.keys(persisted)

      // These columns do NOT exist in the database
      expect(persistedKeys).not.toContain('cancellation_reason')
      expect(persistedKeys).not.toContain('has_damages')
      expect(persistedKeys).not.toContain('refund_amount')
    })

    test('toPersistence outputs correct column names for money fields', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(150), 'credit_card')

      const persisted = reservation.toPersistence()

      // Correct column names
      expect(persisted).toHaveProperty('total_amount')
      expect(persisted).toHaveProperty('paid_amount')
      expect(persisted.total_amount).toBe(30000) // $300 in cents
      expect(persisted.paid_amount).toBe(15000)  // $150 in cents
    })

    test('toPersistence outputs balance_paid_at_checkin with correct name', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(200), 'credit_card')
      reservation.confirm()
      reservation.checkIn('staff-123', MoneyAmount.fromDollars(100))

      const persisted = reservation.toPersistence()

      expect(persisted).toHaveProperty('balance_paid_at_checkin')
      expect(persisted.balance_paid_at_checkin).toBe(10000) // $100 in cents
    })
  })

  // ============================================================================
  // Round-Trip Persistence Tests (TE-3)
  // ============================================================================

  describe('persistence round-trip', () => {
    test('round-trip preserves all reservation data', () => {
      // Create a reservation with various states
      const original = createTestReservation(propertyId, siteId, guestId, 0)
      original.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      original.confirm()
      original.checkIn('staff-123', MoneyAmount.zero(), 'Early check-in')
      original.updateNotes('VIP guest')
      original.clearDomainEvents()

      // Convert to persistence format
      const persisted = original.toPersistence()

      // Reconstitute from persistence
      const reconstituted = Reservation.fromPersistence(persisted)

      // Verify ALL fields match
      expect(reconstituted.id).toBe(original.id)
      expect(reconstituted.propertyId).toBe(original.propertyId)
      expect(reconstituted.siteId).toBe(original.siteId)
      expect(reconstituted.guestId).toBe(original.guestId)
      expect(reconstituted.confirmationNumber.value).toBe(original.confirmationNumber.value)
      expect(reconstituted.checkInDate.toISOString()).toBe(original.checkInDate.toISOString())
      expect(reconstituted.checkOutDate.toISOString()).toBe(original.checkOutDate.toISOString())
      expect(reconstituted.nights).toBe(original.nights)
      expect(reconstituted.occupancy.numAdults).toBe(original.occupancy.numAdults)
      expect(reconstituted.occupancy.numChildren).toBe(original.occupancy.numChildren)
      expect(reconstituted.occupancy.numPets).toBe(original.occupancy.numPets)
      expect(reconstituted.occupancy.numVehicles).toBe(original.occupancy.numVehicles)
      expect(reconstituted.totalAmount.amountInCents).toBe(original.totalAmount.amountInCents)
      expect(reconstituted.paidAmount.amountInCents).toBe(original.paidAmount.amountInCents)
      expect(reconstituted.status).toBe(original.status)
      expect(reconstituted.paymentStatus).toBe(original.paymentStatus)
      expect(reconstituted.source).toBe(original.source)
      expect(reconstituted.notes).toBe(original.notes)
      expect(reconstituted.checkedInAt).toBeInstanceOf(Date)
    })

    test('round-trip preserves cancelled reservation data', () => {
      const original = createTestReservation(propertyId, siteId, guestId)
      original.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')
      original.cancel('Guest requested cancellation', MoneyAmount.fromDollars(80))
      original.clearDomainEvents()

      const persisted = original.toPersistence()
      const reconstituted = Reservation.fromPersistence(persisted)

      expect(reconstituted.status).toBe(ReservationStatus.CANCELLED)
      expect(reconstituted.cancelledAt).toBeInstanceOf(Date)
    })
  })

  // ============================================================================
  // Modification Methods Tests
  // ============================================================================

  describe('canBeModified', () => {
    test('should allow modifying pending reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      expect(reservation.canBeModified()).toBe(true)
    })

    test('should allow modifying confirmed reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()

      expect(reservation.canBeModified()).toBe(true)
    })

    test('should not allow modifying checked-in reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())

      expect(reservation.canBeModified()).toBe(false)
    })

    test('should not allow modifying cancelled reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.cancel('Guest cancelled', MoneyAmount.zero())

      expect(reservation.canBeModified()).toBe(false)
    })

    test('should not allow modifying no-show reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.markNoShow('staff-123')

      expect(reservation.canBeModified()).toBe(false)
    })
  })

  describe('modifyDates', () => {
    test('should modify dates for pending reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.clearDomainEvents()

      const newCheckIn = addDays(new Date(), 14)
      const newCheckOut = addDays(new Date(), 18)
      const newDateRange = DateRange.create(newCheckIn, newCheckOut)
      const newTotal = MoneyAmount.fromDollars(400) // 4 nights

      reservation.modifyDates(newDateRange, newTotal)

      expect(reservation.dateRange.checkIn.toDateString()).toBe(newCheckIn.toDateString())
      expect(reservation.dateRange.checkOut.toDateString()).toBe(newCheckOut.toDateString())
      expect(reservation.nights).toBe(4)
      expect(reservation.totalAmount.dollars).toBe(400)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('ReservationModified')
    })

    test('should modify dates for confirmed reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.clearDomainEvents()

      const newCheckIn = addDays(new Date(), 21)
      const newCheckOut = addDays(new Date(), 24)
      const newDateRange = DateRange.create(newCheckIn, newCheckOut)
      const newTotal = MoneyAmount.fromDollars(300)

      reservation.modifyDates(newDateRange, newTotal)

      expect(reservation.status).toBe(ReservationStatus.CONFIRMED)
      expect(reservation.nights).toBe(3)
    })

    test('should reject modifying dates for checked-in reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())

      const newDateRange = DateRange.create(addDays(new Date(), 1), addDays(new Date(), 5))

      expect(() =>
        reservation.modifyDates(newDateRange, MoneyAmount.fromDollars(400))
      ).toThrow('Cannot modify reservation in current status')
    })

    test('should reject modifying dates to past dates', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      const pastCheckIn = addDays(new Date(), -7)
      const pastCheckOut = addDays(new Date(), -4)
      const pastDateRange = DateRange.create(pastCheckIn, pastCheckOut)

      expect(() =>
        reservation.modifyDates(pastDateRange, MoneyAmount.fromDollars(300))
      ).toThrow('Cannot modify reservation to past dates')
    })

    test('should publish ReservationModified event with date modification details', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      const originalCheckIn = reservation.checkInDate
      const originalCheckOut = reservation.checkOutDate
      reservation.clearDomainEvents()

      const newCheckIn = addDays(new Date(), 14)
      const newCheckOut = addDays(new Date(), 17)
      const newDateRange = DateRange.create(newCheckIn, newCheckOut)
      const newTotal = MoneyAmount.fromDollars(350)

      reservation.modifyDates(newDateRange, newTotal)

      const event = reservation.domainEvents[0] as any
      expect(event.modificationType).toBe('dates')
      // Compare dates by date string since DateRange normalizes time component
      expect(event.dateModification.previousCheckIn.toDateString()).toBe(originalCheckIn.toDateString())
      expect(event.dateModification.previousCheckOut.toDateString()).toBe(originalCheckOut.toDateString())
      expect(event.dateModification.newCheckIn.toDateString()).toBe(newCheckIn.toDateString())
      expect(event.dateModification.newCheckOut.toDateString()).toBe(newCheckOut.toDateString())
    })
  })

  describe('modifyGuestCount', () => {
    test('should modify guest count for pending reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.clearDomainEvents()

      const newOccupancy = OccupancyInfo.create(4, 2, 1, 2)
      const newTotal = MoneyAmount.fromDollars(450)

      reservation.modifyGuestCount(newOccupancy, newTotal)

      expect(reservation.occupancy.numAdults).toBe(4)
      expect(reservation.occupancy.numChildren).toBe(2)
      expect(reservation.occupancy.numPets).toBe(1)
      expect(reservation.occupancy.numVehicles).toBe(2)
      expect(reservation.totalAmount.dollars).toBe(450)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('ReservationModified')
    })

    test('should modify guest count for confirmed reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.clearDomainEvents()

      const newOccupancy = OccupancyInfo.create(3, 0, 0, 1)
      const newTotal = MoneyAmount.fromDollars(350)

      reservation.modifyGuestCount(newOccupancy, newTotal)

      expect(reservation.status).toBe(ReservationStatus.CONFIRMED)
      expect(reservation.occupancy.numAdults).toBe(3)
    })

    test('should reject modifying guest count for checked-in reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())

      expect(() =>
        reservation.modifyGuestCount(OccupancyInfo.create(4), MoneyAmount.fromDollars(400))
      ).toThrow('Cannot modify reservation in current status')
    })

    test('should publish ReservationModified event with guest modification details', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.clearDomainEvents()

      const newOccupancy = OccupancyInfo.create(5, 3, 0, 2)
      const newTotal = MoneyAmount.fromDollars(500)

      reservation.modifyGuestCount(newOccupancy, newTotal)

      const event = reservation.domainEvents[0] as any
      expect(event.modificationType).toBe('guests')
      expect(event.guestModification.previousAdults).toBe(2) // Original from createTestReservation
      expect(event.guestModification.previousChildren).toBe(1)
      expect(event.guestModification.newAdults).toBe(5)
      expect(event.guestModification.newChildren).toBe(3)
    })
  })

  describe('markNoShow', () => {
    test('should mark confirmed reservation as no-show', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      reservation.markNoShow(staffId)

      expect(reservation.status).toBe(ReservationStatus.NO_SHOW)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('NoShowMarked')
    })

    test('should reject marking pending reservation as no-show', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      expect(() =>
        reservation.markNoShow(randomUUID())
      ).toThrow('Can only mark confirmed reservations as no-show')
    })

    test('should reject marking checked-in reservation as no-show', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId, 0)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.checkIn(randomUUID())

      expect(() =>
        reservation.markNoShow(randomUUID())
      ).toThrow('Can only mark confirmed reservations as no-show')
    })

    test('should publish NoShowMarked event with correct details', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      reservation.markNoShow(staffId)

      const event = reservation.domainEvents[0] as any
      expect(event.reservationId).toBe(reservation.id)
      expect(event.confirmationNumber).toBe(reservation.confirmationNumber.value)
      expect(event.markedBy).toBe(staffId)
      expect(event.scheduledCheckInDate.getTime()).toBe(reservation.checkInDate.getTime())
    })
  })

  describe('canBeCancelled with NO_SHOW', () => {
    test('should not allow cancelling no-show reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.markNoShow(randomUUID())

      expect(reservation.canBeCancelled()).toBe(false)
    })

    test('should reject cancel call on no-show reservation', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.confirm()
      reservation.markNoShow(randomUUID())

      expect(() =>
        reservation.cancel('Attempt to cancel', MoneyAmount.zero())
      ).toThrow('Reservation cannot be cancelled in current status')
    })
  })

  describe('issueRefund', () => {
    test('should issue partial refund', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      reservation.issueRefund(
        MoneyAmount.fromDollars(100),
        'service_issue',
        staffId,
        'Guest complained about noise'
      )

      expect(reservation.totalRefunded.dollars).toBe(100)
      expect(reservation.maxRefundableAmount.dollars).toBe(200)
      expect(reservation.canIssueRefund()).toBe(true)
      expect(reservation.domainEvents).toHaveLength(1)
      expect(reservation.domainEvents[0]!.constructor.name).toBe('RefundInitiated')
    })

    test('should issue full refund and update payment status', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      reservation.issueRefund(
        MoneyAmount.fromDollars(300),
        'cancellation',
        staffId
      )

      expect(reservation.totalRefunded.dollars).toBe(300)
      expect(reservation.paymentStatus).toBe(PaymentStatus.REFUNDED)
      expect(reservation.canIssueRefund()).toBe(false)
      expect(reservation.maxRefundableAmount.dollars).toBe(0)
    })

    test('should accumulate multiple refunds', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      reservation.issueRefund(MoneyAmount.fromDollars(100), 'service_issue', staffId)
      reservation.issueRefund(MoneyAmount.fromDollars(50), 'partial_cancellation', staffId)

      expect(reservation.totalRefunded.dollars).toBe(150)
      expect(reservation.maxRefundableAmount.dollars).toBe(150)
      expect(reservation.domainEvents).toHaveLength(2)
    })

    test('should reject refund exceeding paid amount', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')

      expect(() =>
        reservation.issueRefund(
          MoneyAmount.fromDollars(200),
          'cancellation',
          randomUUID()
        )
      ).toThrow('Refund amount cannot exceed paid amount')
    })

    test('should reject zero refund', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')

      expect(() =>
        reservation.issueRefund(
          MoneyAmount.zero(),
          'cancellation',
          randomUUID()
        )
      ).toThrow('Refund amount must be positive')
    })

    test('should publish RefundInitiated event with correct details', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(300), 'credit_card')
      reservation.clearDomainEvents()

      const staffId = randomUUID()
      const notes = 'Refund due to weather closure'
      reservation.issueRefund(
        MoneyAmount.fromDollars(150),
        'weather',
        staffId,
        notes
      )

      const event = reservation.domainEvents[0] as any
      expect(event.reservationId).toBe(reservation.id)
      expect(event.confirmationNumber).toBe(reservation.confirmationNumber.value)
      expect(event.refundAmountCents).toBe(15000)
      expect(event.reason).toBe('weather')
      expect(event.notes).toBe(notes)
      expect(event.initiatedBy).toBe(staffId)
    })
  })

  describe('canIssueRefund', () => {
    test('should return true when there is paid amount and no refunds', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')

      expect(reservation.canIssueRefund()).toBe(true)
    })

    test('should return false when no payments made', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)

      expect(reservation.canIssueRefund()).toBe(false)
    })

    test('should return false when fully refunded', () => {
      const reservation = createTestReservation(propertyId, siteId, guestId)
      reservation.receivePayment(MoneyAmount.fromDollars(100), 'credit_card')
      reservation.issueRefund(MoneyAmount.fromDollars(100), 'cancellation', randomUUID())

      expect(reservation.canIssueRefund()).toBe(false)
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

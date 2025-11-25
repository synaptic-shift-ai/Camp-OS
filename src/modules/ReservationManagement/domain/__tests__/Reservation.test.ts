/**
 * Reservation Aggregate Tests
 *
 * Following CLAUDE.md testing best practices:
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterize test inputs
 * - T-8: Test description states what expect verifies
 * - T-10: Test edge cases and boundaries
 */

import { describe, test, expect } from 'vitest'
import { Reservation, ReservationStatus } from '../Reservation'
import { DateRange } from '../DateRange'
import { ReservationPricing } from '../ReservationPricing'
import { GuestCount } from '../GuestCount'

describe('Reservation', () => {
  // Helper to create dates at midnight UTC
  const createDate = (year: number, month: number, day: number): Date => {
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
  }

  // Test data
  const propertyId = 'prop-123'
  const siteId = 'site-456'
  const guestId = 'guest-789'
  const checkIn = createDate(2025, 12, 1)
  const checkOut = createDate(2025, 12, 5)
  const dateRange = DateRange.create(checkIn, checkOut)
  const guestCount = GuestCount.create(2, 1, 1, 1) // 2 adults, 1 child, 1 pet, 1 vehicle
  const pricing = ReservationPricing.create(10000, 1000) // $100 + $10 tax = $110

  describe('create', () => {
    test('should create new pending reservation with confirmation number', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      expect(reservation.propertyId).toBe(propertyId)
      expect(reservation.siteId).toBe(siteId)
      expect(reservation.guestId).toBe(guestId)
      expect(reservation.dateRange).toBe(dateRange)
      expect(reservation.guestCount).toBe(guestCount)
      expect(reservation.pricing).toBe(pricing)
      expect(reservation.status).toBe(ReservationStatus.PENDING)
      expect(reservation.confirmationNumber).toMatch(/^RES-\d{8}-[A-Z0-9]{4}$/)
      expect(reservation.source).toBe('online')
    })

    test('should create reservation with special requests', () => {
      const specialRequests = 'Need early check-in'
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing,
        'online',
        specialRequests
      )

      expect(reservation.specialRequests).toBe(specialRequests)
    })

    test('should create reservation with custom source', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing,
        'phone'
      )

      expect(reservation.source).toBe('phone')
    })

    test('should emit ReservationCreatedEvent', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      const events = reservation.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]!.eventType).toBe('ReservationCreatedEvent')
      expect((events[0] as any).reservationId).toBe(reservation.id)
      expect((events[0] as any).totalGuests).toBe(3) // 2 adults + 1 child
      expect((events[0] as any).totalAmount).toBe(11000)
    })
  })

  describe('fromPersistence', () => {
    test('should reconstruct reservation from persistence', () => {
      const id = 'res-abc-123'
      const props = {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: pricing.recordPayment(11000), // Fully paid
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      }

      const reservation = Reservation.fromPersistence(id, props)

      expect(reservation.id).toBe(id)
      expect(reservation.propertyId).toBe(propertyId)
      expect(reservation.status).toBe(ReservationStatus.CONFIRMED)
      expect(reservation.pricing.isPaidInFull()).toBe(true)
    })
  })

  describe('status checks', () => {
    test('should identify pending reservation', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      expect(reservation.isPending()).toBe(true)
      expect(reservation.isConfirmed()).toBe(false)
      expect(reservation.isActive()).toBe(false)
    })

    test('should identify confirmed reservation as active', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        paidPricing
      )
      reservation.confirm()

      expect(reservation.isPending()).toBe(false)
      expect(reservation.isConfirmed()).toBe(true)
      expect(reservation.isActive()).toBe(true)
    })

    test('should identify checked-in reservation as active', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CHECKED_IN,
        source: 'online',
      })

      expect(reservation.isCheckedIn()).toBe(true)
      expect(reservation.isActive()).toBe(true)
    })
  })

  describe('confirm', () => {
    test('should confirm pending reservation that is paid in full', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        paidPricing
      )

      reservation.confirm()

      expect(reservation.status).toBe(ReservationStatus.CONFIRMED)
    })

    test('should emit ReservationConfirmedEvent', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        paidPricing
      )

      reservation.clearDomainEvents() // Clear creation event
      reservation.confirm()

      const events = reservation.getDomainEvents()
      expect(events).toHaveLength(1)
      expect(events[0]!.eventType).toBe('ReservationConfirmedEvent')
      expect((events[0] as any).confirmationNumber).toBe(reservation.confirmationNumber)
    })

    test('should reject confirmation of non-pending reservation', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: pricing.recordPayment(11000),
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      expect(() => reservation.confirm()).toThrow(
        'Cannot confirm reservation with status confirmed. Must be pending.'
      )
    })

    test('should reject confirmation of unpaid reservation', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing // Not paid
      )

      expect(() => reservation.confirm()).toThrow(
        'Cannot confirm reservation that is not paid in full'
      )
    })
  })

  describe('cancel', () => {
    test('should cancel confirmed reservation', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      reservation.cancel('Guest requested cancellation')

      expect(reservation.status).toBe(ReservationStatus.CANCELLED)
      expect(reservation.cancelledAt).toBeInstanceOf(Date)
      expect(reservation.notes).toContain('Cancellation reason: Guest requested cancellation')
    })

    test('should emit ReservationCancelledEvent with refund amount', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      reservation.cancel()

      const events = reservation.getDomainEvents()
      expect(events[0]!.eventType).toBe('ReservationCancelledEvent')
      expect((events[0] as any).previousStatus).toBe(ReservationStatus.CONFIRMED)
      expect((events[0] as any).refundAmount).toBe(11000) // Net payment
    })

    test('should reject cancelling already cancelled reservation', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CANCELLED,
        source: 'online',
      })

      expect(() => reservation.cancel()).toThrow('Reservation is already cancelled')
    })

    test('should reject cancelling checked-out reservation', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CHECKED_OUT,
        source: 'online',
      })

      expect(() => reservation.cancel()).toThrow(
        'Cannot cancel a checked-out reservation'
      )
    })
  })

  describe('checkIn', () => {
    test('should check in confirmed reservation', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      reservation.checkIn()

      expect(reservation.status).toBe(ReservationStatus.CHECKED_IN)
      expect(reservation.checkedInAt).toBeInstanceOf(Date)
    })

    test('should reject check-in of non-confirmed reservation', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      expect(() => reservation.checkIn()).toThrow(
        'Cannot check in reservation with status pending. Must be confirmed.'
      )
    })
  })

  describe('checkOut', () => {
    test('should check out checked-in reservation', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CHECKED_IN,
        source: 'online',
      })

      reservation.checkOut()

      expect(reservation.status).toBe(ReservationStatus.CHECKED_OUT)
      expect(reservation.checkedOutAt).toBeInstanceOf(Date)
    })

    test('should reject check-out of non-checked-in reservation', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      expect(() => reservation.checkOut()).toThrow(
        'Cannot check out reservation with status confirmed. Must be checked in.'
      )
    })
  })

  describe('markNoShow', () => {
    test('should mark confirmed reservation as no-show', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      reservation.markNoShow()

      expect(reservation.status).toBe(ReservationStatus.NO_SHOW)
    })

    test('should reject marking non-confirmed reservation as no-show', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      expect(() => reservation.markNoShow()).toThrow(
        'Cannot mark as no-show with status pending. Must be confirmed.'
      )
    })
  })

  describe('recordPayment', () => {
    test('should record payment for pending reservation', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      reservation.clearDomainEvents() // Clear creation event
      reservation.recordPayment(5000)

      expect(reservation.pricing.amountPaid).toBe(5000)
      expect(reservation.pricing.balanceDue).toBe(6000)
      expect(reservation.status).toBe(ReservationStatus.PENDING) // Still pending
    })

    test('should auto-confirm when full payment received', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      reservation.recordPayment(11000)

      expect(reservation.pricing.isPaidInFull()).toBe(true)
      expect(reservation.status).toBe(ReservationStatus.CONFIRMED)
    })

    test('should emit PaymentRecordedEvent', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      reservation.clearDomainEvents()
      reservation.recordPayment(5000, 'cash')

      const events = reservation.getDomainEvents()
      expect(events.some((e) => e.eventType === 'PaymentRecordedEvent')).toBe(true)
      const paymentEvent = events.find((e) => e.eventType === 'PaymentRecordedEvent') as any
      expect(paymentEvent?.amount).toBe(5000)
      expect(paymentEvent?.paymentMethod).toBe('cash')
    })

    test('should reject payment for cancelled reservation', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CANCELLED,
        source: 'online',
      })

      expect(() => reservation.recordPayment(5000)).toThrow(
        'Cannot record payment for cancelled reservation'
      )
    })
  })

  describe('issueRefund', () => {
    test('should issue refund for paid reservation', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      reservation.issueRefund(3000, 'Partial refund due to early checkout')

      expect(reservation.pricing.amountRefunded).toBe(3000)
      expect(reservation.pricing.balanceDue).toBe(3000)
      expect(reservation.notes).toContain('Refund: Partial refund due to early checkout')
    })

    test('should emit RefundIssuedEvent', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      reservation.issueRefund(3000)

      const events = reservation.getDomainEvents()
      expect(events[0]!.eventType).toBe('RefundIssuedEvent')
      expect((events[0] as any).amount).toBe(3000)
      expect((events[0] as any).remainingBalance).toBe(3000)
    })
  })

  describe('modifyDates', () => {
    test('should modify dates for confirmed reservation', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      const newCheckIn = createDate(2025, 12, 5)
      const newCheckOut = createDate(2025, 12, 10)
      const newDateRange = DateRange.create(newCheckIn, newCheckOut)
      const newPricing = ReservationPricing.create(15000, 1500)

      reservation.modifyDates(newDateRange, newPricing)

      expect(reservation.dateRange).toBe(newDateRange)
      expect(reservation.pricing).toBe(newPricing)
    })

    test('should emit ReservationModifiedEvent', () => {
      const paidPricing = pricing.recordPayment(11000)
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing: paidPricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      const newDateRange = DateRange.create(createDate(2025, 12, 5), createDate(2025, 12, 10))
      const newPricing = ReservationPricing.create(15000, 1500)

      reservation.modifyDates(newDateRange, newPricing)

      const events = reservation.getDomainEvents()
      expect(events[0]!.eventType).toBe('ReservationModifiedEvent')
      expect((events[0] as any).modificationType).toBe('dates')
    })

    test('should reject modifying dates for cancelled reservation', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CANCELLED,
        source: 'online',
      })

      const newDateRange = DateRange.create(createDate(2025, 12, 5), createDate(2025, 12, 10))
      const newPricing = ReservationPricing.create(15000, 1500)

      expect(() => reservation.modifyDates(newDateRange, newPricing)).toThrow(
        'Cannot modify cancelled reservation'
      )
    })

    test('should reject modifying dates for checked-in reservation', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CHECKED_IN,
        source: 'online',
      })

      const newDateRange = DateRange.create(createDate(2025, 12, 5), createDate(2025, 12, 10))
      const newPricing = ReservationPricing.create(15000, 1500)

      expect(() => reservation.modifyDates(newDateRange, newPricing)).toThrow(
        'Cannot modify dates for checked-in or checked-out reservation'
      )
    })
  })

  describe('modifyGuestCount', () => {
    test('should modify guest count within site capacity', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      const newGuestCount = GuestCount.create(3, 2) // 5 total
      const siteMaxOccupancy = 6

      reservation.modifyGuestCount(newGuestCount, siteMaxOccupancy)

      expect(reservation.guestCount).toBe(newGuestCount)
    })

    test('should reject guest count exceeding site capacity', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
      })

      const newGuestCount = GuestCount.create(5, 3) // 8 total
      const siteMaxOccupancy = 6

      expect(() => reservation.modifyGuestCount(newGuestCount, siteMaxOccupancy)).toThrow(
        'Guest count (8) exceeds site capacity (6)'
      )
    })

    test('should reject modifying guest count for cancelled reservation', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CANCELLED,
        source: 'online',
      })

      const newGuestCount = GuestCount.create(3, 2)

      expect(() => reservation.modifyGuestCount(newGuestCount, 10)).toThrow(
        'Cannot modify cancelled reservation'
      )
    })
  })

  describe('addNote', () => {
    test('should add note to reservation without existing notes', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      reservation.addNote('Guest called about early check-in')

      expect(reservation.notes).toBe('Guest called about early check-in')
    })

    test('should append note to existing notes', () => {
      const reservation = Reservation.fromPersistence('res-123', {
        propertyId,
        siteId,
        guestId,
        confirmationNumber: 'RES-20251108-ABCD',
        dateRange,
        guestCount,
        pricing,
        status: ReservationStatus.CONFIRMED,
        source: 'online',
        notes: 'Initial note',
      })

      reservation.addNote('Second note')

      expect(reservation.notes).toBe('Initial note\n\nSecond note')
    })
  })

  describe('updateSpecialRequests', () => {
    test('should update special requests', () => {
      const reservation = Reservation.create(
        propertyId,
        siteId,
        guestId,
        dateRange,
        guestCount,
        pricing
      )

      reservation.updateSpecialRequests('Need wheelchair accessible site')

      expect(reservation.specialRequests).toBe('Need wheelchair accessible site')
    })
  })
})

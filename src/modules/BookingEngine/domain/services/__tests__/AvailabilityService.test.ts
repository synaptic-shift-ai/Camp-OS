/**
 * AvailabilityService Tests
 *
 * Tests for the availability domain service.
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { AvailabilityService } from '../AvailabilityService'
import type { IReservationRepository } from '../../IReservationRepository'
import { DateRange } from '../../value-objects/DateRange'
import { Reservation, ReservationStatus } from '../../Reservation'
import { MoneyAmount } from '../../value-objects/MoneyAmount'
import { OccupancyInfo } from '../../value-objects/OccupancyInfo'
import { ConfirmationNumber } from '../../value-objects/ConfirmationNumber'

// Helper to create future dates
const daysFromNow = (days: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(14, 0, 0, 0)
  return date
}

// Helper to create test reservation
const createTestReservation = (
  id: string,
  siteId: string,
  checkInDays: number,
  checkOutDays: number
): Reservation => {
  const checkIn = daysFromNow(checkInDays)
  const checkOut = daysFromNow(checkOutDays)

  return Reservation.create(
    id,
    'property-123',
    siteId,
    'guest-123',
    ConfirmationNumber.generate(),
    DateRange.create(checkIn, checkOut),
    OccupancyInfo.create(2, 0, 0, 1),
    MoneyAmount.fromDollars(300)
  )
}

describe('AvailabilityService', () => {
  let service: AvailabilityService
  let mockRepository: IReservationRepository

  beforeEach(() => {
    mockRepository = {
      findById: vi.fn(),
      findByConfirmationNumber: vi.fn(),
      findByPropertyId: vi.fn(),
      findByPropertyIdWithFilters: vi.fn(),
      findByGuestId: vi.fn(),
      findBySiteId: vi.fn(),
      findBySiteIdAndDateRange: vi.fn(),
      findByPropertyIdAndDateRange: vi.fn(),
      existsForSiteInDateRange: vi.fn(),
      save: vi.fn(),
      delete: vi.fn(),
      findUpcoming: vi.fn(),
      findActive: vi.fn(),
    }

    service = new AvailabilityService(mockRepository)
  })

  describe('checkSiteAvailability', () => {
    test('should return available when no conflicting reservations', async () => {
      vi.mocked(mockRepository.findBySiteIdAndDateRange).mockResolvedValue([])

      const dateRange = DateRange.create(daysFromNow(7), daysFromNow(10))
      const result = await service.checkSiteAvailability('site-123', dateRange)

      expect(result.isAvailable).toBe(true)
      expect(result.conflictingReservations).toHaveLength(0)
      expect(result.unavailableReason).toBeUndefined()
    })

    test('should return unavailable when conflicting reservations exist', async () => {
      const conflictingReservation = createTestReservation('res-1', 'site-123', 8, 12)
      vi.mocked(mockRepository.findBySiteIdAndDateRange).mockResolvedValue([conflictingReservation])

      const dateRange = DateRange.create(daysFromNow(7), daysFromNow(10))
      const result = await service.checkSiteAvailability('site-123', dateRange)

      expect(result.isAvailable).toBe(false)
      expect(result.conflictingReservations).toHaveLength(1)
      expect(result.unavailableReason).toBe('CONFLICTING_RESERVATION')
    })

    test('should exclude specified reservation IDs', async () => {
      const reservation = createTestReservation('res-to-exclude', 'site-123', 8, 12)
      vi.mocked(mockRepository.findBySiteIdAndDateRange).mockResolvedValue([reservation])

      const dateRange = DateRange.create(daysFromNow(7), daysFromNow(10))
      const result = await service.checkSiteAvailability('site-123', dateRange, {
        excludeReservationIds: ['res-to-exclude'],
      })

      expect(result.isAvailable).toBe(true)
      expect(result.conflictingReservations).toHaveLength(0)
    })

    test('should not exclude non-matching reservation IDs', async () => {
      const reservation = createTestReservation('res-other', 'site-123', 8, 12)
      vi.mocked(mockRepository.findBySiteIdAndDateRange).mockResolvedValue([reservation])

      const dateRange = DateRange.create(daysFromNow(7), daysFromNow(10))
      const result = await service.checkSiteAvailability('site-123', dateRange, {
        excludeReservationIds: ['res-different'],
      })

      expect(result.isAvailable).toBe(false)
      expect(result.conflictingReservations).toHaveLength(1)
    })
  })

  describe('checkMultipleSitesAvailability', () => {
    test('should check availability for multiple sites', async () => {
      vi.mocked(mockRepository.findBySiteIdAndDateRange)
        .mockResolvedValueOnce([]) // site-1 available
        .mockResolvedValueOnce([createTestReservation('res-1', 'site-2', 8, 12)]) // site-2 occupied
        .mockResolvedValueOnce([]) // site-3 available

      const dateRange = DateRange.create(daysFromNow(7), daysFromNow(10))
      const results = await service.checkMultipleSitesAvailability(
        ['site-1', 'site-2', 'site-3'],
        dateRange
      )

      expect(results).toHaveLength(3)
      expect(results[0]!.siteId).toBe('site-1')
      expect(results[0]!.result.isAvailable).toBe(true)
      expect(results[1]!.siteId).toBe('site-2')
      expect(results[1]!.result.isAvailable).toBe(false)
      expect(results[2]!.siteId).toBe('site-3')
      expect(results[2]!.result.isAvailable).toBe(true)
    })
  })

  describe('findAvailableSites', () => {
    test('should return empty array (placeholder implementation)', async () => {
      vi.mocked(mockRepository.findByPropertyIdAndDateRange).mockResolvedValue([])

      const dateRange = DateRange.create(daysFromNow(7), daysFromNow(10))
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = await service.findAvailableSites('property-123', dateRange)

      expect(result).toEqual([])
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

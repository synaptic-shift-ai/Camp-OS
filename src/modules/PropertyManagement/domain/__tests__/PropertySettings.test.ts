/**
 * PropertySettings Value Object Tests
 */
import { describe, it, expect } from 'vitest'
import { PropertySettings } from '../PropertySettings'

describe('PropertySettings', () => {
  describe('create', () => {
    it('should create settings with all fields', () => {
      const settings = PropertySettings.create({
        checkInTime: '15:00',
        checkOutTime: '10:00',
        timezone: 'America/Denver',
        cancellationPolicy: 'strict',
        minStayNights: 2,
        maxStayNights: 14,
        bookingLeadTimeDays: 180,
        customRules: 'No pets allowed',
      })

      expect(settings.checkInTime).toBe('15:00')
      expect(settings.checkOutTime).toBe('10:00')
      expect(settings.timezone).toBe('America/Denver')
      expect(settings.cancellationPolicy).toBe('strict')
      expect(settings.minStayNights).toBe(2)
      expect(settings.maxStayNights).toBe(14)
      expect(settings.bookingLeadTimeDays).toBe(180)
      expect(settings.customRules).toBe('No pets allowed')
    })

    it('should create settings with partial fields', () => {
      const settings = PropertySettings.create({
        checkInTime: '14:00',
        minStayNights: 1,
      })

      expect(settings.checkInTime).toBe('14:00')
      expect(settings.minStayNights).toBe(1)
      expect(settings.checkOutTime).toBeNull()
      expect(settings.timezone).toBeNull()
    })

    it('should throw if minStayNights is less than 1', () => {
      expect(() =>
        PropertySettings.create({ minStayNights: 0 })
      ).toThrow('Minimum stay must be at least 1 night')
    })

    it('should throw if maxStayNights is less than 1', () => {
      expect(() =>
        PropertySettings.create({ maxStayNights: 0 })
      ).toThrow('Maximum stay must be at least 1 night')
    })

    it('should throw if minStayNights exceeds maxStayNights', () => {
      expect(() =>
        PropertySettings.create({ minStayNights: 5, maxStayNights: 3 })
      ).toThrow('Minimum stay cannot exceed maximum stay')
    })

    it('should throw if bookingLeadTimeDays is negative', () => {
      expect(() =>
        PropertySettings.create({ bookingLeadTimeDays: -1 })
      ).toThrow('Booking lead time cannot be negative')
    })
  })

  describe('default', () => {
    it('should create default settings', () => {
      const settings = PropertySettings.default()

      expect(settings.checkInTime).toBe('14:00')
      expect(settings.checkOutTime).toBe('11:00')
      expect(settings.timezone).toBe('America/Los_Angeles')
      expect(settings.cancellationPolicy).toBe('flexible')
      expect(settings.minStayNights).toBe(1)
      expect(settings.maxStayNights).toBe(30)
      expect(settings.bookingLeadTimeDays).toBe(365)
    })
  })

  describe('fromJson', () => {
    it('should create settings from JSON object', () => {
      const json = {
        checkInTime: '15:00',
        checkOutTime: '10:00',
        timezone: 'America/New_York',
        minStayNights: 2,
      }

      const settings = PropertySettings.fromJson(json)

      expect(settings.checkInTime).toBe('15:00')
      expect(settings.checkOutTime).toBe('10:00')
      expect(settings.timezone).toBe('America/New_York')
      expect(settings.minStayNights).toBe(2)
    })

    it('should handle snake_case keys from database', () => {
      const json = {
        check_in_time: '15:00',
        check_out_time: '10:00',
        min_stay_nights: 2,
        max_stay_nights: 7,
        booking_lead_time_days: 90,
      }

      const settings = PropertySettings.fromJson(json)

      expect(settings.checkInTime).toBe('15:00')
      expect(settings.checkOutTime).toBe('10:00')
      expect(settings.minStayNights).toBe(2)
      expect(settings.maxStayNights).toBe(7)
      expect(settings.bookingLeadTimeDays).toBe(90)
    })

    it('should return default settings when JSON is null', () => {
      const settings = PropertySettings.fromJson(null)

      expect(settings.checkInTime).toBe('14:00')
      expect(settings.checkOutTime).toBe('11:00')
    })
  })

  describe('withCheckTimes', () => {
    it('should return new settings with updated check times', () => {
      const original = PropertySettings.create({ minStayNights: 2 })
      const updated = original.withCheckTimes('16:00', '09:00')

      expect(updated.checkInTime).toBe('16:00')
      expect(updated.checkOutTime).toBe('09:00')
      expect(updated.minStayNights).toBe(2) // Preserved

      // Original unchanged (immutable)
      expect(original.checkInTime).toBeNull()
    })
  })

  describe('withStayLimits', () => {
    it('should return new settings with updated stay limits', () => {
      const original = PropertySettings.create({ checkInTime: '14:00' })
      const updated = original.withStayLimits(3, 10)

      expect(updated.minStayNights).toBe(3)
      expect(updated.maxStayNights).toBe(10)
      expect(updated.checkInTime).toBe('14:00') // Preserved
    })
  })

  describe('toJson', () => {
    it('should convert settings to JSON object', () => {
      const settings = PropertySettings.create({
        checkInTime: '15:00',
        checkOutTime: '10:00',
        minStayNights: 2,
        customRules: 'Test rules',
      })

      const json = settings.toJson()

      expect(json).toEqual({
        checkInTime: '15:00',
        checkOutTime: '10:00',
        timezone: null,
        cancellationPolicy: null,
        minStayNights: 2,
        maxStayNights: null,
        bookingLeadTimeDays: null,
        customRules: 'Test rules',
        openPeriodFrom: null,
        openPeriodUntil: null,
        housekeepingRequireApproval: null,
      })
    })
  })

  describe('mergePartial', () => {
    it('should preserve existing fields when patch omits them', () => {
      const current = PropertySettings.create({
        checkInTime: '15:00',
        openPeriodFrom: '2025-05-01',
        openPeriodUntil: '2025-10-01',
      })
      const merged = PropertySettings.mergePartial(current, {
        checkOutTime: '11:00',
      })
      expect(merged.checkInTime).toBe('15:00')
      expect(merged.checkOutTime).toBe('11:00')
      expect(merged.openPeriodFrom).toBe('2025-05-01')
      expect(merged.openPeriodUntil).toBe('2025-10-01')
    })

    it('should replace open period when provided', () => {
      const current = PropertySettings.create({
        openPeriodFrom: '2025-05-01',
        openPeriodUntil: '2025-10-01',
      })
      const merged = PropertySettings.mergePartial(current, {
        openPeriodUntil: '2025-11-15',
      })
      expect(merged.openPeriodFrom).toBe('2025-05-01')
      expect(merged.openPeriodUntil).toBe('2025-11-15')
    })
  })
})

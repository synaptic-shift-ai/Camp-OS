/**
 * PricingCalculator Tests
 *
 * Tests for the pricing domain service.
 */

import { describe, test, expect, beforeEach } from 'vitest'
import { PricingCalculator } from '../PricingCalculator'
import type { SitePricingConfig } from '../IPricingCalculator'
import { DateRange } from '../../value-objects/DateRange'
import { OccupancyInfo } from '../../value-objects/OccupancyInfo'

// Helper to create dates on specific days of week
// 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
const getNextDayOfWeek = (dayOfWeek: number, weeksFromNow: number = 1): Date => {
  const date = new Date()
  const currentDay = date.getDay()
  const daysUntilTarget = (dayOfWeek - currentDay + 7) % 7 || 7 // At least 7 days out
  date.setDate(date.getDate() + daysUntilTarget + weeksFromNow * 7)
  date.setHours(14, 0, 0, 0)
  return date
}

// Helper to create future date
const daysFromNow = (days: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  date.setHours(14, 0, 0, 0)
  return date
}

describe('PricingCalculator', () => {
  let calculator: PricingCalculator

  beforeEach(() => {
    calculator = new PricingCalculator()
  })

  describe('calculatePriceFromConfig', () => {
    test('should calculate base price for weekday nights', () => {
      // Monday to Wednesday = 2 weekday nights
      const monday = getNextDayOfWeek(1) // Monday
      const wednesday = new Date(monday)
      wednesday.setDate(monday.getDate() + 2)

      const config: SitePricingConfig = {
        basePricePerNight: 5000, // $50
      }

      const dateRange = DateRange.create(monday, wednesday)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1)

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      expect(result.subtotal).toBe(10000) // 2 nights × $50 = $100
      expect(result.total).toBe(10000)
      expect(result.lineItems).toHaveLength(1)
      expect(result.lineItems[0]!.description).toBe('Weekday nights')
      expect(result.lineItems[0]!.quantity).toBe(2)
    })

    test('should apply weekend pricing for Friday and Saturday nights', () => {
      // Friday to Sunday = 2 weekend nights
      const friday = getNextDayOfWeek(5) // Friday
      const sunday = new Date(friday)
      sunday.setDate(friday.getDate() + 2)

      const config: SitePricingConfig = {
        basePricePerNight: 5000, // $50 weekday
        weekendPricePerNight: 7500, // $75 weekend
      }

      const dateRange = DateRange.create(friday, sunday)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1)

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      expect(result.subtotal).toBe(15000) // 2 nights × $75 = $150
      expect(result.lineItems.find(l => l.description.includes('Weekend'))).toBeDefined()
    })

    test('should use base price for weekends when no weekend rate set', () => {
      const friday = getNextDayOfWeek(5)
      const sunday = new Date(friday)
      sunday.setDate(friday.getDate() + 2)

      const config: SitePricingConfig = {
        basePricePerNight: 5000, // $50 for all nights
        // No weekendPricePerNight
      }

      const dateRange = DateRange.create(friday, sunday)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1)

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      expect(result.subtotal).toBe(10000) // 2 nights × $50 = $100
    })

    test('should add pet fee when pets are included', () => {
      const checkIn = daysFromNow(14)
      const checkOut = daysFromNow(16)

      const config: SitePricingConfig = {
        basePricePerNight: 5000,
        petFee: 2500, // $25 pet fee
      }

      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2, 0, 1, 1) // 1 pet

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      const petLineItem = result.lineItems.find(l => l.description === 'Pet fee')
      expect(petLineItem).toBeDefined()
      expect(petLineItem!.amount).toBe(2500)
    })

    test('should use default pet fee when not configured', () => {
      const checkIn = daysFromNow(14)
      const checkOut = daysFromNow(16)

      const config: SitePricingConfig = {
        basePricePerNight: 5000,
        // No petFee configured - should use default $20
      }

      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2, 0, 2, 1) // 2 pets

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      const petLineItem = result.lineItems.find(l => l.description === 'Pet fee')
      expect(petLineItem).toBeDefined()
      expect(petLineItem!.amount).toBe(2000) // Default $20
    })

    test('should not add pet fee when no pets', () => {
      const checkIn = daysFromNow(14)
      const checkOut = daysFromNow(16)

      const config: SitePricingConfig = {
        basePricePerNight: 5000,
        petFee: 2500,
      }

      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1) // No pets

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      const petLineItem = result.lineItems.find(l => l.description === 'Pet fee')
      expect(petLineItem).toBeUndefined()
    })

    test('should add extra person fee when exceeding max guests', () => {
      const checkIn = daysFromNow(14)
      const checkOut = daysFromNow(16)

      const config: SitePricingConfig = {
        basePricePerNight: 5000,
        maxGuestsIncluded: 2,
        extraPersonFee: 1000, // $10 per extra person per night
      }

      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(3, 1, 0, 1) // 4 people, 2 extra

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      const extraPersonItem = result.lineItems.find(l => l.description.includes('Extra guest'))
      expect(extraPersonItem).toBeDefined()
      // 2 extra guests × $10 × 2 nights = $40
      expect(extraPersonItem!.amount).toBe(4000)
    })

    test('should add cleaning fee when configured', () => {
      const checkIn = daysFromNow(14)
      const checkOut = daysFromNow(16)

      const config: SitePricingConfig = {
        basePricePerNight: 5000,
        cleaningFee: 3500, // $35 cleaning fee
      }

      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1)

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      const cleaningItem = result.lineItems.find(l => l.description === 'Cleaning fee')
      expect(cleaningItem).toBeDefined()
      expect(cleaningItem!.amount).toBe(3500)
    })

    test('should calculate tax when enabled', () => {
      const checkIn = daysFromNow(14)
      const checkOut = daysFromNow(16)

      const config: SitePricingConfig = {
        basePricePerNight: 10000, // $100 per night
      }

      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1)

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy, {
        includeTax: true,
        taxRate: 0.08, // 8% tax
      })

      expect(result.subtotal).toBe(20000) // 2 nights × $100
      expect(result.taxAmount).toBe(1600) // 8% of $200
      expect(result.total).toBe(21600)
    })

    test('should not include tax by default', () => {
      const checkIn = daysFromNow(14)
      const checkOut = daysFromNow(16)

      const config: SitePricingConfig = {
        basePricePerNight: 10000,
      }

      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1)

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      expect(result.taxAmount).toBe(0)
      expect(result.subtotal).toBe(result.total)
    })

    test('should return USD currency', () => {
      const checkIn = daysFromNow(14)
      const checkOut = daysFromNow(16)

      const config: SitePricingConfig = {
        basePricePerNight: 5000,
      }

      const dateRange = DateRange.create(checkIn, checkOut)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1)

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      expect(result.currency).toBe('USD')
    })
  })

  describe('mixed weekday and weekend stays', () => {
    test('should correctly split weekday and weekend nights', () => {
      // Thursday to Monday = 2 weekday nights (Thu, Sun) + 2 weekend nights (Fri, Sat)
      const thursday = getNextDayOfWeek(4) // Thursday
      const monday = new Date(thursday)
      monday.setDate(thursday.getDate() + 4)

      const config: SitePricingConfig = {
        basePricePerNight: 5000, // $50
        weekendPricePerNight: 8000, // $80
      }

      const dateRange = DateRange.create(thursday, monday)
      const occupancy = OccupancyInfo.create(2, 0, 0, 1)

      const result = calculator.calculatePriceFromConfig(config, dateRange, occupancy)

      const weekdayItem = result.lineItems.find(l => l.description === 'Weekday nights')
      const weekendItem = result.lineItems.find(l => l.description.includes('Weekend'))

      expect(weekdayItem).toBeDefined()
      expect(weekdayItem!.quantity).toBe(2)
      expect(weekdayItem!.amount).toBe(10000) // 2 × $50

      expect(weekendItem).toBeDefined()
      expect(weekendItem!.quantity).toBe(2)
      expect(weekendItem!.amount).toBe(16000) // 2 × $80

      expect(result.subtotal).toBe(26000) // $260 total
    })
  })
})

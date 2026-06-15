import { describe, expect, test } from 'vitest'
import { extractPropertyIdFromSlug, generateBookingSlug, isValidBookingSlug } from './slug-utils'

const propertyId = 'e39aaf78-e84e-4d18-9b00-140451511d1c'

describe('generateBookingSlug', () => {
  test('should produce hyphenated slug from multi-word property name', () => {
    expect(generateBookingSlug('Pine Valley Campground', propertyId)).toBe(
      'pine-valley-campground-e39aaf78'
    )
  })

  test('should strip apostrophes without leaving orphan letters', () => {
    expect(generateBookingSlug("Nature Trip's", propertyId)).toBe('nature-trips-e39aaf78')
  })

  test('should handle names with curly apostrophes after normalization', () => {
    expect(generateBookingSlug("O'Brien's Camp", propertyId)).toBe('obriens-camp-e39aaf78')
  })
})

describe('extractPropertyIdFromSlug', () => {
  test('should extract short uuid prefix from slug', () => {
    expect(extractPropertyIdFromSlug('nature-trips-e39aaf78')).toBe('e39aaf78')
  })
})

describe('isValidBookingSlug', () => {
  test('should return true for valid slug', () => {
    expect(isValidBookingSlug('nature-trips-e39aaf78')).toBe(true)
  })

  test('should return false for invalid slug', () => {
    expect(isValidBookingSlug('invalid-slug')).toBe(false)
  })
})

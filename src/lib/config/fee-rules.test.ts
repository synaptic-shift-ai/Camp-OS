/**
 * Tests for fee application rules.
 *
 * S-0.2: fee eligibility was an inline switch duplicated between the server
 * engine (pricing-enhanced.ts) and the staff pricing summary component, and the
 * two had drifted. Extracting it makes it testable and lets both paths share
 * one rule set, and adds the site-type scoping that previously did not exist —
 * the reason a cabin cleaning fee had to be a hardcoded `site_type === 'cabin'`
 * branch in the booking route.
 */

import { describe, test, expect } from 'vitest'
import { feeAppliesToSiteType, feeTriggerMatches, shouldApplyFee } from './fee-rules'
import type { UserDefinedFee } from './types'
import type { FeeApplicationContext } from './fee-rules'

const CABIN = 'cabin'
const RV = 'rv'
const CLEANING_FEE_CENTS = 5000

const baseFee: UserDefinedFee = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Cleaning Fee',
  fee_type: 'flat_amount',
  value_cents: CLEANING_FEE_CENTS,
  is_taxable: true,
  trigger_type: 'always',
  display_order: 0,
  enabled: true,
  created_at: '2026-01-01T00:00:00Z',
}

const MIN_NIGHTS_THRESHOLD = 7
const MIN_GUESTS_THRESHOLD = 4

const baseContext: FeeApplicationContext = {
  totalNights: 3,
  totalGuests: 2,
  numPets: 0,
  checkInDate: '2026-06-15',
  siteType: RV,
  selectedFeeIds: [],
}

describe('feeAppliesToSiteType', () => {
  test('applies to every site type when the scope is absent', () => {
    expect(feeAppliesToSiteType(baseFee, CABIN)).toBe(true)
  })

  test('applies to every site type when the scope is an empty array', () => {
    expect(feeAppliesToSiteType({ ...baseFee, applies_to_site_types: [] }, CABIN)).toBe(true)
  })

  test('applies to a site type named in the scope', () => {
    expect(feeAppliesToSiteType({ ...baseFee, applies_to_site_types: [CABIN] }, CABIN)).toBe(true)
  })

  test('does not apply to a site type outside the scope', () => {
    expect(feeAppliesToSiteType({ ...baseFee, applies_to_site_types: [CABIN] }, RV)).toBe(false)
  })

  test('matches regardless of casing, since stored config may hold capitalised types', () => {
    expect(feeAppliesToSiteType({ ...baseFee, applies_to_site_types: ['Cabin'] }, CABIN)).toBe(true)
  })

  test('does not apply a scoped fee when the site type is unknown, rather than charging on a guess', () => {
    expect(feeAppliesToSiteType({ ...baseFee, applies_to_site_types: [CABIN] }, null)).toBe(false)
  })

  test('applies an unscoped fee even when the site type is unknown', () => {
    expect(feeAppliesToSiteType(baseFee, null)).toBe(true)
  })
})

describe('feeTriggerMatches', () => {
  test('always: applies unconditionally', () => {
    expect(feeTriggerMatches({ ...baseFee, trigger_type: 'always' }, baseContext)).toBe(true)
  })

  test('manual: does not apply when the fee was not selected', () => {
    expect(feeTriggerMatches({ ...baseFee, trigger_type: 'manual' }, baseContext)).toBe(false)
  })

  test('manual: applies when staff selected the fee', () => {
    expect(
      feeTriggerMatches({ ...baseFee, trigger_type: 'manual' }, {
        ...baseContext,
        selectedFeeIds: [baseFee.id],
      }),
    ).toBe(true)
  })

  test('min_nights: applies at exactly the threshold', () => {
    expect(
      feeTriggerMatches(
        { ...baseFee, trigger_type: 'min_nights', trigger_conditions: { min_nights: MIN_NIGHTS_THRESHOLD } },
        { ...baseContext, totalNights: MIN_NIGHTS_THRESHOLD },
      ),
    ).toBe(true)
  })

  test('min_nights: does not apply one night below the threshold', () => {
    expect(
      feeTriggerMatches(
        { ...baseFee, trigger_type: 'min_nights', trigger_conditions: { min_nights: MIN_NIGHTS_THRESHOLD } },
        { ...baseContext, totalNights: MIN_NIGHTS_THRESHOLD - 1 },
      ),
    ).toBe(false)
  })

  test('min_guests: applies at exactly the threshold', () => {
    expect(
      feeTriggerMatches(
        { ...baseFee, trigger_type: 'min_guests', trigger_conditions: { min_guests: MIN_GUESTS_THRESHOLD } },
        { ...baseContext, totalGuests: MIN_GUESTS_THRESHOLD },
      ),
    ).toBe(true)
  })

  test('has_pets: applies when the reservation includes a pet', () => {
    expect(
      feeTriggerMatches({ ...baseFee, trigger_type: 'has_pets' }, { ...baseContext, numPets: 1 }),
    ).toBe(true)
  })

  test('has_pets: does not apply with no pets', () => {
    expect(
      feeTriggerMatches({ ...baseFee, trigger_type: 'has_pets' }, { ...baseContext, numPets: 0 }),
    ).toBe(false)
  })

  test('date_range: applies when check-in falls inside the window', () => {
    expect(
      feeTriggerMatches(
        {
          ...baseFee,
          trigger_type: 'date_range',
          trigger_conditions: { start_date: '2026-06-01', end_date: '2026-06-30' },
        },
        { ...baseContext, checkInDate: '2026-06-15' },
      ),
    ).toBe(true)
  })

  test('date_range: does not apply when check-in falls outside the window', () => {
    expect(
      feeTriggerMatches(
        {
          ...baseFee,
          trigger_type: 'date_range',
          trigger_conditions: { start_date: '2026-06-01', end_date: '2026-06-30' },
        },
        { ...baseContext, checkInDate: '2026-07-01' },
      ),
    ).toBe(false)
  })

  test('date_range: applies when no window is configured, the window being unbounded', () => {
    expect(feeTriggerMatches({ ...baseFee, trigger_type: 'date_range' }, baseContext)).toBe(true)
  })

  test('date_range: does not apply when a window is configured but no check-in date is known', () => {
    expect(
      feeTriggerMatches(
        { ...baseFee, trigger_type: 'date_range', trigger_conditions: { start_date: '2026-06-01' } },
        { ...baseContext, checkInDate: null },
      ),
    ).toBe(false)
  })

  test('does not apply a fee whose trigger type is unrecognised, rather than charging by default', () => {
    const fee = { ...baseFee, trigger_type: 'not_a_trigger' as UserDefinedFee['trigger_type'] }
    expect(feeTriggerMatches(fee, baseContext)).toBe(false)
  })
})

describe('shouldApplyFee', () => {
  test('does not apply a disabled fee even when its trigger and scope both match', () => {
    expect(shouldApplyFee({ ...baseFee, enabled: false }, baseContext)).toBe(false)
  })

  test('applies when the fee is enabled and both trigger and scope match', () => {
    expect(
      shouldApplyFee({ ...baseFee, applies_to_site_types: [RV] }, baseContext),
    ).toBe(true)
  })

  test('does not apply when the trigger matches but the site type is out of scope', () => {
    expect(
      shouldApplyFee({ ...baseFee, applies_to_site_types: [CABIN] }, baseContext),
    ).toBe(false)
  })

  test('does not apply when the site type matches but the trigger does not', () => {
    expect(
      shouldApplyFee(
        {
          ...baseFee,
          trigger_type: 'min_nights',
          trigger_conditions: { min_nights: MIN_NIGHTS_THRESHOLD },
          applies_to_site_types: [RV],
        },
        { ...baseContext, totalNights: MIN_NIGHTS_THRESHOLD - 1 },
      ),
    ).toBe(false)
  })
})

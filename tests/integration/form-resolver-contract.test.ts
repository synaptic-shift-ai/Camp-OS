/**
 * Resolver contract across the real settings form schemas.
 *
 * Companion to add-holiday-dialog.test.tsx. That test mounts one form; this one
 * drives zodResolver over the shared schemas the other settings forms use, so
 * the resolver wiring is covered more broadly without mounting every screen.
 *
 * Added for the zod 4 / @hookform/resolvers 7 upgrade. Each affected form keeps
 * its output generic and asserts the resolver's type, which is only sound if the
 * resolver still (a) maps issues to field paths react-hook-form can display and
 * (b) returns coerced output values. Both are asserted here.
 */
import { describe, it, expect } from 'vitest'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Resolver } from 'react-hook-form'
import {
  bookingRulesSettingsFormSchema,
  depositConfigFormSchema,
  pricingConfigFormSchema,
  rateDiscountsConfigSchema,
} from '@/lib/config/schemas'

type ResolverOutcome = { values: Record<string, unknown>; errors: Record<string, { message?: string }> }

/** Run a resolver the way react-hook-form's handleSubmit does. */
async function resolve(schema: unknown, values: unknown): Promise<ResolverOutcome> {
  const resolver = zodResolver(schema as never) as unknown as Resolver<Record<string, unknown>>
  const out = await resolver(values as Record<string, unknown>, undefined, {
    fields: {},
    shouldUseNativeValidation: false,
  })
  return out as unknown as ResolverOutcome
}

const errorPaths = (o: ResolverOutcome) => Object.keys(o.errors ?? {})

describe('zodResolver contract for the settings form schemas', () => {
  describe('bookingRulesSettingsFormSchema', () => {
    it('reports the cross-field stay rule against the max_stay_nights field', async () => {
      const out = await resolve(bookingRulesSettingsFormSchema, {
        min_stay_nights: 5,
        max_stay_nights: 2,
      })

      expect(errorPaths(out)).toContain('max_stay_nights')
      expect(out.errors.max_stay_nights?.message).toMatch(/maximum stay/i)
    })

    it('applies schema defaults to the submitted values when the rule holds', async () => {
      const out = await resolve(bookingRulesSettingsFormSchema, {
        min_stay_nights: 2,
        max_stay_nights: 7,
      })

      expect(errorPaths(out)).toEqual([])
      // .default() must still populate omitted fields through the resolver.
      expect(out.values.min_stay_nights).toBe(2)
      expect(typeof out.values.booking_window_days).toBe('number')
      expect(typeof out.values.checkout_hold_minutes).toBe('number')
    })
  })

  describe('depositConfigFormSchema', () => {
    it('surfaces a field-level message when the deposit requirement is missing', async () => {
      const out = await resolve(depositConfigFormSchema, {})

      expect(errorPaths(out)).toContain('require_deposit')
      expect(out.errors.require_deposit?.message).toMatch(/deposit requirement/i)
    })

    it('accepts a complete deposit config and returns coerced values', async () => {
      const out = await resolve(depositConfigFormSchema, {
        require_deposit: true,
        deposit_percentage: 25,
      })

      expect(errorPaths(out)).toEqual([])
      expect(out.values.require_deposit).toBe(true)
      // deposit_type carries .default('percentage')
      expect(out.values.deposit_type).toBe('percentage')
    })
  })

  describe('pricingConfigFormSchema', () => {
    it('returns an object of values with no errors for an empty config', async () => {
      const out = await resolve(pricingConfigFormSchema, {})

      // Every field is defaulted or optional, so this is the "untouched form" case.
      expect(errorPaths(out)).toEqual([])
      expect(typeof out.values).toBe('object')
    })
  })

  describe('rateDiscountsConfigSchema', () => {
    it('returns values with no errors for an empty config', async () => {
      const out = await resolve(rateDiscountsConfigSchema, {})

      expect(errorPaths(out)).toEqual([])
      expect(typeof out.values).toBe('object')
    })
  })

  it('never returns both values and errors for the same submission', async () => {
    // react-hook-form branches on errors being empty; a resolver returning both
    // would make handleSubmit behave unpredictably.
    const invalid = await resolve(bookingRulesSettingsFormSchema, {
      min_stay_nights: 5,
      max_stay_nights: 1,
    })
    expect(errorPaths(invalid).length).toBeGreaterThan(0)
    expect(Object.keys(invalid.values ?? {})).toEqual([])

    const valid = await resolve(bookingRulesSettingsFormSchema, {
      min_stay_nights: 1,
      max_stay_nights: 3,
    })
    expect(errorPaths(valid)).toEqual([])
    expect(Object.keys(valid.values ?? {}).length).toBeGreaterThan(0)
  })
})

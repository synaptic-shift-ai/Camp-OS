/**
 * Tests for shared constants.
 *
 * The site type list and its labels were previously duplicated across 17
 * definitions (10 ordered lists, 7 label maps), so adding a site type meant
 * editing 17 places and the setup wizard's copy had drifted to capitalised
 * values. These tests guard the consolidated source against re-drifting.
 */

import { describe, test, expect } from 'vitest'
import { SITE_TYPES, SITE_TYPE_LABELS, SITE_TYPE_OPTIONS, siteTypeLabel } from './constants'
import { SiteTypeSchema } from '@/types/api/v1/schemas/sites'
import { SiteType as SiteTypeEnum } from '@/modules/SiteManagement/domain/SiteType'

const LABEL_FORMS = ['short', 'singular', 'plural'] as const

describe('SITE_TYPES', () => {
  test('contains exactly the values the API schema validates', () => {
    expect([...SITE_TYPES].sort()).toEqual([...SiteTypeSchema.options].sort())
  })

  test('contains exactly the values the SiteManagement domain enum defines', () => {
    expect([...SITE_TYPES].sort()).toEqual(Object.values(SiteTypeEnum).sort())
  })

  test('holds no duplicates', () => {
    expect(new Set(SITE_TYPES).size).toBe(SITE_TYPES.length)
  })

  test('is entirely lowercase, since every reader compares case-insensitively against stored config', () => {
    expect(SITE_TYPES.filter((t) => t !== t.toLowerCase())).toEqual([])
  })
})

describe('SITE_TYPE_LABELS', () => {
  test('provides every label form for every site type', () => {
    const missing = SITE_TYPES.flatMap((type) =>
      LABEL_FORMS.filter((form) => !SITE_TYPE_LABELS[type]?.[form]).map((form) => `${type}.${form}`),
    )
    expect(missing).toEqual([])
  })

  test('defines labels for no type outside SITE_TYPES', () => {
    expect(Object.keys(SITE_TYPE_LABELS).sort()).toEqual([...SITE_TYPES].sort())
  })
})

describe('siteTypeLabel', () => {
  test('defaults to the short form', () => {
    expect(siteTypeLabel('rv')).toBe(SITE_TYPE_LABELS.rv.short)
  })

  test.each(LABEL_FORMS)('returns the %s form when asked for it', (form) => {
    expect(siteTypeLabel('tent', form)).toBe(SITE_TYPE_LABELS.tent[form])
  })

  test('matches on a stored value of any casing, since the wizard historically wrote capitalised types', () => {
    expect(siteTypeLabel('RV', 'plural')).toBe(SITE_TYPE_LABELS.rv.plural)
  })

  test('falls back to the raw value for an unrecognised type, preserving prior display behaviour', () => {
    const unknownType = 'pavilion'
    expect(siteTypeLabel(unknownType, 'plural')).toBe(unknownType)
  })
})

describe('SITE_TYPE_OPTIONS', () => {
  test('offers one short-labelled option per site type, in SITE_TYPES order', () => {
    expect(SITE_TYPE_OPTIONS).toEqual(
      SITE_TYPES.map((value) => ({ value, label: SITE_TYPE_LABELS[value].short })),
    )
  })
})


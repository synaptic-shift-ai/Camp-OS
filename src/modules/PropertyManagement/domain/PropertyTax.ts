/**
 * PropertyTax Aggregate Root
 *
 * One tax a property levies, to one authority. Replaces the single
 * `pricing_config.tax_rate` / `tax_name` pair, which could not express a
 * duration gate (Ohio exempts stays of 30 nights or more), a second authority
 * remitted separately, or a rate that changes mid-season.
 *
 * The rules that *select and charge* taxes live in `lib/config/tax-rules.ts`,
 * alongside the other pure configuration rule modules; this aggregate owns the
 * shape of a stored tax and hands those rules a `TaxDefinition`.
 *
 * The database carries the same invariants as check constraints. They are
 * repeated here so a bad configuration fails as a 400 naming the problem rather
 * than a 500 out of Postgres, and so a row edited around those constraints can
 * never reach the quote path as a tax with no computable rate.
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import type { TaxBasis, TaxDefinition, TaxRateType } from '@/lib/config/tax-rules'

const BASIS_POINTS_MAX = 10_000

const RATE_TYPES: readonly TaxRateType[] = ['percentage', 'per_night', 'flat']
const BASES: readonly TaxBasis[] = ['pre_tax', 'compounds_on_tax']

/** The `property_taxes` row, as the database stores it. */
export type PropertyTaxRow = {
  id: string
  property_id: string
  name: string
  authority: string | null
  rate_type: string
  rate_bp: number | null
  amount_cents: number | null
  min_nights: number | null
  max_nights: number | null
  basis: string
  priority: number
  discounts_reduce_taxable_amount: boolean
  exemptible: boolean
  effective_from: string | null
  effective_to: string | null
  enabled: boolean
  created_at: string
  updated_at: string
}

/** Everything a stored tax carries, minus its identity and timestamps. */
type PropertyTaxFields = {
  name: string
  authority: string | null
  rateType: TaxRateType
  rateBp: number | null
  amountCents: number | null
  minNights: number | null
  maxNights: number | null
  basis: TaxBasis
  priority: number
  discountsReduceTaxableAmount: boolean
  exemptible: boolean
  effectiveFrom: string | null
  effectiveTo: string | null
  enabled: boolean

  /**
   * `tax_categories.code` values this tax reaches. Codes rather than ids,
   * because the rules select on codes; the repository maps them to the
   * `tax_applicability` rows.
   */
  appliesToCategories: readonly string[]
}

export type CreatePropertyTaxProps = PropertyTaxFields & {
  id: string
  propertyId: string
}

/**
 * A change to an existing tax. Omitted fields keep their current value, and so
 * does a field passed as `undefined` — a partial request body types every key
 * that way, and spreading it would otherwise blank the field.
 */
export type UpdatePropertyTaxProps = {
  [K in keyof PropertyTaxFields]?: PropertyTaxFields[K] | undefined
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function assertIsoDate(value: string | null, label: string): void {
  if (value === null) return
  if (!ISO_DATE.test(value)) {
    throw new Error(`${label} must be a calendar date in yyyy-mm-dd form, got "${value}"`)
  }
  // A well-formed string can still name a day that does not exist, and
  // comparisons elsewhere are lexical, so reject it here instead.
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a calendar date in yyyy-mm-dd form, got "${value}"`)
  }
}

function assertWholeNonNegative(value: number | null, label: string, suffix: string): void {
  if (value === null) return
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be ${suffix}, got ${value}`)
  }
}

/** Normalise and check a whole tax, so no path can store an incoherent one. */
function validate(fields: PropertyTaxFields): PropertyTaxFields {
  const name = fields.name.trim()
  if (name.length === 0) throw new Error('Tax name is required')

  const authority = fields.authority?.trim() ?? ''

  if (!RATE_TYPES.includes(fields.rateType)) {
    throw new Error(`Unknown rate type "${fields.rateType}"`)
  }
  if (!BASES.includes(fields.basis)) {
    throw new Error(`Unknown tax basis "${fields.basis}"`)
  }

  if (fields.rateType === 'percentage') {
    if (fields.rateBp === null) {
      throw new Error('A percentage tax requires a rate in basis points')
    }
    if (fields.amountCents !== null) {
      throw new Error('A percentage tax cannot also carry a cent amount')
    }
    if (
      !Number.isInteger(fields.rateBp) ||
      fields.rateBp < 0 ||
      fields.rateBp > BASIS_POINTS_MAX
    ) {
      throw new Error(
        `A rate in basis points must be a whole number between 0 and ${BASIS_POINTS_MAX}, got ${fields.rateBp}`,
      )
    }
  } else {
    if (fields.amountCents === null) {
      throw new Error(`A ${fields.rateType} tax requires a cent amount`)
    }
    if (fields.rateBp !== null) {
      throw new Error(`A ${fields.rateType} tax cannot also carry a basis point rate`)
    }
    assertWholeNonNegative(fields.amountCents, 'A cent amount', 'a whole number of cents, not below zero')
  }

  assertWholeNonNegative(fields.minNights, 'Minimum nights', 'a whole number of nights, not below zero')
  assertWholeNonNegative(fields.maxNights, 'Maximum nights', 'a whole number of nights, not below zero')
  if (fields.minNights !== null && fields.maxNights !== null && fields.maxNights < fields.minNights) {
    throw new Error(
      `Maximum nights cannot be below minimum nights (${fields.maxNights} < ${fields.minNights})`,
    )
  }

  assertIsoDate(fields.effectiveFrom, 'Effective start')
  assertIsoDate(fields.effectiveTo, 'Effective end')
  if (
    fields.effectiveFrom !== null &&
    fields.effectiveTo !== null &&
    fields.effectiveTo < fields.effectiveFrom
  ) {
    throw new Error(
      `Effective end cannot be before the effective start (${fields.effectiveTo} < ${fields.effectiveFrom})`,
    )
  }

  if (!Number.isInteger(fields.priority)) {
    throw new Error(`Priority must be a whole number, got ${fields.priority}`)
  }

  // A tax naming no category never charges anything, which in a money path is a
  // silent failure rather than a draft state worth supporting.
  const categories = [...new Set(fields.appliesToCategories.map((code) => code.trim()))].filter(
    (code) => code.length > 0,
  )
  if (categories.length === 0) {
    throw new Error('A tax must apply to at least one tax category')
  }

  return {
    ...fields,
    name,
    authority: authority.length > 0 ? authority : null,
    appliesToCategories: categories,
  }
}

export class PropertyTax extends AggregateRoot<string> {
  private readonly _propertyId: string
  private _fields: PropertyTaxFields

  private constructor(
    id: string,
    propertyId: string,
    fields: PropertyTaxFields,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super(id, createdAt, updatedAt)
    this._propertyId = propertyId
    this._fields = fields
  }

  /** Property this tax belongs to (tenant isolation). */
  get propertyId(): string {
    return this._propertyId
  }

  get name(): string {
    return this._fields.name
  }

  /** Who the tax is remitted to, or null when the property did not record one. */
  get authority(): string | null {
    return this._fields.authority
  }

  get rateType(): TaxRateType {
    return this._fields.rateType
  }

  /** Basis points for a percentage tax, else null. */
  get rateBp(): number | null {
    return this._fields.rateBp
  }

  /** Cents for a per_night or flat tax, else null. */
  get amountCents(): number | null {
    return this._fields.amountCents
  }

  get minNights(): number | null {
    return this._fields.minNights
  }

  get maxNights(): number | null {
    return this._fields.maxNights
  }

  get basis(): TaxBasis {
    return this._fields.basis
  }

  get priority(): number {
    return this._fields.priority
  }

  get discountsReduceTaxableAmount(): boolean {
    return this._fields.discountsReduceTaxableAmount
  }

  get exemptible(): boolean {
    return this._fields.exemptible
  }

  get effectiveFrom(): string | null {
    return this._fields.effectiveFrom
  }

  get effectiveTo(): string | null {
    return this._fields.effectiveTo
  }

  get enabled(): boolean {
    return this._fields.enabled
  }

  get appliesToCategories(): readonly string[] {
    return this._fields.appliesToCategories
  }

  public static create(props: CreatePropertyTaxProps): PropertyTax {
    const { id, propertyId, ...fields } = props
    const now = new Date()
    return new PropertyTax(id, propertyId, validate(fields), now, now)
  }

  /**
   * Rebuild from a stored row plus the category codes its applicability rows
   * resolve to. Validates, so a row edited around the check constraints cannot
   * reach the quote path.
   */
  public static fromPersistence(
    row: PropertyTaxRow,
    appliesToCategories: readonly string[],
  ): PropertyTax {
    return new PropertyTax(
      row.id,
      row.property_id,
      validate({
        name: row.name,
        authority: row.authority,
        rateType: row.rate_type as TaxRateType,
        rateBp: row.rate_bp,
        amountCents: row.amount_cents,
        minNights: row.min_nights,
        maxNights: row.max_nights,
        basis: row.basis as TaxBasis,
        priority: row.priority,
        discountsReduceTaxableAmount: row.discounts_reduce_taxable_amount,
        exemptible: row.exemptible,
        effectiveFrom: row.effective_from,
        effectiveTo: row.effective_to,
        enabled: row.enabled,
        appliesToCategories,
      }),
      new Date(row.created_at),
      new Date(row.updated_at),
    )
  }

  /**
   * Apply a change.
   *
   * The merged result is validated as a whole and only then committed, so a
   * change can neither leave the tax invalid nor half-applied — switching rate
   * type without also moving the amount across is rejected.
   */
  public update(changes: UpdatePropertyTaxProps): void {
    const provided = Object.fromEntries(
      Object.entries(changes).filter(([, value]) => value !== undefined),
    ) as Partial<PropertyTaxFields>
    const merged = validate({ ...this._fields, ...provided })
    this._fields = merged
    this.touch()
  }

  /** Stop or resume levying without deleting the tax, so history stays intact. */
  public setEnabled(enabled: boolean): void {
    if (this._fields.enabled === enabled) return
    this._fields = { ...this._fields, enabled }
    this.touch()
  }

  /** The shape `selectApplicableTaxes` and `computeTaxLines` consume. */
  public toTaxDefinition(): TaxDefinition {
    return {
      id: this.id,
      name: this._fields.name,
      authority: this._fields.authority,
      rateType: this._fields.rateType,
      rateBp: this._fields.rateBp,
      amountCents: this._fields.amountCents,
      minNights: this._fields.minNights,
      maxNights: this._fields.maxNights,
      basis: this._fields.basis,
      priority: this._fields.priority,
      discountsReduceTaxableAmount: this._fields.discountsReduceTaxableAmount,
      exemptible: this._fields.exemptible,
      effectiveFrom: this._fields.effectiveFrom,
      effectiveTo: this._fields.effectiveTo,
      enabled: this._fields.enabled,
      appliesToCategories: this._fields.appliesToCategories,
    }
  }

  /**
   * The `property_taxes` row. Applicability is not here: it lives in its own
   * table, and the repository writes it alongside.
   */
  public toPersistence(): PropertyTaxRow {
    return {
      id: this.id,
      property_id: this._propertyId,
      name: this._fields.name,
      authority: this._fields.authority,
      rate_type: this._fields.rateType,
      rate_bp: this._fields.rateBp,
      amount_cents: this._fields.amountCents,
      min_nights: this._fields.minNights,
      max_nights: this._fields.maxNights,
      basis: this._fields.basis,
      priority: this._fields.priority,
      discounts_reduce_taxable_amount: this._fields.discountsReduceTaxableAmount,
      exemptible: this._fields.exemptible,
      effective_from: this._fields.effectiveFrom,
      effective_to: this._fields.effectiveTo,
      enabled: this._fields.enabled,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

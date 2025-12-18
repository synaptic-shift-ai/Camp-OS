/**
 * Hookups Value Object
 *
 * Encapsulates utility hookups available at a site (water, electric, sewer, etc.)
 */

export type HookupType =
  | 'water'
  | 'electric_20amp'
  | 'electric_30amp'
  | 'electric_50amp'
  | 'sewer'
  | 'cable'
  | 'wifi'
  | 'phone'
  | 'natural_gas'
  | 'propane'

export const HOOKUP_LABELS: Record<HookupType, string> = {
  water: 'Water',
  electric_20amp: '20 Amp Electric',
  electric_30amp: '30 Amp Electric',
  electric_50amp: '50 Amp Electric',
  sewer: 'Sewer',
  cable: 'Cable TV',
  wifi: 'WiFi',
  phone: 'Phone',
  natural_gas: 'Natural Gas',
  propane: 'Propane',
}

export class Hookups {
  private constructor(private readonly hookups: HookupType[]) {
    Object.freeze(this.hookups)
  }

  static create(hookups: HookupType[]): Hookups {
    // Validate hookup types
    const validHookups = Object.keys(HOOKUP_LABELS) as HookupType[]
    const invalidHookups = hookups.filter((h) => !validHookups.includes(h))
    if (invalidHookups.length > 0) {
      throw new Error(`Invalid hookup types: ${invalidHookups.join(', ')}`)
    }

    // Remove duplicates
    const uniqueHookups = [...new Set(hookups)]

    return new Hookups(uniqueHookups)
  }

  static none(): Hookups {
    return new Hookups([])
  }

  static fullHookups(): Hookups {
    return Hookups.create(['water', 'electric_50amp', 'sewer'])
  }

  static fromPersistence(hookupsJson: unknown): Hookups {
    if (!hookupsJson) {
      return Hookups.none()
    }

    const hookups = Array.isArray(hookupsJson)
      ? (hookupsJson as HookupType[])
      : []

    // Filter to only valid hookup types (backward compatibility)
    const validHookups = Object.keys(HOOKUP_LABELS) as HookupType[]
    const filtered = hookups.filter((h) => validHookups.includes(h))

    return new Hookups(filtered)
  }

  get all(): readonly HookupType[] {
    return this.hookups
  }

  get count(): number {
    return this.hookups.length
  }

  has(hookup: HookupType): boolean {
    return this.hookups.includes(hookup)
  }

  hasWater(): boolean {
    return this.has('water')
  }

  hasElectric(): boolean {
    return (
      this.has('electric_20amp') ||
      this.has('electric_30amp') ||
      this.has('electric_50amp')
    )
  }

  getElectricAmperage(): 20 | 30 | 50 | null {
    if (this.has('electric_50amp')) return 50
    if (this.has('electric_30amp')) return 30
    if (this.has('electric_20amp')) return 20
    return null
  }

  hasSewer(): boolean {
    return this.has('sewer')
  }

  isFullHookup(): boolean {
    return this.hasWater() && this.hasElectric() && this.hasSewer()
  }

  get labels(): string[] {
    return this.hookups.map((h) => HOOKUP_LABELS[h])
  }

  equals(other: Hookups): boolean {
    if (this.hookups.length !== other.hookups.length) {
      return false
    }
    const sortedA = [...this.hookups].sort()
    const sortedB = [...other.hookups].sort()
    return sortedA.every((h, i) => h === sortedB[i])
  }

  toPersistence(): HookupType[] | null {
    return this.hookups.length > 0 ? [...this.hookups] : null
  }
}

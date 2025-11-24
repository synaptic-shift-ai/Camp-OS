/**
 * GuestCount Value Object
 *
 * Represents the guest capacity for a reservation.
 * Enforces business rules around guest limits and counts.
 *
 * Business Rules:
 * - At least one adult must be present
 * - All counts must be non-negative
 * - Total guest count = adults + children
 * - Maximum guests enforced by site (validated at Reservation level)
 * - Pets and vehicles are optional add-ons
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface GuestCountProps {
  adults: number
  children: number
  pets: number
  vehicles: number
}

export class GuestCount extends ValueObject<GuestCountProps> {
  // Business rule constants
  private static readonly MIN_ADULTS = 1
  private static readonly MAX_ADULTS = 50 // Safety limit
  private static readonly MAX_CHILDREN = 50 // Safety limit
  private static readonly MAX_PETS = 10 // Safety limit
  private static readonly MAX_VEHICLES = 10 // Safety limit

  private constructor(props: GuestCountProps) {
    super(props)
  }

  /**
   * Factory method to create GuestCount
   *
   * @param adults - Number of adults (required, minimum 1)
   * @param children - Number of children (optional, default 0)
   * @param pets - Number of pets (optional, default 0)
   * @param vehicles - Number of vehicles (optional, default 0)
   * @returns GuestCount instance
   * @throws Error if validation fails
   */
  public static create(
    adults: number,
    children = 0,
    pets = 0,
    vehicles = 0
  ): GuestCount {
    GuestCount.validateCounts(adults, children, pets, vehicles)

    return new GuestCount({
      adults,
      children,
      pets,
      vehicles,
    })
  }

  /**
   * Validate all counts according to business rules
   */
  private static validateCounts(
    adults: number,
    children: number,
    pets: number,
    vehicles: number
  ): void {
    // All counts must be non-negative integers
    if (!Number.isInteger(adults) || adults < 0) {
      throw new Error('Adults must be a non-negative integer')
    }
    if (!Number.isInteger(children) || children < 0) {
      throw new Error('Children must be a non-negative integer')
    }
    if (!Number.isInteger(pets) || pets < 0) {
      throw new Error('Pets must be a non-negative integer')
    }
    if (!Number.isInteger(vehicles) || vehicles < 0) {
      throw new Error('Vehicles must be a non-negative integer')
    }

    // At least one adult required
    if (adults < GuestCount.MIN_ADULTS) {
      throw new Error(`At least ${GuestCount.MIN_ADULTS} adult is required`)
    }

    // Safety limits
    if (adults > GuestCount.MAX_ADULTS) {
      throw new Error(`Maximum ${GuestCount.MAX_ADULTS} adults allowed`)
    }
    if (children > GuestCount.MAX_CHILDREN) {
      throw new Error(`Maximum ${GuestCount.MAX_CHILDREN} children allowed`)
    }
    if (pets > GuestCount.MAX_PETS) {
      throw new Error(`Maximum ${GuestCount.MAX_PETS} pets allowed`)
    }
    if (vehicles > GuestCount.MAX_VEHICLES) {
      throw new Error(`Maximum ${GuestCount.MAX_VEHICLES} vehicles allowed`)
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get adults(): number {
    return this.props.adults
  }

  get children(): number {
    return this.props.children
  }

  get pets(): number {
    return this.props.pets
  }

  get vehicles(): number {
    return this.props.vehicles
  }

  /**
   * Get total number of guests (adults + children)
   */
  get totalGuests(): number {
    return this.props.adults + this.props.children
  }

  // ============================================================================
  // Business Logic Methods
  // ============================================================================

  /**
   * Check if this guest count has children
   */
  public hasChildren(): boolean {
    return this.props.children > 0
  }

  /**
   * Check if this guest count has pets
   */
  public hasPets(): boolean {
    return this.props.pets > 0
  }

  /**
   * Check if this guest count has vehicles
   */
  public hasVehicles(): boolean {
    return this.props.vehicles > 0
  }

  /**
   * Check if this guest count is adults-only (no children)
   */
  public isAdultsOnly(): boolean {
    return this.props.children === 0
  }

  /**
   * Check if guest count exceeds a given capacity
   *
   * @param maxGuests - Maximum allowed guests
   * @returns true if exceeds capacity
   */
  public exceedsCapacity(maxGuests: number): boolean {
    return this.totalGuests > maxGuests
  }

  /**
   * Update adult count
   *
   * @param adults - New adult count
   * @returns New GuestCount with updated adults
   */
  public updateAdults(adults: number): GuestCount {
    return GuestCount.create(adults, this.props.children, this.props.pets, this.props.vehicles)
  }

  /**
   * Update children count
   *
   * @param children - New children count
   * @returns New GuestCount with updated children
   */
  public updateChildren(children: number): GuestCount {
    return GuestCount.create(this.props.adults, children, this.props.pets, this.props.vehicles)
  }

  /**
   * Update pets count
   *
   * @param pets - New pets count
   * @returns New GuestCount with updated pets
   */
  public updatePets(pets: number): GuestCount {
    return GuestCount.create(this.props.adults, this.props.children, pets, this.props.vehicles)
  }

  /**
   * Update vehicles count
   *
   * @param vehicles - New vehicles count
   * @returns New GuestCount with updated vehicles
   */
  public updateVehicles(vehicles: number): GuestCount {
    return GuestCount.create(this.props.adults, this.props.children, this.props.pets, vehicles)
  }

  /**
   * Add guests to current count
   *
   * @param adults - Adults to add (default 0)
   * @param children - Children to add (default 0)
   * @returns New GuestCount with added guests
   */
  public addGuests(adults = 0, children = 0): GuestCount {
    return GuestCount.create(
      this.props.adults + adults,
      this.props.children + children,
      this.props.pets,
      this.props.vehicles
    )
  }

  /**
   * Remove guests from current count
   *
   * @param adults - Adults to remove (default 0)
   * @param children - Children to remove (default 0)
   * @returns New GuestCount with removed guests
   */
  public removeGuests(adults = 0, children = 0): GuestCount {
    return GuestCount.create(
      this.props.adults - adults,
      this.props.children - children,
      this.props.pets,
      this.props.vehicles
    )
  }

  /**
   * Format guest count as a summary string
   */
  public override toString(): string {
    const parts: string[] = []

    parts.push(`${this.props.adults} adult${this.props.adults === 1 ? '' : 's'}`)

    if (this.props.children > 0) {
      parts.push(`${this.props.children} child${this.props.children === 1 ? '' : 'ren'}`)
    }
    if (this.props.pets > 0) {
      parts.push(`${this.props.pets} pet${this.props.pets === 1 ? '' : 's'}`)
    }
    if (this.props.vehicles > 0) {
      parts.push(`${this.props.vehicles} vehicle${this.props.vehicles === 1 ? '' : 's'}`)
    }

    return parts.join(', ')
  }

  // ============================================================================
  // ValueObject Implementation
  // ============================================================================

  /**
   * Compare equality based on all counts
   */
  protected equalityComponents(): Array<any> {
    return [
      this.props.adults,
      this.props.children,
      this.props.pets,
      this.props.vehicles,
    ]
  }
}

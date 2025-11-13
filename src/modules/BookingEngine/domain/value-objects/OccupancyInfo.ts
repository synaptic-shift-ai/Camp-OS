/**
 * OccupancyInfo Value Object
 *
 * Represents occupancy details for a reservation.
 *
 * Business Rules:
 * - At least 1 adult required
 * - Maximum 20 people total (adults + children)
 * - Maximum 10 pets
 * - Maximum 5 vehicles
 * - All values must be non-negative integers
 */

import { ValueObject } from '@/shared/domain/ValueObject'

export interface OccupancyInfoProps {
  numAdults: number
  numChildren: number
  numPets: number
  numVehicles: number
}

export class OccupancyInfo extends ValueObject<OccupancyInfoProps> {
  private static readonly MIN_ADULTS = 1
  private static readonly MAX_TOTAL_PEOPLE = 20
  private static readonly MAX_PETS = 10
  private static readonly MAX_VEHICLES = 5

  private constructor(props: OccupancyInfoProps) {
    super(props)
  }

  static create(
    numAdults: number,
    numChildren: number = 0,
    numPets: number = 0,
    numVehicles: number = 1
  ): OccupancyInfo {
    // Validate all are non-negative integers
    const values = { numAdults, numChildren, numPets, numVehicles }
    for (const [key, value] of Object.entries(values)) {
      if (!Number.isInteger(value) || value < 0) {
        throw new Error(`${key} must be a non-negative integer`)
      }
    }

    // Validate minimum adults
    if (numAdults < this.MIN_ADULTS) {
      throw new Error(`At least ${this.MIN_ADULTS} adult(s) required`)
    }

    // Validate maximum total people
    const totalPeople = numAdults + numChildren
    if (totalPeople > this.MAX_TOTAL_PEOPLE) {
      throw new Error(`Maximum ${this.MAX_TOTAL_PEOPLE} people allowed`)
    }

    // Validate maximum pets
    if (numPets > this.MAX_PETS) {
      throw new Error(`Maximum ${this.MAX_PETS} pets allowed`)
    }

    // Validate maximum vehicles
    if (numVehicles > this.MAX_VEHICLES) {
      throw new Error(`Maximum ${this.MAX_VEHICLES} vehicles allowed`)
    }

    return new OccupancyInfo({
      numAdults,
      numChildren,
      numPets,
      numVehicles,
    })
  }

  get numAdults(): number {
    return this.props.numAdults
  }

  get numChildren(): number {
    return this.props.numChildren
  }

  get numPets(): number {
    return this.props.numPets
  }

  get numVehicles(): number {
    return this.props.numVehicles
  }

  /**
   * Get total number of people (adults + children)
   */
  get totalPeople(): number {
    return this.numAdults + this.numChildren
  }

  /**
   * Check if occupancy includes pets
   */
  hasPets(): boolean {
    return this.numPets > 0
  }

  /**
   * Check if occupancy exceeds site capacity
   */
  exceedsCapacity(siteMaxOccupancy: number): boolean {
    return this.totalPeople > siteMaxOccupancy
  }

  /**
   * Update number of adults
   */
  updateAdults(numAdults: number): OccupancyInfo {
    return OccupancyInfo.create(
      numAdults,
      this.numChildren,
      this.numPets,
      this.numVehicles
    )
  }

  /**
   * Update number of children
   */
  updateChildren(numChildren: number): OccupancyInfo {
    return OccupancyInfo.create(
      this.numAdults,
      numChildren,
      this.numPets,
      this.numVehicles
    )
  }
}

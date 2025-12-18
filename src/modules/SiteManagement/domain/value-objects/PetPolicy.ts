/**
 * PetPolicy Value Object
 *
 * Encapsulates pet-related policies for a site including whether pets
 * are allowed, associated fees, and any restrictions.
 */

export type PetPolicyProps = {
  allowPets: boolean
  petFee: number | null // Fee in cents, null means no additional fee
  maxPets: number | null // null means no limit
  restrictions: string | null // e.g., "Dogs only, max 50 lbs"
}

export class PetPolicy {
  private constructor(private readonly props: PetPolicyProps) {
    Object.freeze(this.props)
  }

  static create(
    allowPets: boolean,
    petFee: number | null = null,
    maxPets: number | null = null,
    restrictions: string | null = null
  ): PetPolicy {
    if (petFee !== null && petFee < 0) {
      throw new Error('Pet fee cannot be negative')
    }

    if (maxPets !== null && maxPets < 0) {
      throw new Error('Max pets cannot be negative')
    }

    // If pets aren't allowed, fee and max should be null
    if (!allowPets) {
      return new PetPolicy({
        allowPets: false,
        petFee: null,
        maxPets: null,
        restrictions: null,
      })
    }

    return new PetPolicy({
      allowPets,
      petFee,
      maxPets,
      restrictions: restrictions?.trim() || null,
    })
  }

  static noPets(): PetPolicy {
    return PetPolicy.create(false)
  }

  static petsAllowed(petFee: number | null = null): PetPolicy {
    return PetPolicy.create(true, petFee)
  }

  static fromPersistence(
    allowPets: boolean,
    petFee: number | null
  ): PetPolicy {
    return PetPolicy.create(allowPets, petFee)
  }

  get allowPets(): boolean {
    return this.props.allowPets
  }

  get petFee(): number | null {
    return this.props.petFee
  }

  get petFeeInDollars(): number | null {
    return this.props.petFee !== null ? this.props.petFee / 100 : null
  }

  get maxPets(): number | null {
    return this.props.maxPets
  }

  get restrictions(): string | null {
    return this.props.restrictions
  }

  hasFee(): boolean {
    return this.props.petFee !== null && this.props.petFee > 0
  }

  equals(other: PetPolicy): boolean {
    return (
      this.props.allowPets === other.props.allowPets &&
      this.props.petFee === other.props.petFee &&
      this.props.maxPets === other.props.maxPets &&
      this.props.restrictions === other.props.restrictions
    )
  }

  toPersistence(): { allow_pets: boolean; pet_fee: number | null } {
    return {
      allow_pets: this.props.allowPets,
      pet_fee: this.props.petFee,
    }
  }
}

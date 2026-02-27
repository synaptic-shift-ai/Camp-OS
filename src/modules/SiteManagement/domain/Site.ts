/**
 * Site Aggregate Root
 *
 * Represents a campsite within a property. This is the first module extracted
 * as part of the modular monolith refactoring (Phase 1, Week 3).
 *
 * Business rules enforced:
 * - Site number must be unique within property
 * - Status transitions must be valid
 * - Pricing must be non-negative
 * - Capacity limits must be positive
 *
 * @example
 * ```typescript
 * const site = Site.create({
 *   id: 'site-123',
 *   propertyId: 'prop-456',
 *   siteNumber: '42',
 *   siteName: 'Lakeside Paradise',
 *   siteType: SiteType.RV,
 *   pricing: Pricing.create(75, 90, 'USD'),
 *   maxOccupancy: 6,
 *   status: SiteStatus.AVAILABLE
 * })
 *
 * site.markAsOccupied()
 * site.updatePricing(Pricing.create(80, 95, 'USD'))
 * ```
 */
import { AggregateRoot } from '@/shared/domain'
import { type Pricing } from './Pricing'
import { type SiteType } from './SiteType'
import { SiteStatus } from './SiteStatus'
import {
  SiteCreatedEvent,
  SiteUpdatedEvent,
  SiteStatusChangedEvent,
  SitePricingUpdatedEvent,
  SiteMaintenanceStartedEvent,
} from './events'
import {
  PetPolicy,
  AccessibilityFeatures,
  Coordinates,
} from './value-objects'

export type SiteProps = {
  propertyId: string
  siteNumber: string
  siteName: string | null
  siteType: SiteType
  description: string | null
  pricing: Pricing
  maxOccupancy: number | null
  maxVehicles: number | null
  sizeSqft: number | null
  status: SiteStatus
  amenities: string[] | null
  hookups: string[] | null
  images: string[] | null
  locationMap: Record<string, any> | null
  // Phase 3B additions
  petPolicy: PetPolicy
  accessibility: AccessibilityFeatures
  coordinates: Coordinates | null
}

export class Site extends AggregateRoot<string> {
  private props: SiteProps

  private constructor(
    id: string,
    props: SiteProps,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt)
    this.props = props
  }

  /**
   * Factory method to create a new site
   */
  static create(
    id: string,
    propertyId: string,
    siteNumber: string,
    siteName: string | null,
    siteType: SiteType,
    pricing: Pricing,
    options: {
      description?: string | null | undefined
      maxOccupancy?: number | null | undefined
      maxVehicles?: number | null | undefined
      sizeSqft?: number | null | undefined
      status?: SiteStatus | undefined
      amenities?: string[] | null | undefined
      hookups?: string[] | null | undefined
      images?: string[] | null | undefined
      locationMap?: Record<string, any> | null | undefined
      // Phase 3B additions
      petPolicy?: PetPolicy | undefined
      accessibility?: AccessibilityFeatures | undefined
      coordinates?: Coordinates | null | undefined
    } = {}
  ): Site {
    // Validate required fields
    if (!propertyId) {
      throw new Error('Property ID is required')
    }
    if (!siteNumber || siteNumber.trim().length === 0) {
      throw new Error('Site number is required')
    }

    // Validate capacity
    if (options.maxOccupancy !== undefined && options.maxOccupancy !== null && options.maxOccupancy < 1) {
      throw new Error('Max occupancy must be at least 1')
    }
    if (options.maxVehicles !== undefined && options.maxVehicles !== null && options.maxVehicles < 0) {
      throw new Error('Max vehicles cannot be negative')
    }
    if (options.sizeSqft !== undefined && options.sizeSqft !== null && options.sizeSqft < 0) {
      throw new Error('Size cannot be negative')
    }

    const site = new Site(
      id,
      {
        propertyId,
        siteNumber: siteNumber.trim(),
        siteName: siteName?.trim() || null,
        siteType,
        description: options.description || null,
        pricing,
        maxOccupancy: options.maxOccupancy || null,
        maxVehicles: options.maxVehicles || null,
        sizeSqft: options.sizeSqft || null,
        status: options.status || SiteStatus.AVAILABLE,
        amenities: options.amenities || null,
        hookups: options.hookups || null,
        images: options.images || null,
        locationMap: options.locationMap || null,
        petPolicy: options.petPolicy || PetPolicy.noPets(),
        accessibility: options.accessibility || AccessibilityFeatures.notAccessible(),
        coordinates: options.coordinates || null,
      }
    )

    // Record domain event
    site.addDomainEvent(
      new SiteCreatedEvent(
        id,
        propertyId,
        siteNumber,
        siteName,
        siteType
      )
    )

    return site
  }

  /**
   * Reconstitute site from database row
   */
  static fromPersistence(
    id: string,
    propertyId: string,
    siteNumber: string,
    siteName: string | null,
    siteType: SiteType,
    pricing: Pricing,
    maxOccupancy: number | null,
    maxVehicles: number | null,
    sizeSqft: number | null,
    status: SiteStatus,
    description: string | null,
    amenities: string[] | null,
    hookups: string[] | null,
    images: string[] | null,
    locationMap: Record<string, any> | null,
    createdAt: Date,
    updatedAt: Date,
    // Phase 3B additions
    allowPets: boolean = false,
    petFee: number | null = null,
    adaAccessible: boolean = false,
    accessibilityFeatures: unknown = null
  ): Site {
    return new Site(
      id,
      {
        propertyId,
        siteNumber,
        siteName,
        siteType,
        description,
        pricing,
        maxOccupancy,
        maxVehicles,
        sizeSqft,
        status,
        amenities,
        hookups,
        images,
        locationMap,
        petPolicy: PetPolicy.fromPersistence(allowPets, petFee),
        accessibility: AccessibilityFeatures.fromPersistence(adaAccessible, accessibilityFeatures),
        coordinates: Coordinates.fromPersistence(locationMap),
      },
      createdAt,
      updatedAt
    )
  }

  // ============================================================
  // Getters
  // ============================================================

  get propertyId(): string {
    return this.props.propertyId
  }

  get siteNumber(): string {
    return this.props.siteNumber
  }

  get siteName(): string | null {
    return this.props.siteName
  }

  get siteType(): SiteType {
    return this.props.siteType
  }

  get description(): string | null {
    return this.props.description
  }

  get pricing(): Pricing {
    return this.props.pricing
  }

  get maxOccupancy(): number | null {
    return this.props.maxOccupancy
  }

  get maxVehicles(): number | null {
    return this.props.maxVehicles
  }

  get sizeSqft(): number | null {
    return this.props.sizeSqft
  }

  get status(): SiteStatus {
    return this.props.status
  }

  get amenities(): string[] | null {
    return this.props.amenities
  }

  get hookups(): string[] | null {
    return this.props.hookups
  }

  get images(): string[] | null {
    return this.props.images
  }

  get locationMap(): Record<string, any> | null {
    return this.props.locationMap
  }

  // Phase 3B getters
  get petPolicy(): PetPolicy {
    return this.props.petPolicy
  }

  get accessibility(): AccessibilityFeatures {
    return this.props.accessibility
  }

  get coordinates(): Coordinates | null {
    return this.props.coordinates
  }

  get allowsPets(): boolean {
    return this.props.petPolicy.allowPets
  }

  get isAdaAccessible(): boolean {
    return this.props.accessibility.adaAccessible
  }

  // ============================================================
  // Business Logic
  // ============================================================

  /**
   * Update site details
   */
  updateDetails(updates: {
    siteName?: string | null | undefined
    description?: string | null | undefined
    maxOccupancy?: number | null | undefined
    maxVehicles?: number | null | undefined
    sizeSqft?: number | null | undefined
    amenities?: string[] | null | undefined
    hookups?: string[] | null | undefined
  }): void {
    // Validate capacity updates
    if (updates.maxOccupancy !== undefined && updates.maxOccupancy !== null && updates.maxOccupancy < 1) {
      throw new Error('Max occupancy must be at least 1')
    }
    if (updates.maxVehicles !== undefined && updates.maxVehicles !== null && updates.maxVehicles < 0) {
      throw new Error('Max vehicles cannot be negative')
    }
    if (updates.sizeSqft !== undefined && updates.sizeSqft !== null && updates.sizeSqft < 0) {
      throw new Error('Size cannot be negative')
    }

    // Apply updates
    if (updates.siteName !== undefined) {
      this.props.siteName = updates.siteName?.trim() || null
    }
    if (updates.description !== undefined) {
      this.props.description = updates.description
    }
    if (updates.maxOccupancy !== undefined) {
      this.props.maxOccupancy = updates.maxOccupancy
    }
    if (updates.maxVehicles !== undefined) {
      this.props.maxVehicles = updates.maxVehicles
    }
    if (updates.sizeSqft !== undefined) {
      this.props.sizeSqft = updates.sizeSqft
    }
    if (updates.amenities !== undefined) {
      this.props.amenities = updates.amenities
    }
    if (updates.hookups !== undefined) {
      this.props.hookups = updates.hookups
    }

    this.touch()
    this.addDomainEvent(new SiteUpdatedEvent(this.id, this.propertyId))
  }

  /**
   * Update pricing
   */
  updatePricing(newPricing: Pricing): void {
    const oldPricing = this.props.pricing
    this.props.pricing = newPricing

    this.touch()
    this.addDomainEvent(
      new SitePricingUpdatedEvent(
        this.id,
        this.propertyId,
        oldPricing.basePrice,
        newPricing.basePrice
      )
    )
  }

  /**
   * Update images
   */
  updateImages(images: string[]): void {
    this.props.images = images
    this.touch()
    this.addDomainEvent(new SiteUpdatedEvent(this.id, this.propertyId))
  }

  /**
   * Update location map data
   */
  updateLocationMap(locationMap: Record<string, any>): void {
    this.props.locationMap = locationMap
    this.touch()
    this.addDomainEvent(new SiteUpdatedEvent(this.id, this.propertyId))
  }

  /**
   * Mark site as available
   */
  markAsAvailable(): void {
    if (this.props.status === SiteStatus.AVAILABLE) {
      return // Already available
    }

    const oldStatus = this.props.status
    this.props.status = SiteStatus.AVAILABLE

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.AVAILABLE)
    )
  }

  /**
   * Mark site as reserved (has upcoming booking but not yet occupied)
   */
  markAsReserved(): void {
    if (this.props.status !== SiteStatus.AVAILABLE) {
      throw new Error(`Cannot reserve site - current status is ${this.props.status}`)
    }

    const oldStatus = this.props.status
    this.props.status = SiteStatus.RESERVED

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.RESERVED)
    )
  }

  /**
   * Release a reserved site back to available
   */
  release(): void {
    if (this.props.status !== SiteStatus.RESERVED && this.props.status !== SiteStatus.BOOKED) {
      throw new Error(`Cannot release site - current status is ${this.props.status}`)
    }

    const oldStatus = this.props.status
    this.props.status = SiteStatus.AVAILABLE

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.AVAILABLE)
    )
  }

  /**
   * Mark site as occupied
   */
  markAsOccupied(): void {
    if (this.props.status !== SiteStatus.AVAILABLE && this.props.status !== SiteStatus.RESERVED) {
      throw new Error(`Cannot occupy site - current status is ${this.props.status}`)
    }

    const oldStatus = this.props.status
    this.props.status = SiteStatus.OCCUPIED

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.OCCUPIED)
    )
  }

  /**
   * Mark site as requiring housekeeping
   */
  markAsNeedsHousekeeping(): void {
    const oldStatus = this.props.status
    this.props.status = SiteStatus.NEEDS_HOUSEKEEPING

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.NEEDS_HOUSEKEEPING)
    )
  }

  /**
   * Complete housekeeping and mark as available
   */
  completeHousekeeping(): void {
    if (this.props.status !== SiteStatus.NEEDS_HOUSEKEEPING) {
      throw new Error('Cannot complete housekeeping - site is not marked as needing housekeeping')
    }

    const oldStatus = this.props.status
    this.props.status = SiteStatus.AVAILABLE

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.AVAILABLE)
    )
  }

  /**
   * Mark site as out of service
   */
  markAsOutOfService(): void {
    const oldStatus = this.props.status
    this.props.status = SiteStatus.OUT_OF_SERVICE

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.OUT_OF_SERVICE)
    )
  }

  /**
   * Put site under maintenance (alias for markAsOutOfService with additional event)
   * Triggers maintenance-specific workflows
   */
  putUnderMaintenance(
    reason: string | null = null,
    estimatedEndDate: Date | null = null,
    initiatedBy: string | null = null
  ): void {
    const oldStatus = this.props.status
    this.props.status = SiteStatus.OUT_OF_SERVICE

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.OUT_OF_SERVICE)
    )
    this.addDomainEvent(
      new SiteMaintenanceStartedEvent(
        this.id,
        this.propertyId,
        reason,
        estimatedEndDate,
        initiatedBy
      )
    )
  }

  /**
   * Complete maintenance and return to available
   */
  completeMaintenance(): void {
    if (this.props.status !== SiteStatus.OUT_OF_SERVICE) {
      throw new Error('Cannot complete maintenance - site is not under maintenance')
    }

    const oldStatus = this.props.status
    this.props.status = SiteStatus.AVAILABLE

    this.touch()
    this.addDomainEvent(
      new SiteStatusChangedEvent(this.id, this.propertyId, oldStatus, SiteStatus.AVAILABLE)
    )
  }

  /**
   * Check if site is available for booking
   */
  isAvailableForBooking(): boolean {
    return this.props.status === SiteStatus.AVAILABLE
  }

  /**
   * Check if site can accommodate capacity
   */
  canAccommodate(occupancy: number, vehicles: number): boolean {
    if (this.props.maxOccupancy !== null && occupancy > this.props.maxOccupancy) {
      return false
    }
    if (this.props.maxVehicles !== null && vehicles > this.props.maxVehicles) {
      return false
    }
    return true
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): Record<string, any> {
    const petPersistence = this.props.petPolicy.toPersistence()
    const accessibilityPersistence = this.props.accessibility.toPersistence()

    return {
      id: this.id,
      property_id: this.props.propertyId,
      site_number: this.props.siteNumber,
      site_name: this.props.siteName,
      site_type: this.props.siteType,
      description: this.props.description,
      base_price: this.props.pricing.basePrice,
      weekend_price: this.props.pricing.weekendPrice,
      max_occupancy: this.props.maxOccupancy,
      max_vehicles: this.props.maxVehicles,
      size_sqft: this.props.sizeSqft,
      status: this.props.status,
      amenities: this.props.amenities,
      hookups: this.props.hookups,
      images: this.props.images,
      location_map: this.props.coordinates
        ? this.props.coordinates.toPersistence()
        : this.props.locationMap,
      // Phase 3B: Pet and accessibility fields
      allow_pets: petPersistence.allow_pets,
      pet_fee: petPersistence.pet_fee,
      ada_accessible: accessibilityPersistence.ada_accessible,
      accessibility_features: accessibilityPersistence.accessibility_features,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

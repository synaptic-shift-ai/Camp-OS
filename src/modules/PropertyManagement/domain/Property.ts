/**
 * Property Aggregate Root
 *
 * Represents a campground property within the system. This is the second module
 * extracted as part of the modular monolith refactoring (Phase 2, Week 5).
 *
 * Business rules enforced:
 * - Property must belong to a company (multi-tenant isolation)
 * - Slug must be unique and URL-safe
 * - Onboarding must be completed before accepting bookings
 * - Stripe Connect required for payment processing
 * - Status transitions must be valid
 *
 * Following ADR-001: Explicit Wizard State Management
 * - onboarding_completed is derived from OnboardingStatus.COMPLETED
 * - Onboarding state transitions are explicit and tracked
 *
 * @example
 * ```typescript
 * const property = Property.create({
 *   id: 'prop-123',
 *   companyId: 'company-456',
 *   name: 'Mountain View Campground',
 *   slug: 'mountain-view',
 *   ownerId: 'user-789'
 * })
 *
 * property.connectStripe('acct_123')
 * property.completeOnboarding()
 * ```
 */
import { AggregateRoot } from '@/shared/domain'
import { PropertySettings } from './PropertySettings'
import { PropertyType } from './PropertyType'
import { PropertyStatus } from './PropertyStatus'
import { OnboardingStatus, isOnboardingComplete } from './OnboardingStatus'
import { StripeConnectInfo } from './StripeConnectInfo'
import {
  PropertyCreatedEvent,
  PropertyUpdatedEvent,
  OnboardingCompletedEvent,
  StripeConnectedEvent,
  PropertyStatusChangedEvent,
} from './events'

export type PropertyProps = {
  companyId: string
  ownerId: string | null
  name: string
  slug: string
  description: string | null
  propertyType: PropertyType | null
  status: PropertyStatus

  // Location
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null

  // Contact
  phone: string | null
  email: string | null

  // Branding
  subdomain: string | null
  bookingPageSlug: string | null

  // Settings
  settings: PropertySettings
  amenities: string[] | null

  // Onboarding
  onboardingStatus: OnboardingStatus
  onboardingCompletedAt: Date | null

  // Stripe Connect
  stripeConnectInfo: StripeConnectInfo
}

export class Property extends AggregateRoot<string> {
  private props: PropertyProps

  private constructor(
    id: string,
    props: PropertyProps,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt)
    this.props = props
  }

  /**
   * Factory method to create a new property
   */
  static create(
    id: string,
    companyId: string,
    ownerId: string | null,
    name: string,
    slug: string,
    options: {
      description?: string | null | undefined
      propertyType?: PropertyType | null | undefined
      address?: string | null | undefined
      city?: string | null | undefined
      state?: string | null | undefined
      zipCode?: string | null | undefined
      country?: string | null | undefined
      phone?: string | null | undefined
      email?: string | null | undefined
      subdomain?: string | null | undefined
      bookingPageSlug?: string | null | undefined
      settings?: PropertySettings | undefined
      amenities?: string[] | null | undefined
    } = {}
  ): Property {
    // Validate required fields
    if (!companyId) {
      throw new Error('Company ID is required')
    }
    if (!name || name.trim().length === 0) {
      throw new Error('Property name is required')
    }
    if (!slug || slug.trim().length === 0) {
      throw new Error('Property slug is required')
    }

    // Normalize slug before validation
    const normalizedSlug = slug.trim().toLowerCase()

    // Validate slug format (URL-safe)
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(normalizedSlug)) {
      throw new Error('Property slug must be URL-safe (lowercase letters, numbers, and hyphens only)')
    }

    // Validate email if provided
    if (options.email && options.email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(options.email)) {
        throw new Error('Invalid email format')
      }
    }

    const property = new Property(
      id,
      {
        companyId,
        ownerId,
        name: name.trim(),
        slug: normalizedSlug,
        description: options.description || null,
        propertyType: options.propertyType || null,
        status: PropertyStatus.DRAFT, // New properties start in draft
        address: options.address || null,
        city: options.city || null,
        state: options.state || null,
        zipCode: options.zipCode || null,
        country: options.country || null,
        phone: options.phone || null,
        email: options.email || null,
        subdomain: options.subdomain || null,
        bookingPageSlug: options.bookingPageSlug || null,
        settings: options.settings || PropertySettings.default(),
        amenities: options.amenities || null,
        onboardingStatus: OnboardingStatus.NOT_STARTED,
        onboardingCompletedAt: null,
        stripeConnectInfo: StripeConnectInfo.notConnected(),
      }
    )

    // Record domain event
    property.addDomainEvent(
      new PropertyCreatedEvent(id, companyId, name, slug)
    )

    return property
  }

  /**
   * Reconstitute property from database row
   */
  static fromPersistence(
    id: string,
    companyId: string,
    ownerId: string | null,
    name: string,
    slug: string,
    description: string | null,
    propertyType: PropertyType | null,
    status: PropertyStatus,
    address: string | null,
    city: string | null,
    state: string | null,
    zipCode: string | null,
    country: string | null,
    phone: string | null,
    email: string | null,
    subdomain: string | null,
    bookingPageSlug: string | null,
    settings: PropertySettings,
    amenities: string[] | null,
    onboardingCompleted: boolean,
    onboardingCompletedAt: Date | null,
    stripeAccountId: string | null,
    stripeConnectedAt: Date | null,
    createdAt: Date,
    updatedAt: Date
  ): Property {
    // Derive onboarding status from onboarding_completed flag
    const onboardingStatus = onboardingCompleted
      ? OnboardingStatus.COMPLETED
      : OnboardingStatus.NOT_STARTED

    const stripeConnectInfo = stripeAccountId && stripeConnectedAt
      ? StripeConnectInfo.create(stripeAccountId, stripeConnectedAt)
      : StripeConnectInfo.notConnected()

    return new Property(
      id,
      {
        companyId,
        ownerId,
        name,
        slug,
        description,
        propertyType,
        status,
        address,
        city,
        state,
        zipCode,
        country,
        phone,
        email,
        subdomain,
        bookingPageSlug,
        settings,
        amenities,
        onboardingStatus,
        onboardingCompletedAt,
        stripeConnectInfo,
      },
      createdAt,
      updatedAt
    )
  }

  // ============================================================
  // Getters
  // ============================================================

  get companyId(): string {
    return this.props.companyId
  }

  get ownerId(): string | null {
    return this.props.ownerId
  }

  get name(): string {
    return this.props.name
  }

  get slug(): string {
    return this.props.slug
  }

  get description(): string | null {
    return this.props.description
  }

  get propertyType(): PropertyType | null {
    return this.props.propertyType
  }

  get status(): PropertyStatus {
    return this.props.status
  }

  get address(): string | null {
    return this.props.address
  }

  get city(): string | null {
    return this.props.city
  }

  get state(): string | null {
    return this.props.state
  }

  get zipCode(): string | null {
    return this.props.zipCode
  }

  get country(): string | null {
    return this.props.country
  }

  get phone(): string | null {
    return this.props.phone
  }

  get email(): string | null {
    return this.props.email
  }

  get subdomain(): string | null {
    return this.props.subdomain
  }

  get bookingPageSlug(): string | null {
    return this.props.bookingPageSlug
  }

  get settings(): PropertySettings {
    return this.props.settings
  }

  get amenities(): string[] | null {
    return this.props.amenities
  }

  get onboardingStatus(): OnboardingStatus {
    return this.props.onboardingStatus
  }

  get onboardingCompletedAt(): Date | null {
    return this.props.onboardingCompletedAt
  }

  get stripeConnectInfo(): StripeConnectInfo {
    return this.props.stripeConnectInfo
  }

  /**
   * Derived: Check if onboarding is complete
   * Following ADR-001: Single source of truth
   */
  isOnboardingComplete(): boolean {
    return isOnboardingComplete(this.props.onboardingStatus)
  }

  /**
   * Derived: Check if property can accept bookings
   */
  canAcceptBookings(): boolean {
    return (
      this.props.status === PropertyStatus.ACTIVE &&
      this.isOnboardingComplete() &&
      this.props.stripeConnectInfo.isConnected()
    )
  }

  // ============================================================
  // Business Logic
  // ============================================================

  /**
   * Update basic property details
   */
  updateDetails(updates: {
    name?: string | undefined
    description?: string | null | undefined
    propertyType?: PropertyType | null | undefined
    phone?: string | null | undefined
    email?: string | null | undefined
  }): void {
    // Validate name
    if (updates.name !== undefined) {
      if (!updates.name || updates.name.trim().length === 0) {
        throw new Error('Property name is required')
      }
      this.props.name = updates.name.trim()
    }

    // Validate email
    if (updates.email !== undefined && updates.email && updates.email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(updates.email)) {
        throw new Error('Invalid email format')
      }
      this.props.email = updates.email.trim()
    } else if (updates.email !== undefined) {
      this.props.email = null
    }

    // Apply other updates
    if (updates.description !== undefined) {
      this.props.description = updates.description
    }
    if (updates.propertyType !== undefined) {
      this.props.propertyType = updates.propertyType
    }
    if (updates.phone !== undefined) {
      this.props.phone = updates.phone
    }

    this.touch()
    this.addDomainEvent(new PropertyUpdatedEvent(this.id, this.companyId))
  }

  /**
   * Update property location
   */
  updateLocation(location: {
    address?: string | null | undefined
    city?: string | null | undefined
    state?: string | null | undefined
    zipCode?: string | null | undefined
    country?: string | null | undefined
  }): void {
    if (location.address !== undefined) {
      this.props.address = location.address
    }
    if (location.city !== undefined) {
      this.props.city = location.city
    }
    if (location.state !== undefined) {
      this.props.state = location.state
    }
    if (location.zipCode !== undefined) {
      this.props.zipCode = location.zipCode
    }
    if (location.country !== undefined) {
      this.props.country = location.country
    }

    this.touch()
    this.addDomainEvent(new PropertyUpdatedEvent(this.id, this.companyId))
  }

  /**
   * Update property settings
   */
  updateSettings(newSettings: PropertySettings): void {
    this.props.settings = newSettings

    this.touch()
    this.addDomainEvent(new PropertyUpdatedEvent(this.id, this.companyId))
  }

  /**
   * Update amenities
   */
  updateAmenities(amenities: string[]): void {
    this.props.amenities = amenities

    this.touch()
    this.addDomainEvent(new PropertyUpdatedEvent(this.id, this.companyId))
  }

  /**
   * Update branding
   */
  updateBranding(updates: {
    subdomain?: string | null | undefined
    bookingPageSlug?: string | null | undefined
  }): void {
    if (updates.subdomain !== undefined) {
      this.props.subdomain = updates.subdomain
    }
    if (updates.bookingPageSlug !== undefined) {
      this.props.bookingPageSlug = updates.bookingPageSlug
    }

    this.touch()
    this.addDomainEvent(new PropertyUpdatedEvent(this.id, this.companyId))
  }

  /**
   * Connect Stripe account
   */
  connectStripe(stripeAccountId: string): void {
    if (!stripeAccountId || stripeAccountId.trim().length === 0) {
      throw new Error('Stripe account ID is required')
    }

    const connectedAt = new Date()
    this.props.stripeConnectInfo = StripeConnectInfo.create(
      stripeAccountId,
      connectedAt
    )

    // Update onboarding status if needed
    if (this.props.onboardingStatus === OnboardingStatus.STRIPE_CONNECTING) {
      this.props.onboardingStatus = OnboardingStatus.STRIPE_CONNECTED
    }

    this.touch()
    this.addDomainEvent(
      new StripeConnectedEvent(
        this.id,
        this.companyId,
        stripeAccountId,
        connectedAt
      )
    )
  }

  /**
   * Advance onboarding to next step
   */
  advanceOnboarding(newStatus: OnboardingStatus): void {
    // Validate transition
    const currentStatus = this.props.onboardingStatus

    if (newStatus === OnboardingStatus.COMPLETED) {
      // Completing onboarding requires Stripe Connect
      if (!this.props.stripeConnectInfo.isConnected()) {
        throw new Error('Cannot complete onboarding without Stripe Connect')
      }
    }

    this.props.onboardingStatus = newStatus

    // If completing onboarding
    if (newStatus === OnboardingStatus.COMPLETED) {
      this.props.onboardingCompletedAt = new Date()

      // Activate property when onboarding is complete
      if (this.props.status === PropertyStatus.DRAFT) {
        this.props.status = PropertyStatus.ACTIVE
      }

      this.touch()
      this.addDomainEvent(
        new OnboardingCompletedEvent(
          this.id,
          this.companyId,
          this.props.onboardingCompletedAt
        )
      )
    } else {
      this.touch()
      this.addDomainEvent(new PropertyUpdatedEvent(this.id, this.companyId))
    }
  }

  /**
   * Complete onboarding
   */
  completeOnboarding(): void {
    if (this.isOnboardingComplete()) {
      return // Already complete
    }

    this.advanceOnboarding(OnboardingStatus.COMPLETED)
  }

  /**
   * Change property status
   */
  changeStatus(newStatus: PropertyStatus): void {
    if (newStatus === this.props.status) {
      return // No change
    }

    // Validate transition
    if (newStatus === PropertyStatus.ACTIVE && !this.isOnboardingComplete()) {
      throw new Error('Cannot activate property before completing onboarding')
    }

    const oldStatus = this.props.status
    this.props.status = newStatus

    this.touch()
    this.addDomainEvent(
      new PropertyStatusChangedEvent(this.id, this.companyId, oldStatus, newStatus)
    )
  }

  /**
   * Activate property
   */
  activate(): void {
    this.changeStatus(PropertyStatus.ACTIVE)
  }

  /**
   * Deactivate property
   */
  deactivate(): void {
    this.changeStatus(PropertyStatus.INACTIVE)
  }

  /**
   * Close property temporarily
   */
  close(): void {
    this.changeStatus(PropertyStatus.CLOSED)
  }

  /**
   * Convert to persistence format
   */
  toPersistence(): Record<string, any> {
    return {
      id: this.id,
      company_id: this.props.companyId,
      owner_id: this.props.ownerId,
      name: this.props.name,
      slug: this.props.slug,
      description: this.props.description,
      property_type: this.props.propertyType,
      status: this.props.status,
      address: this.props.address,
      city: this.props.city,
      state: this.props.state,
      zip_code: this.props.zipCode,
      country: this.props.country,
      phone: this.props.phone,
      email: this.props.email,
      subdomain: this.props.subdomain,
      booking_page_slug: this.props.bookingPageSlug,
      settings: this.props.settings.toJson(),
      amenities: this.props.amenities,
      onboarding_completed: this.isOnboardingComplete(),
      onboarding_completed_at: this.props.onboardingCompletedAt?.toISOString() || null,
      stripe_account_id: this.props.stripeConnectInfo.accountId,
      stripe_connected_at: this.props.stripeConnectInfo.connectedAt?.toISOString() || null,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

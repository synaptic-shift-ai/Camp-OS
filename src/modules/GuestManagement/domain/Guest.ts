/**
 * Guest Aggregate Root
 *
 * Represents a guest who books reservations at a property.
 * Encapsulates all business logic related to guest management.
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { PersonName } from './value-objects/PersonName'
import { ContactInfo } from './value-objects/ContactInfo'
import { Address } from './value-objects/Address'
import { GuestCreated } from './events/GuestCreated'
import { GuestUpdated } from './events/GuestUpdated'
import { StripeCustomerLinked } from './events/StripeCustomerLinked'

interface GuestProps {
  propertyId: string
  userId: string | null
  name: PersonName
  contact: ContactInfo
  address: Address | null
  stripeCustomerId: string | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

interface CreateGuestProps {
  id: string
  propertyId: string
  userId: string | null
  name: PersonName
  contact: ContactInfo
  address: Address | null
  stripeCustomerId: string | null
  notes: string | null
}

export class Guest extends AggregateRoot<string> {
  private readonly _propertyId: string
  private _userId: string | null
  private _name: PersonName
  private _contact: ContactInfo
  private _address: Address | null
  private _stripeCustomerId: string | null
  private _notes: string | null

  private constructor(id: string, props: GuestProps) {
    super(id, props.createdAt, props.updatedAt)
    this._propertyId = props.propertyId
    this._userId = props.userId
    this._name = props.name
    this._contact = props.contact
    this._address = props.address
    this._stripeCustomerId = props.stripeCustomerId
    this._notes = props.notes
  }

  /**
   * Property ID (tenant isolation)
   */
  get propertyId(): string {
    return this._propertyId
  }

  /**
   * User ID (if guest has an account)
   */
  get userId(): string | null {
    return this._userId
  }

  /**
   * Guest name
   */
  get name(): PersonName {
    return this._name
  }

  /**
   * Contact information
   */
  get contact(): ContactInfo {
    return this._contact
  }

  /**
   * Physical address (optional)
   */
  get address(): Address | null {
    return this._address
  }

  /**
   * Stripe Customer ID (for saved payment methods)
   */
  get stripeCustomerId(): string | null {
    return this._stripeCustomerId
  }

  /**
   * Internal notes about the guest
   */
  get notes(): string | null {
    return this._notes
  }

  /**
   * Factory method to create a new Guest
   *
   * @param props - Guest properties
   * @returns Guest instance
   */
  public static create(props: CreateGuestProps): Guest {
    const now = new Date()

    const guest = new Guest(props.id, {
      propertyId: props.propertyId,
      userId: props.userId,
      name: props.name,
      contact: props.contact,
      address: props.address,
      stripeCustomerId: props.stripeCustomerId,
      notes: props.notes,
      createdAt: now,
      updatedAt: now,
    })

    // Fire domain event
    guest.addDomainEvent(
      new GuestCreated({
        guestId: props.id,
        propertyId: props.propertyId,
        email: props.contact.email,
        fullName: props.name.getFullName(),
        createdAt: now,
      })
    )

    return guest
  }

  /**
   * Update contact information
   *
   * @param contact - New contact info
   */
  public updateContactInfo(contact: ContactInfo): void {
    this._contact = contact
    this.touch()

    this.addDomainEvent(
      new GuestUpdated({
        guestId: this.id,
        propertyId: this.propertyId,
        updatedFields: ['contact'],
        updatedAt: this.updatedAt,
      })
    )
  }

  /**
   * Update physical address
   *
   * @param address - New address or null to remove
   */
  public updateAddress(address: Address | null): void {
    this._address = address
    this.touch()

    this.addDomainEvent(
      new GuestUpdated({
        guestId: this.id,
        propertyId: this.propertyId,
        updatedFields: ['address'],
        updatedAt: this.updatedAt,
      })
    )
  }

  /**
   * Link Stripe Customer ID
   *
   * @param customerId - Stripe Customer ID (cus_xxxxx)
   * @throws Error if customer already linked
   */
  public linkStripeCustomer(customerId: string): void {
    if (this._stripeCustomerId !== null) {
      throw new Error('Stripe customer already linked')
    }

    this._stripeCustomerId = customerId
    this.touch()

    this.addDomainEvent(
      new StripeCustomerLinked({
        guestId: this.id,
        propertyId: this.propertyId,
        stripeCustomerId: customerId,
        linkedAt: this.updatedAt,
      })
    )
  }

  /**
   * Unlink Stripe Customer ID
   */
  public unlinkStripeCustomer(): void {
    this._stripeCustomerId = null
    this.touch()

    this.addDomainEvent(
      new GuestUpdated({
        guestId: this.id,
        propertyId: this.propertyId,
        updatedFields: ['stripeCustomerId'],
        updatedAt: this.updatedAt,
      })
    )
  }

  /**
   * Add or update notes
   *
   * @param notes - Notes text
   */
  public addNotes(notes: string): void {
    this._notes = notes
    this.touch()

    this.addDomainEvent(
      new GuestUpdated({
        guestId: this.id,
        propertyId: this.propertyId,
        updatedFields: ['notes'],
        updatedAt: this.updatedAt,
      })
    )
  }

  /**
   * Check if guest has a Stripe customer ID
   *
   * @returns True if Stripe customer linked
   */
  public hasStripeCustomer(): boolean {
    return this._stripeCustomerId !== null
  }

  /**
   * Check if guest has an address
   *
   * @returns True if address provided
   */
  public hasAddress(): boolean {
    return this._address !== null
  }

  /**
   * Check if guest has emergency contact information
   *
   * @returns True if emergency contact exists
   */
  public hasEmergencyContact(): boolean {
    return this._contact.hasEmergencyContact()
  }

  /**
   * Get guest's full name
   *
   * @returns Full name string
   */
  public getFullName(): string {
    return this._name.getFullName()
  }

  /**
   * Reconstitute Guest from persistence
   * Used by repository when loading from database
   *
   * @param id - Guest ID
   * @param props - All guest properties from database
   * @returns Guest instance
   */
  public static fromPersistence(
    id: string,
    propertyId: string,
    userId: string | null,
    name: PersonName,
    contact: ContactInfo,
    address: Address | null,
    stripeCustomerId: string | null,
    notes: string | null,
    createdAt: Date,
    updatedAt: Date
  ): Guest {
    return new Guest(id, {
      propertyId,
      userId,
      name,
      contact,
      address,
      stripeCustomerId,
      notes,
      createdAt,
      updatedAt,
    })
  }

  /**
   * Convert Guest to persistence format
   * Used by repository when saving to database
   *
   * @returns Database row format
   */
  public toPersistence(): {
    id: string
    property_id: string
    user_id: string | null
    first_name: string
    last_name: string
    email: string
    phone: string
    address: string | null
    city: string | null
    state: string | null
    zip_code: string | null
    country: string | null
    emergency_contact_name: string | null
    emergency_contact_phone: string | null
    stripe_customer_id: string | null
    notes: string | null
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      property_id: this._propertyId,
      user_id: this._userId,
      first_name: this._name.firstName,
      last_name: this._name.lastName,
      email: this._contact.email,
      phone: this._contact.phone,
      address: this._address?.street || null,
      city: this._address?.city || null,
      state: this._address?.state || null,
      zip_code: this._address?.zipCode || null,
      country: this._address?.country || null,
      emergency_contact_name: this._contact.emergencyContactName || null,
      emergency_contact_phone: this._contact.emergencyContactPhone || null,
      stripe_customer_id: this._stripeCustomerId,
      notes: this._notes,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

/**
 * Guest Data Transfer Object
 *
 * Flattened representation of Guest aggregate for API responses.
 */

import { Guest } from '../../domain/Guest'

export interface AddressDTO {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface EmergencyContactDTO {
  name: string
  phone: string
}

export interface GuestDTO {
  id: string
  propertyId: string
  userId: string | null
  firstName: string
  lastName: string
  fullName: string
  email: string
  phone: string
  address: AddressDTO | null
  emergencyContact: EmergencyContactDTO | null
  hasStripeCustomer: boolean
  stripeCustomerId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export class GuestDTO {
  /**
   * Convert Guest domain entity to DTO
   *
   * @param guest - Guest aggregate
   * @returns GuestDTO
   */
  static fromDomain(guest: Guest): GuestDTO {
    return {
      id: guest.id,
      propertyId: guest.propertyId,
      userId: guest.userId,
      firstName: guest.name.firstName,
      lastName: guest.name.lastName,
      fullName: guest.name.getFullName(),
      email: guest.contact.email,
      phone: guest.contact.phone,
      address: guest.address
        ? {
            street: guest.address.street,
            city: guest.address.city,
            state: guest.address.state,
            zipCode: guest.address.zipCode,
            country: guest.address.country,
          }
        : null,
      emergencyContact: guest.contact.hasEmergencyContact()
        ? {
            name: guest.contact.emergencyContactName!,
            phone: guest.contact.emergencyContactPhone!,
          }
        : null,
      hasStripeCustomer: guest.hasStripeCustomer(),
      stripeCustomerId: guest.stripeCustomerId,
      notes: guest.notes,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString(),
    }
  }
}

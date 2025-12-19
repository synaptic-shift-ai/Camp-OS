/**
 * Reservations API v1 Contract Tests
 *
 * Phase 6: Testing & Quality Gates
 * Parent: EXECUTION_ROADMAP.md
 *
 * CRITICAL: These tests verify the v1 reservation endpoints follow standards:
 * - Standard response envelopes
 * - Zod validation on request/response
 * - Complete entity fetching (no selective fields)
 * - All required fields present
 * - Business rule validation
 *
 * Following CLAUDE.md:
 * - T-2: Integration tests in tests/integration/
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterize test inputs
 * - T-8: Test description states what final expect verifies
 * - T-10: Test edge cases, realistic input, unexpected input, boundaries
 */

import { describe, it, expect } from 'vitest'
// eslint-disable-next-line no-restricted-imports -- Integration tests must import schemas directly for contract testing
import {
  // Enums
  ReservationStatusSchema,
  PaymentStatusSchema,
  PaymentMethodSchema,
  // Request schemas
  CreateReservationRequestSchema,
  RecordPaymentRequestSchema,
  CancelReservationRequestSchema,
  CheckInRequestSchema,
  CheckOutRequestSchema,
  ListReservationsQuerySchema,
  CheckAvailabilityQuerySchema,
  CreateManualReservationRequestSchema,
  ExtendReservationRequestSchema,
  RenewReservationRequestSchema,
  IssueRefundRequestSchema,
  GeneratePaymentLinkRequestSchema,
  // Response schemas
  ReservationResponseSchema,
  ReservationListResponseSchema,
  SiteAvailabilityResponseSchema,
  ManualReservationResponseSchema,
  ExtendReservationResponseSchema,
  RenewReservationResponseSchema,
  PaymentLinkResponseSchema,
} from '@/types/api/v1/schemas/reservations'

// ============================================================================
// Test Data Factories (T-7: Parameterized inputs)
// ============================================================================

const validUUID = () => crypto.randomUUID()
const futureDate = (daysFromNow: number) => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString()
}
const futureDateYMD = (daysFromNow: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  // Format: YYYY-MM-DD (ISO date portion)
  return date.toISOString().substring(0, 10)
}

describe('Reservations API v1 Contract Tests', () => {
  // ==========================================================================
  // Enum Schema Tests
  // ==========================================================================

  describe('Enum Schemas', () => {
    describe('ReservationStatusSchema', () => {
      it('should accept all valid reservation statuses', () => {
        const validStatuses = [
          'pending',
          'confirmed',
          'checked_in',
          'checked_out',
          'completed',
          'cancelled',
          'no_show',
        ]

        validStatuses.forEach((status) => {
          expect(() => ReservationStatusSchema.parse(status)).not.toThrow()
        })
      })

      it('should reject invalid reservation status', () => {
        expect(() => ReservationStatusSchema.parse('invalid_status')).toThrow()
        expect(() => ReservationStatusSchema.parse('CONFIRMED')).toThrow()
      })
    })

    describe('PaymentStatusSchema', () => {
      it('should accept all valid payment statuses', () => {
        const validStatuses = ['pending', 'partial', 'paid', 'refunded']

        validStatuses.forEach((status) => {
          expect(() => PaymentStatusSchema.parse(status)).not.toThrow()
        })
      })

      it('should reject invalid payment status', () => {
        expect(() => PaymentStatusSchema.parse('complete')).toThrow()
      })
    })

    describe('PaymentMethodSchema', () => {
      it('should accept all valid payment methods', () => {
        const validMethods = [
          'credit_card',
          'debit_card',
          'cash',
          'check',
          'bank_transfer',
          'stripe',
          'other',
        ]

        validMethods.forEach((method) => {
          expect(() => PaymentMethodSchema.parse(method)).not.toThrow()
        })
      })
    })
  })

  // ==========================================================================
  // Request Schema Tests
  // ==========================================================================

  describe('Request Schemas', () => {
    describe('CreateReservationRequestSchema', () => {
      it('should validate a complete create reservation request', () => {
        const validRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: {
            numAdults: 2,
            numChildren: 1,
            numPets: 1,
            numVehicles: 1,
          },
          totalAmountCents: 15000,
          specialRequests: 'Late check-in requested',
          source: 'online',
        }

        expect(() => CreateReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should validate a minimal create reservation request with defaults', () => {
        const minimalRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: {
            numAdults: 1,
          },
          totalAmountCents: 5000,
        }

        const parsed = CreateReservationRequestSchema.parse(minimalRequest)
        expect(parsed.occupancy.numChildren).toBe(0)
        expect(parsed.occupancy.numPets).toBe(0)
        expect(parsed.occupancy.numVehicles).toBe(1)
        expect(parsed.source).toBe('online')
      })

      it('should reject request with invalid UUID for siteId', () => {
        const invalidRequest = {
          siteId: 'not-a-uuid',
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: { numAdults: 1 },
          totalAmountCents: 5000,
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject request with zero adults', () => {
        const invalidRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: {
            numAdults: 0, // Invalid: at least 1 required
          },
          totalAmountCents: 5000,
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject request with negative amount', () => {
        const invalidRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: { numAdults: 1 },
          totalAmountCents: -100, // Invalid
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject request with invalid datetime format', () => {
        const invalidRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: '2025-01-15', // Missing time component
          checkOut: futureDate(10),
          occupancy: { numAdults: 1 },
          totalAmountCents: 5000,
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('RecordPaymentRequestSchema', () => {
      it('should validate a complete payment request', () => {
        const validRequest = {
          amountCents: 5000,
          paymentMethod: 'credit_card',
          stripePaymentIntentId: 'pi_123abc',
        }

        expect(() => RecordPaymentRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should reject payment with zero amount', () => {
        const invalidRequest = {
          amountCents: 0,
          paymentMethod: 'cash',
        }

        expect(() => RecordPaymentRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject payment with negative amount', () => {
        const invalidRequest = {
          amountCents: -100,
          paymentMethod: 'cash',
        }

        expect(() => RecordPaymentRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('CancelReservationRequestSchema', () => {
      it('should validate cancellation with reason and refund', () => {
        const validRequest = {
          reason: 'Guest requested cancellation',
          refundAmountCents: 5000,
        }

        expect(() => CancelReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should validate cancellation with zero refund', () => {
        const validRequest = {
          refundAmountCents: 0,
        }

        expect(() => CancelReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should reject cancellation with negative refund', () => {
        const invalidRequest = {
          refundAmountCents: -100,
        }

        expect(() => CancelReservationRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('CheckInRequestSchema', () => {
      it('should validate check-in with balance payment and notes', () => {
        const validRequest = {
          balancePaidCents: 5000,
          notes: 'Arrived early, site was ready',
        }

        expect(() => CheckInRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should validate minimal check-in request', () => {
        const minimalRequest = {}
        const parsed = CheckInRequestSchema.parse(minimalRequest)

        expect(parsed.balancePaidCents).toBe(0)
      })
    })

    describe('CheckOutRequestSchema', () => {
      it('should validate check-out with damages flag', () => {
        const validRequest = {
          hasDamages: true,
          notes: 'Fire pit area needs cleaning',
        }

        expect(() => CheckOutRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should default hasDamages to false', () => {
        const minimalRequest = {}
        const parsed = CheckOutRequestSchema.parse(minimalRequest)

        expect(parsed.hasDamages).toBe(false)
      })
    })

    describe('ListReservationsQuerySchema', () => {
      it('should validate query with all filters', () => {
        const validQuery = {
          status: 'confirmed',
          guestId: validUUID(),
          siteId: validUUID(),
          checkInFrom: futureDate(0),
          checkInTo: futureDate(30),
          limit: 25,
          offset: 0,
        }

        expect(() => ListReservationsQuerySchema.parse(validQuery)).not.toThrow()
      })

      it('should apply default pagination values', () => {
        const minimalQuery = {}
        const parsed = ListReservationsQuerySchema.parse(minimalQuery)

        expect(parsed.limit).toBe(50)
        expect(parsed.offset).toBe(0)
      })

      it('should reject limit exceeding maximum', () => {
        const invalidQuery = {
          limit: 101, // Max is 100
        }

        expect(() => ListReservationsQuerySchema.parse(invalidQuery)).toThrow()
      })
    })

    describe('CheckAvailabilityQuerySchema', () => {
      it('should validate availability check query', () => {
        const validQuery = {
          checkIn: futureDate(7),
          checkOut: futureDate(10),
        }

        expect(() => CheckAvailabilityQuerySchema.parse(validQuery)).not.toThrow()
      })

      it('should reject missing check-in', () => {
        const invalidQuery = {
          checkOut: futureDate(10),
        }

        expect(() => CheckAvailabilityQuerySchema.parse(invalidQuery)).toThrow()
      })
    })

    describe('ExtendReservationRequestSchema', () => {
      it('should validate extension request', () => {
        const validRequest = {
          newCheckOutDate: futureDate(15),
          additionalAmountCents: 10000,
        }

        expect(() => ExtendReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should reject extension with negative amount', () => {
        const invalidRequest = {
          newCheckOutDate: futureDate(15),
          additionalAmountCents: -100,
        }

        expect(() => ExtendReservationRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('RenewReservationRequestSchema', () => {
      it('should validate weekly renewal', () => {
        const validRequest = {
          renewalPeriod: 'weekly',
          totalAmountCents: 35000,
        }

        expect(() => RenewReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should validate monthly renewal', () => {
        const validRequest = {
          renewalPeriod: 'monthly',
          totalAmountCents: 150000,
        }

        expect(() => RenewReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should validate custom renewal with customNights', () => {
        const validRequest = {
          renewalPeriod: 'custom',
          customNights: 14,
          totalAmountCents: 70000,
        }

        expect(() => RenewReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should reject custom renewal without customNights', () => {
        const invalidRequest = {
          renewalPeriod: 'custom',
          totalAmountCents: 70000,
          // Missing customNights
        }

        expect(() => RenewReservationRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('IssueRefundRequestSchema', () => {
      it('should validate refund request with all fields', () => {
        const validRequest = {
          amountCents: 5000,
          reason: 'cancellation',
          notes: 'Full refund per policy',
        }

        expect(() => IssueRefundRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should reject refund with zero amount', () => {
        const invalidRequest = {
          amountCents: 0,
          reason: 'cancellation',
        }

        expect(() => IssueRefundRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should accept all valid refund reasons', () => {
        const validReasons = [
          'cancellation',
          'partial_cancellation',
          'service_issue',
          'overbooking',
          'weather',
          'other',
        ]

        validReasons.forEach((reason) => {
          const request = { amountCents: 1000, reason }
          expect(() => IssueRefundRequestSchema.parse(request)).not.toThrow()
        })
      })
    })

    describe('CreateManualReservationRequestSchema', () => {
      it('should validate a complete manual reservation request', () => {
        const validRequest = {
          siteId: validUUID(),
          checkInDate: futureDateYMD(7),
          checkOutDate: futureDateYMD(10),
          stayType: 'nightly',
          numAdults: 2,
          numChildren: 1,
          numPets: 1,
          numVehicles: 2,
          guest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '555-123-4567',
            address: '123 Main St',
            city: 'Camptown',
            state: 'CA',
            zipCode: '12345',
          },
          spousePartner: {
            firstName: 'Jane',
            lastName: 'Doe',
            phone: '555-987-6543',
            isAlternateContact: true,
          },
          children: [
            { firstName: 'Jimmy', age: 10 },
            { firstName: 'Sally', age: 7 },
          ],
          vehicles: [
            {
              vehicleType: 'rv',
              make: 'Winnebago',
              model: 'Vista',
              year: 2022,
              rvType: 'class_a',
              rvLengthFeet: 32,
              isPrimary: true,
            },
          ],
          evacuationContact: {
            name: 'Emergency Contact',
            phone: '555-911-0000',
            relationship: 'Parent',
          },
          paymentMode: 'card',
          paidAmountCents: 15000,
          specialRequests: 'Quiet site please',
        }

        expect(() => CreateManualReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should validate minimal manual reservation request', () => {
        const minimalRequest = {
          siteId: validUUID(),
          checkInDate: futureDateYMD(7),
          checkOutDate: futureDateYMD(10),
          numAdults: 1,
          guest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '555-0000',
          },
        }

        const parsed = CreateManualReservationRequestSchema.parse(minimalRequest)
        expect(parsed.numChildren).toBe(0)
        expect(parsed.numPets).toBe(0)
        expect(parsed.numVehicles).toBe(1)
        expect(parsed.paymentMode).toBe('cash')
      })

      it('should reject RV vehicle without required rvType', () => {
        const invalidRequest = {
          siteId: validUUID(),
          checkInDate: futureDateYMD(7),
          checkOutDate: futureDateYMD(10),
          numAdults: 1,
          guest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '555-0000',
          },
          vehicles: [
            {
              vehicleType: 'rv',
              make: 'Winnebago',
              // Missing rvType and rvLengthFeet
            },
          ],
        }

        expect(() => CreateManualReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should reject invalid date format', () => {
        const invalidRequest = {
          siteId: validUUID(),
          checkInDate: '01/15/2025', // Wrong format
          checkOutDate: futureDateYMD(10),
          numAdults: 1,
          guest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '555-0000',
          },
        }

        expect(() => CreateManualReservationRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('GeneratePaymentLinkRequestSchema', () => {
      it('should validate payment link request with amount', () => {
        const validRequest = {
          amountCents: 10000,
          sendEmail: true,
        }

        expect(() => GeneratePaymentLinkRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should default sendEmail to false', () => {
        const request = {}
        const parsed = GeneratePaymentLinkRequestSchema.parse(request)

        expect(parsed.sendEmail).toBe(false)
      })
    })
  })

  // ==========================================================================
  // Response Schema Tests
  // ==========================================================================

  describe('Response Schemas', () => {
    describe('ReservationResponseSchema', () => {
      it('should validate complete reservation response with all fields', () => {
        const validResponse = {
          id: validUUID(),
          propertyId: validUUID(),
          siteId: validUUID(),
          guestId: validUUID(),
          confirmationNumber: 'RES-2025-001234',
          checkInDate: futureDate(7),
          checkOutDate: futureDate(10),
          nights: 3,
          occupancy: {
            numAdults: 2,
            numChildren: 1,
            numPets: 0,
            numVehicles: 1,
            totalPeople: 3,
          },
          totalAmountCents: 15000,
          totalAmountDollars: 150.0,
          paidAmountCents: 15000,
          paidAmountDollars: 150.0,
          balanceCents: 0,
          balanceDollars: 0,
          status: 'confirmed',
          paymentStatus: 'paid',
          specialRequests: 'Late check-in',
          notes: null,
          source: 'online',
          checkedInAt: null,
          checkedInBy: null,
          checkInNotes: null,
          checkedOutAt: null,
          checkedOutBy: null,
          hasDamages: false,
          checkOutNotes: null,
          cancelledAt: null,
          cancellationReason: null,
          refundAmountCents: null,
          refundAmountDollars: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        expect(() => ReservationResponseSchema.parse(validResponse)).not.toThrow()
      })

      it('should validate checked-in reservation with all check-in fields', () => {
        const checkedInResponse = {
          id: validUUID(),
          propertyId: validUUID(),
          siteId: validUUID(),
          guestId: validUUID(),
          confirmationNumber: 'RES-2025-001234',
          checkInDate: new Date().toISOString(),
          checkOutDate: futureDate(3),
          nights: 3,
          occupancy: {
            numAdults: 2,
            numChildren: 0,
            numPets: 0,
            numVehicles: 1,
            totalPeople: 2,
          },
          totalAmountCents: 15000,
          totalAmountDollars: 150.0,
          paidAmountCents: 15000,
          paidAmountDollars: 150.0,
          balanceCents: 0,
          balanceDollars: 0,
          status: 'checked_in',
          paymentStatus: 'paid',
          specialRequests: null,
          notes: null,
          source: 'online',
          checkedInAt: new Date().toISOString(),
          checkedInBy: validUUID(),
          checkInNotes: 'Arrived on time',
          checkedOutAt: null,
          checkedOutBy: null,
          hasDamages: false,
          checkOutNotes: null,
          cancelledAt: null,
          cancellationReason: null,
          refundAmountCents: null,
          refundAmountDollars: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        expect(() => ReservationResponseSchema.parse(checkedInResponse)).not.toThrow()
      })

      it('should validate cancelled reservation with cancellation fields', () => {
        const cancelledResponse = {
          id: validUUID(),
          propertyId: validUUID(),
          siteId: validUUID(),
          guestId: validUUID(),
          confirmationNumber: 'RES-2025-001234',
          checkInDate: futureDate(7),
          checkOutDate: futureDate(10),
          nights: 3,
          occupancy: {
            numAdults: 2,
            numChildren: 0,
            numPets: 0,
            numVehicles: 1,
            totalPeople: 2,
          },
          totalAmountCents: 15000,
          totalAmountDollars: 150.0,
          paidAmountCents: 15000,
          paidAmountDollars: 150.0,
          balanceCents: 0,
          balanceDollars: 0,
          status: 'cancelled',
          paymentStatus: 'refunded',
          specialRequests: null,
          notes: null,
          source: 'online',
          checkedInAt: null,
          checkedInBy: null,
          checkInNotes: null,
          checkedOutAt: null,
          checkedOutBy: null,
          hasDamages: false,
          checkOutNotes: null,
          cancelledAt: new Date().toISOString(),
          cancellationReason: 'Guest requested cancellation',
          refundAmountCents: 15000,
          refundAmountDollars: 150.0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        expect(() => ReservationResponseSchema.parse(cancelledResponse)).not.toThrow()
      })

      it('should reject response missing required id field', () => {
        const invalidResponse = {
          // id: MISSING
          propertyId: validUUID(),
          siteId: validUUID(),
          guestId: validUUID(),
          confirmationNumber: 'RES-2025-001234',
        }

        expect(() => ReservationResponseSchema.parse(invalidResponse)).toThrow()
      })

      it('should reject response missing tenant propertyId (security)', () => {
        const invalidResponse = {
          id: validUUID(),
          // propertyId: MISSING - violates tenant isolation
          siteId: validUUID(),
          guestId: validUUID(),
          confirmationNumber: 'RES-2025-001234',
        }

        expect(() => ReservationResponseSchema.parse(invalidResponse)).toThrow()
      })
    })

    describe('ReservationListResponseSchema', () => {
      it('should validate list response with reservations', () => {
        const validResponse = {
          reservations: [
            {
              id: validUUID(),
              propertyId: validUUID(),
              siteId: validUUID(),
              guestId: validUUID(),
              confirmationNumber: 'RES-2025-001',
              checkInDate: futureDate(7),
              checkOutDate: futureDate(10),
              nights: 3,
              occupancy: {
                numAdults: 2,
                numChildren: 0,
                numPets: 0,
                numVehicles: 1,
                totalPeople: 2,
              },
              totalAmountCents: 15000,
              totalAmountDollars: 150.0,
              paidAmountCents: 0,
              paidAmountDollars: 0,
              balanceCents: 15000,
              balanceDollars: 150.0,
              status: 'pending',
              paymentStatus: 'pending',
              specialRequests: null,
              notes: null,
              source: 'online',
              checkedInAt: null,
              checkedInBy: null,
              checkInNotes: null,
              checkedOutAt: null,
              checkedOutBy: null,
              hasDamages: false,
              checkOutNotes: null,
              cancelledAt: null,
              cancellationReason: null,
              refundAmountCents: null,
              refundAmountDollars: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }

        expect(() => ReservationListResponseSchema.parse(validResponse)).not.toThrow()
      })

      it('should validate empty list response', () => {
        const emptyResponse = {
          reservations: [],
          total: 0,
          limit: 50,
          offset: 0,
        }

        expect(() => ReservationListResponseSchema.parse(emptyResponse)).not.toThrow()
      })
    })

    describe('SiteAvailabilityResponseSchema', () => {
      it('should validate available site response', () => {
        const availableResponse = {
          siteId: validUUID(),
          isAvailable: true,
          conflictingReservations: [],
        }

        expect(() => SiteAvailabilityResponseSchema.parse(availableResponse)).not.toThrow()
      })

      it('should validate unavailable site with conflicts', () => {
        const unavailableResponse = {
          siteId: validUUID(),
          isAvailable: false,
          conflictingReservations: [
            {
              id: validUUID(),
              confirmationNumber: 'RES-2025-001',
              checkInDate: futureDate(5),
              checkOutDate: futureDate(8),
              status: 'confirmed',
            },
          ],
        }

        expect(() => SiteAvailabilityResponseSchema.parse(unavailableResponse)).not.toThrow()
      })
    })

    describe('ManualReservationResponseSchema', () => {
      it('should validate manual reservation response', () => {
        const validResponse = {
          id: validUUID(),
          confirmationNumber: 'RES-2025-001234',
          guestName: 'John Doe',
          checkInDate: futureDateYMD(7),
          checkOutDate: futureDateYMD(10),
          totalAmountCents: 15000,
          paidAmountCents: 15000,
          status: 'confirmed',
          paymentStatus: 'paid',
          childrenCount: 2,
          vehiclesCount: 1,
          createdAt: new Date().toISOString(),
        }

        expect(() => ManualReservationResponseSchema.parse(validResponse)).not.toThrow()
      })
    })

    describe('ExtendReservationResponseSchema', () => {
      it('should validate extension response with updated reservation', () => {
        const validResponse = {
          reservation: {
            id: validUUID(),
            propertyId: validUUID(),
            siteId: validUUID(),
            guestId: validUUID(),
            confirmationNumber: 'RES-2025-001234',
            checkInDate: futureDate(0),
            checkOutDate: futureDate(7), // Extended
            nights: 7,
            occupancy: {
              numAdults: 2,
              numChildren: 0,
              numPets: 0,
              numVehicles: 1,
              totalPeople: 2,
            },
            totalAmountCents: 35000, // Increased
            totalAmountDollars: 350.0,
            paidAmountCents: 15000,
            paidAmountDollars: 150.0,
            balanceCents: 20000,
            balanceDollars: 200.0,
            status: 'checked_in',
            paymentStatus: 'partial',
            specialRequests: null,
            notes: null,
            source: 'online',
            checkedInAt: new Date().toISOString(),
            checkedInBy: validUUID(),
            checkInNotes: null,
            checkedOutAt: null,
            checkedOutBy: null,
            hasDamages: false,
            checkOutNotes: null,
            cancelledAt: null,
            cancellationReason: null,
            refundAmountCents: null,
            refundAmountDollars: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          additionalNights: 4,
        }

        expect(() => ExtendReservationResponseSchema.parse(validResponse)).not.toThrow()
      })
    })

    describe('RenewReservationResponseSchema', () => {
      it('should validate renewal response with both reservations', () => {
        const originalReservation = {
          id: validUUID(),
          propertyId: validUUID(),
          siteId: validUUID(),
          guestId: validUUID(),
          confirmationNumber: 'RES-2025-001',
          checkInDate: futureDate(0),
          checkOutDate: futureDate(7),
          nights: 7,
          occupancy: {
            numAdults: 2,
            numChildren: 0,
            numPets: 0,
            numVehicles: 1,
            totalPeople: 2,
          },
          totalAmountCents: 35000,
          totalAmountDollars: 350.0,
          paidAmountCents: 35000,
          paidAmountDollars: 350.0,
          balanceCents: 0,
          balanceDollars: 0,
          status: 'checked_in',
          paymentStatus: 'paid',
          specialRequests: null,
          notes: null,
          source: 'online',
          checkedInAt: new Date().toISOString(),
          checkedInBy: validUUID(),
          checkInNotes: null,
          checkedOutAt: null,
          checkedOutBy: null,
          hasDamages: false,
          checkOutNotes: null,
          cancelledAt: null,
          cancellationReason: null,
          refundAmountCents: null,
          refundAmountDollars: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        const renewalReservation = {
          ...originalReservation,
          id: validUUID(),
          confirmationNumber: 'RES-2025-002',
          checkInDate: futureDate(7),
          checkOutDate: futureDate(14),
          status: 'pending',
          paymentStatus: 'pending',
          paidAmountCents: 0,
          paidAmountDollars: 0,
          balanceCents: 35000,
          balanceDollars: 350.0,
          checkedInAt: null,
          checkedInBy: null,
        }

        const validResponse = {
          originalReservation,
          renewalReservation,
          renewalNights: 7,
        }

        expect(() => RenewReservationResponseSchema.parse(validResponse)).not.toThrow()
      })
    })

    describe('PaymentLinkResponseSchema', () => {
      it('should validate payment link response', () => {
        const validResponse = {
          url: 'https://checkout.stripe.com/c/pay/cs_test_123',
          checkoutSessionId: 'cs_test_123abc',
          amountCents: 15000,
          expiresAt: futureDate(1),
        }

        expect(() => PaymentLinkResponseSchema.parse(validResponse)).not.toThrow()
      })

      it('should reject invalid URL format', () => {
        const invalidResponse = {
          url: 'not-a-url',
          checkoutSessionId: 'cs_test_123',
          amountCents: 15000,
          expiresAt: futureDate(1),
        }

        expect(() => PaymentLinkResponseSchema.parse(invalidResponse)).toThrow()
      })
    })
  })

  // ==========================================================================
  // Business Logic Validation Tests
  // ==========================================================================

  describe('Business Logic Validation', () => {
    describe('Occupancy Constraints', () => {
      it('should enforce maximum adults limit', () => {
        const invalidRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: {
            numAdults: 21, // Exceeds max of 20
          },
          totalAmountCents: 5000,
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should enforce maximum children limit', () => {
        const invalidRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: {
            numAdults: 1,
            numChildren: 21, // Exceeds max of 20
          },
          totalAmountCents: 5000,
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should enforce maximum pets limit', () => {
        const invalidRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: {
            numAdults: 1,
            numPets: 11, // Exceeds max of 10
          },
          totalAmountCents: 5000,
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should enforce maximum vehicles limit', () => {
        const invalidRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: {
            numAdults: 1,
            numVehicles: 6, // Exceeds max of 5
          },
          totalAmountCents: 5000,
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('Special Requests Length', () => {
      it('should accept special requests within limit', () => {
        const validRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: { numAdults: 1 },
          totalAmountCents: 5000,
          specialRequests: 'A'.repeat(1000), // Exactly at limit
        }

        expect(() => CreateReservationRequestSchema.parse(validRequest)).not.toThrow()
      })

      it('should reject special requests exceeding limit', () => {
        const invalidRequest = {
          siteId: validUUID(),
          guestId: validUUID(),
          checkIn: futureDate(7),
          checkOut: futureDate(10),
          occupancy: { numAdults: 1 },
          totalAmountCents: 5000,
          specialRequests: 'A'.repeat(1001), // Exceeds 1000 char limit
        }

        expect(() => CreateReservationRequestSchema.parse(invalidRequest)).toThrow()
      })
    })

    describe('Renewal Period Validation', () => {
      it('should require customNights for custom renewal period', () => {
        const invalidRequest = {
          renewalPeriod: 'custom',
          totalAmountCents: 50000,
          // Missing customNights
        }

        expect(() => RenewReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should enforce customNights minimum of 1', () => {
        const invalidRequest = {
          renewalPeriod: 'custom',
          customNights: 0,
          totalAmountCents: 50000,
        }

        expect(() => RenewReservationRequestSchema.parse(invalidRequest)).toThrow()
      })

      it('should enforce customNights maximum of 365', () => {
        const invalidRequest = {
          renewalPeriod: 'custom',
          customNights: 366,
          totalAmountCents: 50000,
        }

        expect(() => RenewReservationRequestSchema.parse(invalidRequest)).toThrow()
      })
    })
  })

  // ==========================================================================
  // Regression Tests
  // ==========================================================================

  describe('Regression Tests', () => {
    it('should reject incomplete reservation response (prevents selective field fetching)', () => {
      const incompleteResponse = {
        id: validUUID(),
        propertyId: validUUID(),
        // Missing many required fields
      }

      expect(() => ReservationResponseSchema.parse(incompleteResponse)).toThrow()
    })

    it('should ensure all monetary fields are present together', () => {
      // This test ensures we don't accidentally return cents without dollars or vice versa
      const partialMoneyResponse = {
        id: validUUID(),
        propertyId: validUUID(),
        siteId: validUUID(),
        guestId: validUUID(),
        confirmationNumber: 'RES-001',
        checkInDate: futureDate(7),
        checkOutDate: futureDate(10),
        nights: 3,
        occupancy: {
          numAdults: 1,
          numChildren: 0,
          numPets: 0,
          numVehicles: 1,
          totalPeople: 1,
        },
        totalAmountCents: 15000,
        // Missing totalAmountDollars
      }

      expect(() => ReservationResponseSchema.parse(partialMoneyResponse)).toThrow()
    })
  })
})

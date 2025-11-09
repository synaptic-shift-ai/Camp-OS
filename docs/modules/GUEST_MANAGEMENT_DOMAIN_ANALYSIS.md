# Guest Management Module - Domain Analysis

**Week 7 - Phase 3: Guest Management Module**
**Created**: 2025-11-08
**Status**: Domain Modeling in Progress

---

## Executive Summary

This document analyzes the existing Guest domain in preparation for extraction into the modular monolith architecture. The Guest module is the **third module** following Site (Weeks 3-4) and Property (Weeks 5-6).

**Complexity**: **MEDIUM** - Simpler than Booking, more complex than Site
**Risk**: **LOW** - Well-understood domain with existing tests
**Estimated Effort**: 2 weeks (20 files, ~1200 lines)

---

## Current State Analysis

### Database Schema (guests table)

Based on migrations and types analysis:

```sql
CREATE TABLE guests (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES properties(id),
  user_id UUID REFERENCES auth.users(id), -- NULL for anonymous guests

  -- Contact Information
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,

  -- Address Information
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  country TEXT,

  -- Emergency Contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,

  -- Payment Integration
  stripe_customer_id TEXT, -- Stripe Customer ID for saved cards

  -- Notes
  notes TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_guests_property_id ON guests(property_id);
CREATE INDEX idx_guests_email ON guests(property_id, email);
CREATE INDEX idx_guests_stripe_customer_id ON guests(stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
```

### Current Implementation (`lib/booking/guest.ts`)

**Functions**:
1. `createOrGetGuest()` - Create new guest or return existing by email
2. `getGuestById()` - Fetch guest by ID
3. `getGuestByEmail()` - Fetch guest by email and property

**Business Logic**:
- **Duplicate Prevention**: Email is unique per property (returns existing guest)
- **Email Normalization**: Lowercases email before storage/lookup
- **Validation**: Email format, required fields
- **Multi-tenant**: All queries scoped to property_id

**Existing Tests**: 11 integration tests covering:
- Guest creation (new and existing)
- Minimal vs. complete guest info
- Email validation
- Emergency contact handling
- Guest lookup by ID
- Error handling for missing/invalid guests

---

## Domain Model Design

### Aggregate Root: Guest

The Guest entity is an **aggregate root** representing a person who books reservations at a property.

**Key Characteristics**:
- Guests are **scoped to a property** (multi-tenant isolation)
- Guests can have **multiple reservations** over time (guest history)
- Guests may be **anonymous** (no user account) or **authenticated** (linked to user_id)
- Guest email is **unique per property** (prevents duplicates)
- Guests can have **saved payment methods** via Stripe

**Business Rules**:
1. Email must be valid format
2. Email is unique within a property (case-insensitive)
3. First name, last name, email, phone are required
4. Address information is optional
5. Emergency contact is optional but recommended
6. Stripe customer ID created on first payment
7. Guest data belongs to property (multi-tenant isolation)

---

## Value Objects

### 1. ContactInfo (Value Object)

Encapsulates contact details with validation.

```typescript
interface ContactInfoProps {
  email: string
  phone: string
  emergencyContactName?: string
  emergencyContactPhone?: string
}

class ContactInfo extends ValueObject<ContactInfoProps> {
  // Business methods
  isEmailValid(): boolean
  hasEmergencyContact(): boolean
  formatPhone(): string

  // Factory method
  static create(props: ContactInfoProps): ContactInfo
}
```

**Invariants**:
- Email must match valid email regex
- Phone is required (may be formatted)
- Emergency contact phone only valid if name also provided

---

### 2. Address (Value Object)

Encapsulates physical address (optional).

```typescript
interface AddressProps {
  street: string
  city: string
  state: string
  zipCode: string
  country: string
}

class Address extends ValueObject<AddressProps> {
  // Business methods
  isComplete(): boolean
  formatForDisplay(): string
  isSameCountry(other: Address): boolean

  // Factory method
  static create(props: Partial<AddressProps>): Address | null
}
```

**Invariants**:
- All fields required if address is provided
- Zip code format validated based on country
- State/Province validated for US/Canada

---

### 3. PersonName (Value Object)

Encapsulates first and last name.

```typescript
interface PersonNameProps {
  firstName: string
  lastName: string
}

class PersonName extends ValueObject<PersonNameProps> {
  // Business methods
  getFullName(): string // "John Doe"
  getInitials(): string // "JD"
  matches(searchTerm: string): boolean

  // Factory method
  static create(props: PersonNameProps): PersonName
}
```

**Invariants**:
- Both first and last name required
- Names cannot be empty strings
- Names trimmed of whitespace

---

## Domain Events

### 1. GuestCreated

Fired when a new guest record is created.

```typescript
interface GuestCreatedEvent extends DomainEvent {
  guestId: string
  propertyId: string
  email: string
  createdAt: Date
}
```

**Subscribers**:
- Email welcome notification (future)
- Analytics tracking (future)

---

### 2. GuestUpdated

Fired when guest information is modified.

```typescript
interface GuestUpdatedEvent extends DomainEvent {
  guestId: string
  propertyId: string
  updatedFields: string[] // Which fields changed
  updatedAt: Date
}
```

**Subscribers**:
- Audit log (future)
- Sync to external systems (future)

---

### 3. StripeCustomerLinked

Fired when Stripe Customer ID is added to guest.

```typescript
interface StripeCustomerLinkedEvent extends DomainEvent {
  guestId: string
  stripeCustomerId: string
  linkedAt: Date
}
```

**Subscribers**:
- Enable saved payment methods UI
- Sync payment history (future)

---

## Business Methods on Guest Aggregate

### Core Methods

```typescript
class Guest extends AggregateRoot {
  // Factory methods
  static create(props: CreateGuestProps): Guest
  static fromExisting(props: ExistingGuestProps): Guest

  // Business logic
  updateContactInfo(contact: ContactInfo): void
  updateAddress(address: Address | null): void
  linkStripeCustomer(customerId: string): void
  unlinkStripeCustomer(): void
  addNotes(notes: string): void

  // Queries
  hasStripeCustomer(): boolean
  hasAddress(): boolean
  hasEmergencyContact(): boolean
  getFullName(): string
  canReceivePayments(): boolean

  // Validation
  isValid(): boolean
  validateForReservation(): ValidationResult
}
```

---

## Repository Interface

```typescript
interface IGuestRepository {
  // Create/Update
  save(guest: Guest): Promise<void>

  // Queries
  findById(guestId: string): Promise<Guest | null>
  findByEmail(propertyId: string, email: string): Promise<Guest | null>
  findByPropertyId(propertyId: string, filters?: GuestFilters): Promise<Guest[]>
  findByStripeCustomerId(customerId: string): Promise<Guest | null>

  // Special operations
  exists(propertyId: string, email: string): Promise<boolean>
  count(propertyId: string, filters?: GuestFilters): Promise<number>
}

interface GuestFilters {
  hasStripeCustomer?: boolean
  hasReservations?: boolean
  createdAfter?: Date
  searchTerm?: string // Search by name or email
}
```

---

## Command Handlers (Application Layer)

### 1. CreateGuestCommand

```typescript
interface CreateGuestCommand {
  propertyId: string
  name: PersonName
  contact: ContactInfo
  address?: Address
}

class CreateGuestCommandHandler {
  async execute(command: CreateGuestCommand): Promise<Guest> {
    // 1. Check if guest already exists by email
    const existing = await repository.findByEmail(
      command.propertyId,
      command.contact.email
    )

    // 2. Return existing guest (duplicate prevention)
    if (existing) {
      return existing
    }

    // 3. Create new guest
    const guest = Guest.create({
      propertyId: command.propertyId,
      name: command.name,
      contact: command.contact,
      address: command.address
    })

    // 4. Save to repository
    await repository.save(guest)

    // 5. Publish GuestCreated event
    await eventBus.publish(guest.getDomainEvents())

    return guest
  }
}
```

---

### 2. UpdateGuestCommand

```typescript
interface UpdateGuestCommand {
  guestId: string
  name?: PersonName
  contact?: ContactInfo
  address?: Address
  notes?: string
}

class UpdateGuestCommandHandler {
  async execute(command: UpdateGuestCommand): Promise<Guest> {
    // 1. Load existing guest
    const guest = await repository.findById(command.guestId)
    if (!guest) throw new GuestNotFoundError()

    // 2. Apply updates
    if (command.name) guest.updateName(command.name)
    if (command.contact) guest.updateContactInfo(command.contact)
    if (command.address) guest.updateAddress(command.address)
    if (command.notes) guest.addNotes(command.notes)

    // 3. Save changes
    await repository.save(guest)

    // 4. Publish GuestUpdated event
    await eventBus.publish(guest.getDomainEvents())

    return guest
  }
}
```

---

### 3. LinkStripeCustomerCommand

```typescript
interface LinkStripeCustomerCommand {
  guestId: string
  stripeCustomerId: string
}

class LinkStripeCustomerCommandHandler {
  async execute(command: LinkStripeCustomerCommand): Promise<void> {
    // 1. Load guest
    const guest = await repository.findById(command.guestId)
    if (!guest) throw new GuestNotFoundError()

    // 2. Link Stripe customer
    guest.linkStripeCustomer(command.stripeCustomerId)

    // 3. Save
    await repository.save(guest)

    // 4. Publish event
    await eventBus.publish(guest.getDomainEvents())
  }
}
```

---

## Query Handlers (Application Layer)

### 1. GetGuestQuery

```typescript
interface GetGuestQuery {
  guestId: string
}

class GetGuestQueryHandler {
  async execute(query: GetGuestQuery): Promise<GuestDTO> {
    const guest = await repository.findById(query.guestId)
    if (!guest) throw new GuestNotFoundError()

    return GuestDTO.fromDomain(guest)
  }
}
```

---

### 2. ListGuestsQuery

```typescript
interface ListGuestsQuery {
  propertyId: string
  filters?: GuestFilters
  pagination?: Pagination
}

class ListGuestsQueryHandler {
  async execute(query: ListGuestsQuery): Promise<GuestDTO[]> {
    const guests = await repository.findByPropertyId(
      query.propertyId,
      query.filters
    )

    return guests.map(g => GuestDTO.fromDomain(g))
  }
}
```

---

### 3. GetGuestHistoryQuery

```typescript
interface GetGuestHistoryQuery {
  guestId: string
}

class GetGuestHistoryQueryHandler {
  async execute(query: GetGuestHistoryQuery): Promise<GuestHistoryDTO> {
    const guest = await repository.findById(query.guestId)
    if (!guest) throw new GuestNotFoundError()

    // Get reservation history (from Reservation module)
    const reservations = await reservationRepository.findByGuestId(query.guestId)

    return {
      guest: GuestDTO.fromDomain(guest),
      reservations: reservations.map(r => ReservationSummaryDTO.fromDomain(r)),
      totalStays: reservations.filter(r => r.isCompleted()).length,
      totalRevenue: reservations.reduce((sum, r) => sum + r.getTotalPaid(), 0)
    }
  }
}
```

---

## DTOs (Data Transfer Objects)

### GuestDTO

```typescript
interface GuestDTO {
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

class GuestDTO {
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
      address: guest.address ? AddressDTO.fromValueObject(guest.address) : null,
      emergencyContact: guest.contact.hasEmergencyContact()
        ? EmergencyContactDTO.fromContactInfo(guest.contact)
        : null,
      hasStripeCustomer: guest.hasStripeCustomer(),
      stripeCustomerId: guest.stripeCustomerId,
      notes: guest.notes,
      createdAt: guest.createdAt.toISOString(),
      updatedAt: guest.updatedAt.toISOString()
    }
  }
}
```

---

## Multi-Tenant Isolation

**Critical**: All guest operations MUST enforce property_id filtering.

```typescript
// ✅ CORRECT - Tenant isolated
const guest = await repository.findByEmail(propertyId, email)

// ❌ WRONG - Missing tenant context
const guest = await repository.findByEmail(email)
```

**Repository Implementation**:
- All queries include `.eq('property_id', propertyId)`
- Service role client used for repository operations
- RLS policies as defense-in-depth (not relied upon)

---

## Testing Strategy

### Domain Tests (~60 tests)

**Guest.test.ts**:
- Guest creation with valid data
- Guest creation with invalid data (validation errors)
- Email normalization (lowercase)
- Contact info updates
- Address updates
- Stripe customer linking/unlinking
- Emergency contact handling
- Domain event generation

**ContactInfo.test.ts**:
- Email validation (valid/invalid formats)
- Phone validation
- Emergency contact validation
- Value object equality

**Address.test.ts**:
- Complete vs. incomplete address
- Formatting for display
- Country validation
- Value object equality

---

### Application Tests (~70 tests)

**CreateGuestCommandHandler.test.ts**:
- Create new guest
- Return existing guest (duplicate prevention)
- Validation errors
- Event publishing

**UpdateGuestCommandHandler.test.ts**:
- Update all fields
- Partial updates
- Guest not found error
- Event publishing

**QueryHandlers.test.ts**:
- Get guest by ID
- List guests with filters
- Guest history with reservations
- Pagination

---

### Repository Tests (~30 tests)

**SupabaseGuestRepository.test.ts**:
- Save new guest
- Update existing guest
- Find by ID
- Find by email
- Find by property
- Find by Stripe customer ID
- Multi-tenant isolation
- Complete entity fetching (`.select('*')`)

**Total Estimated**: ~160 tests

---

## Migration from Legacy Code

### Files to Extract

- ✅ `lib/booking/types.ts` (Guest, CreateGuestInput) → Domain entities
- ✅ `lib/booking/guest.ts` (functions) → Application layer
- ✅ `lib/booking/guest.test.ts` → Keep as integration tests, add domain tests

### New Files to Create

```
src/modules/GuestManagement/
├── domain/
│   ├── Guest.ts                    (Aggregate root)
│   ├── ContactInfo.ts              (Value object)
│   ├── Address.ts                  (Value object)
│   ├── PersonName.ts               (Value object)
│   ├── events/
│   │   ├── GuestCreated.ts
│   │   ├── GuestUpdated.ts
│   │   └── StripeCustomerLinked.ts
│   └── __tests__/
│       ├── Guest.test.ts
│       ├── ContactInfo.test.ts
│       ├── Address.test.ts
│       └── PersonName.test.ts
├── application/
│   ├── commands/
│   │   ├── CreateGuestCommand.ts
│   │   ├── UpdateGuestCommand.ts
│   │   └── LinkStripeCustomerCommand.ts
│   ├── queries/
│   │   ├── GetGuestQuery.ts
│   │   ├── ListGuestsQuery.ts
│   │   └── GetGuestHistoryQuery.ts
│   ├── DTOs/
│   │   └── GuestDTO.ts
│   └── __tests__/
│       ├── CreateGuestCommandHandler.test.ts
│       ├── UpdateGuestCommandHandler.test.ts
│       └── QueryHandlers.test.ts
└── infrastructure/
    ├── SupabaseGuestRepository.ts
    └── __tests__/
        └── SupabaseGuestRepository.test.ts
```

**Estimated**: 22 files, ~1200 lines of code

---

## Dependencies on Other Modules

### No Dependencies (Upstream)
Guest module does NOT depend on other domain modules.

### Depended Upon By (Downstream)
- **Reservation Module**: Reservations reference guests
- **Payment Module**: Payments linked via Stripe customer ID

**Communication**: Event-driven only (no direct imports)

---

## Risks & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Email uniqueness edge cases | Medium | Add database unique constraint on (property_id, email) |
| Stripe customer orphaning | Low | Add cleanup job for orphaned customers |
| Guest PII compliance | High | Add data retention policies, GDPR compliance |
| Guest merging needed | Medium | Design guest merge command for duplicates |

---

## Success Criteria

- [x] Domain model designed with rich business logic
- [ ] All value objects implemented with validation
- [ ] Guest aggregate with 10+ business methods
- [ ] 3 command handlers (Create, Update, LinkStripe)
- [ ] 3 query handlers (Get, List, History)
- [ ] Repository with complete entity fetching
- [ ] ~160 comprehensive tests passing
- [ ] Multi-tenant isolation enforced
- [ ] Domain events published for all state changes
- [ ] No direct dependencies on other modules

---

## Next Steps (Week 7)

### Day 1-2: Domain Layer
1. Create PersonName value object + tests
2. Create ContactInfo value object + tests
3. Create Address value object + tests
4. Create Guest aggregate + tests
5. Define domain events

### Day 3: Application Layer
6. Create command handlers + tests
7. Create query handlers + tests
8. Create DTOs

### Day 4: Infrastructure Layer
9. Create SupabaseGuestRepository + tests
10. Implement all repository methods
11. Add multi-tenant isolation

### Day 5: Integration & Validation
12. Run full test suite
13. Verify no regressions in existing guest.test.ts
14. Update documentation
15. Validate against checklist

---

## Related Documentation

- [Site Management Module](../../src/modules/SiteManagement/) - Similar pattern to follow
- [Property Management Module](../../src/modules/PropertyManagement/) - Reference for value objects
- [Implementation Plan](../../IMPLEMENTATION_PLAN.md) - Week 7-8 goals
- [Shared Kernel](../../src/shared/domain/) - Base classes (Entity, AggregateRoot, ValueObject)

---

**Document Owner**: Engineering Team
**Last Updated**: 2025-11-08
**Status**: Ready for Implementation

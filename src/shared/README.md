# Shared Kernel Documentation

**Version:** 1.0
**Created:** 2025-11-05
**Status:** ✅ Phase 0, Week 1 Complete

---

## Overview

The Shared Kernel provides foundational base classes and infrastructure for implementing Domain-Driven Design (DDD) in CampOS. All modules use these shared abstractions to maintain consistency and enable event-driven communication.

---

## Architecture

```
src/shared/
├── domain/                 # Domain base classes
│   ├── Entity.ts          # Base for entities with identity
│   ├── AggregateRoot.ts   # Base for aggregates with events
│   ├── ValueObject.ts     # Base for immutable values
│   ├── DomainEvent.ts     # Base for domain events
│   └── __tests__/         # Comprehensive unit tests (61 tests passing)
│
└── infrastructure/         # Infrastructure components
    ├── eventBus/          # Event pub/sub system
    │   ├── IEventBus.ts
    │   ├── InMemoryEventBus.ts
    │   └── index.ts
    └── database/          # Database abstractions
        ├── SupabaseContext.ts
        └── index.ts
```

---

## Core Concepts

### 1. Entity

**Purpose:** Base class for objects with unique identity.

**When to use:**
- Object has a unique ID
- Equality is based on ID, not values
- Object has a lifecycle (created, updated)

**Example:**
```typescript
import { Entity } from '@/shared/domain'

class Site extends Entity<string> {
  constructor(
    id: string,
    private name: string,
    private siteNumber: string,
    createdAt?: Date,
    updatedAt?: Date
  ) {
    super(id, createdAt, updatedAt)
  }

  // Getters
  getName(): string {
    return this.name
  }

  getSiteNumber(): string {
    return this.siteNumber
  }

  // Business logic
  updateName(newName: string): void {
    if (!newName || newName.trim().length === 0) {
      throw new Error('Site name cannot be empty')
    }

    this.name = newName
    this.touch() // Updates updatedAt timestamp
  }
}

// Usage
const site1 = new Site('site-123', 'Site A', '1')
const site2 = new Site('site-123', 'Site A (renamed)', '1')

console.log(site1.equals(site2)) // true - same ID
console.log(site1.id) // 'site-123'
console.log(site1.createdAt) // Date
console.log(site1.updatedAt) // Date
```

---

### 2. AggregateRoot

**Purpose:** Base class for aggregate roots that collect domain events.

**When to use:**
- Entity is the entry point for a cluster of related objects
- Need to enforce consistency boundaries
- Need to publish domain events

**Example:**
```typescript
import { AggregateRoot } from '@/shared/domain'
import { DomainEvent } from '@/shared/domain'

// Domain Events
class ReservationCreatedEvent extends DomainEvent {
  constructor(
    public readonly reservationId: string,
    public readonly guestId: string,
    public readonly siteId: string
  ) {
    super()
  }
}

class ReservationConfirmedEvent extends DomainEvent {
  constructor(public readonly reservationId: string) {
    super()
  }
}

// Aggregate
class Reservation extends AggregateRoot<string> {
  constructor(
    id: string,
    private guestId: string,
    private siteId: string,
    private status: 'pending' | 'confirmed' | 'cancelled'
  ) {
    super(id)
  }

  // Factory method
  static create(
    id: string,
    guestId: string,
    siteId: string
  ): Reservation {
    const reservation = new Reservation(id, guestId, siteId, 'pending')

    // Record that this happened
    reservation.addDomainEvent(
      new ReservationCreatedEvent(id, guestId, siteId)
    )

    return reservation
  }

  // Business operation
  confirm(): void {
    if (this.status !== 'pending') {
      throw new Error('Can only confirm pending reservations')
    }

    this.status = 'confirmed'
    this.touch()

    // Record event
    this.addDomainEvent(new ReservationConfirmedEvent(this.id))
  }

  getStatus(): string {
    return this.status
  }
}

// Usage
const reservation = Reservation.create('res-123', 'guest-456', 'site-789')
reservation.confirm()

// Repository would do this after save:
const events = reservation.getDomainEvents()
await eventBus.publishAll(events)
reservation.clearDomainEvents()
```

---

### 3. ValueObject

**Purpose:** Base class for immutable values without identity.

**When to use:**
- Object is defined by its values, not identity
- Object should be immutable
- Equality is based on values

**Examples:**

#### Email Value Object
```typescript
import { ValueObject } from '@/shared/domain'

class Email extends ValueObject<{ value: string }> {
  private constructor(props: { value: string }) {
    super(props)
  }

  static create(email: string): Email {
    if (!this.isValid(email)) {
      throw new Error('Invalid email format')
    }
    return new Email({ value: email.toLowerCase() })
  }

  private static isValid(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  get value(): string {
    return this.props.value
  }
}

// Usage
const email1 = Email.create('TEST@example.com')
const email2 = Email.create('test@example.com')

console.log(email1.equals(email2)) // true - same value
console.log(email1.value) // 'test@example.com'
```

#### Money Value Object
```typescript
class Money extends ValueObject<{ amount: number; currency: string }> {
  private constructor(props: { amount: number; currency: string }) {
    super(props)
  }

  static create(amount: number, currency: string): Money {
    if (amount < 0) {
      throw new Error('Amount cannot be negative')
    }
    return new Money({ amount, currency })
  }

  get amount(): number {
    return this.props.amount
  }

  get currency(): string {
    return this.props.currency
  }

  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add different currencies')
    }
    return Money.create(this.amount + other.amount, this.currency)
  }
}

// Usage
const price1 = Money.create(100, 'USD')
const price2 = Money.create(50, 'USD')
const total = price1.add(price2)

console.log(total.amount) // 150
console.log(total.currency) // 'USD'
```

#### DateRange Value Object
```typescript
class DateRange extends ValueObject<{ start: Date; end: Date }> {
  private constructor(props: { start: Date; end: Date }) {
    super(props)
  }

  static create(start: Date, end: Date): DateRange {
    if (start >= end) {
      throw new Error('Start date must be before end date')
    }
    return new DateRange({ start, end })
  }

  get start(): Date {
    return this.props.start
  }

  get end(): Date {
    return this.props.end
  }

  getDurationInDays(): number {
    const diff = this.props.end.getTime() - this.props.start.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }

  overlaps(other: DateRange): boolean {
    return this.start < other.end && other.start < this.end
  }
}
```

---

### 4. DomainEvent

**Purpose:** Base class for events representing significant occurrences in the domain.

**When to use:**
- Something important happened in the domain
- Other modules need to react to this occurrence
- Need audit trail of what happened
- Event sourcing (future)

**Example:**
```typescript
import { DomainEvent } from '@/shared/domain'

class SiteCreatedEvent extends DomainEvent {
  constructor(
    public readonly siteId: string,
    public readonly propertyId: string,
    public readonly siteName: string,
    public readonly siteType: string
  ) {
    super()
  }
}

// Usage
const event = new SiteCreatedEvent(
  'site-123',
  'prop-456',
  'Site A',
  'RV'
)

console.log(event.eventId) // Unique event ID
console.log(event.eventType) // 'SiteCreatedEvent'
console.log(event.occurredAt) // Date
console.log(event.toJSON()) // Serializable object
```

---

### 5. EventBus

**Purpose:** Pub/sub system for loose coupling between modules.

**When to use:**
- Modules need to communicate
- Want to avoid direct dependencies
- Need to react to domain events

**Example:**
```typescript
import { getEventBus } from '@/shared/infrastructure/eventBus'

const eventBus = getEventBus()

// Module A: Subscribe to events
eventBus.subscribe(ReservationConfirmedEvent, async (event) => {
  console.log('Sending confirmation email for:', event.reservationId)
  await sendEmail(event.reservationId)
})

// Module B: Also subscribes (independently)
eventBus.subscribe(ReservationConfirmedEvent, async (event) => {
  console.log('Updating site availability for:', event.reservationId)
  await updateSiteStatus(event.reservationId)
})

// Module C: Publishes the event
const reservation = await createReservation(...)
reservation.confirm()

// After saving:
const events = reservation.getDomainEvents()
await eventBus.publishAll(events)
reservation.clearDomainEvents()
```

**EventBus API:**
```typescript
// Subscribe
const unsubscribe = eventBus.subscribe(EventType, handler)

// Unsubscribe
unsubscribe() // or
eventBus.unsubscribe(EventType, handler)

// Publish
await eventBus.publish(event)
await eventBus.publishAll([event1, event2, event3])

// Testing
eventBus.clearSubscribers()
eventBus.getSubscriberCount(EventType)
```

---

### 6. SupabaseContext

**Purpose:** Tenant-aware database access wrapper.

**When to use:**
- Need to query Supabase with tenant isolation
- Want automatic filtering by company_id or property_id
- Implementing repositories

**Example:**
```typescript
import { createSupabaseContext } from '@/shared/infrastructure/database'
import { createClient } from '@supabase/supabase-js'

// Create context with tenant scope
const supabaseClient = createClient(...)
const context = createSupabaseContext(supabaseClient, {
  companyId: 'company-123',
  propertyId: 'property-456'
})

// Queries are automatically filtered by tenant
const sites = await context.table('sites').select('*')
// Automatically adds: .eq('property_id', 'property-456')

// Override property scope for specific query
const allPropertySites = await context
  .table('sites')
  .forProperty('other-property-789')
  .select('*')

// Create new context with different scope
const otherContext = context.withTenant({
  propertyId: 'property-999'
})
```

---

## Testing

### Running Tests
```bash
# Run all shared kernel tests
npm test -- src/shared --run

# Run with coverage
npm test -- src/shared --run --coverage

# Watch mode
npm test -- src/shared
```

### Test Coverage
- **Entity:** 18 tests ✅
- **ValueObject:** 14 tests ✅
- **AggregateRoot:** 10 tests ✅
- **InMemoryEventBus:** 19 tests ✅
- **Total:** 61 tests passing

---

## Usage Guidelines

### DO ✅

1. **Use Entity for objects with identity**
   ```typescript
   class Site extends Entity<string> { }
   ```

2. **Use AggregateRoot for aggregate roots**
   ```typescript
   class Reservation extends AggregateRoot<string> { }
   ```

3. **Use ValueObject for immutable values**
   ```typescript
   class Email extends ValueObject<{ value: string }> { }
   ```

4. **Publish events after saving**
   ```typescript
   await repository.save(aggregate)
   await eventBus.publishAll(aggregate.getDomainEvents())
   aggregate.clearDomainEvents()
   ```

5. **Call `touch()` when state changes**
   ```typescript
   updateName(name: string): void {
     this.name = name
     this.touch() // Updates updatedAt
   }
   ```

### DON'T ❌

1. **Don't mutate value objects**
   ```typescript
   // ❌ Bad - trying to mutate
   email.props.value = 'new@example.com'

   // ✅ Good - create new instance
   const newEmail = Email.create('new@example.com')
   ```

2. **Don't skip domain events**
   ```typescript
   // ❌ Bad
   this.status = 'confirmed'

   // ✅ Good
   this.status = 'confirmed'
   this.addDomainEvent(new StatusChangedEvent(this.id))
   ```

3. **Don't create circular dependencies between modules**
   ```typescript
   // ❌ Bad - direct import from another module
   import { SiteService } from '@/modules/SiteManagement'

   // ✅ Good - use events
   eventBus.subscribe(SiteCreatedEvent, handler)
   ```

4. **Don't forget to clear events after publishing**
   ```typescript
   // ❌ Bad - events will accumulate
   await eventBus.publishAll(aggregate.getDomainEvents())

   // ✅ Good
   await eventBus.publishAll(aggregate.getDomainEvents())
   aggregate.clearDomainEvents()
   ```

---

## Next Steps

With the Shared Kernel complete, we can now:

1. **Week 2:** Implement API response utilities and database migrations
2. **Weeks 3-4:** Extract first module (Site Management) using these base classes
3. **Weeks 5+:** Scale pattern to remaining modules

---

## References

- **Domain-Driven Design:** https://martinfowler.com/tags/domain%20driven%20design.html
- **Implementation Plan:** [IMPLEMENTATION_PLAN.md](../../IMPLEMENTATION_PLAN.md)
- **Gap Analysis:** [GAP_ANALYSIS.md](../../GAP_ANALYSIS.md)

---

**Status:** ✅ **Phase 0, Week 1 Complete**
**Tests:** 61/61 passing
**Next:** Week 2 - API Standards & Database Enhancements

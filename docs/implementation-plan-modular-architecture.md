# CampOps Modular Architecture - Implementation Plan

## Gap Closure & Alignment Strategy

**Document Version:** 1.0
**Created:** November 24, 2025
**Based On:** campops-modular-architecture.pdf (Nov 4, 2025)
**Current Completion:** ~65-70%
**Target Completion:** 100% Core Modules, Foundation for Premium

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Implementation Phases Overview](#implementation-phases-overview)
3. [Phase 0: Infrastructure & Tooling](#phase-0-infrastructure--tooling)
4. [Phase 1: Complete Shared Kernel](#phase-1-complete-shared-kernel)
5. [Phase 2: Missing Core Modules](#phase-2-missing-core-modules)
6. [Phase 3: Enhance Existing Modules](#phase-3-enhance-existing-modules)
7. [Phase 4: API Consolidation](#phase-4-api-consolidation)
8. [Phase 5: Database Schema Evolution](#phase-5-database-schema-evolution)
9. [Phase 6: Testing & Quality Gates](#phase-6-testing--quality-gates)
10. [Phase 7: Premium Module Foundation](#phase-7-premium-module-foundation)
11. [Risk Mitigation](#risk-mitigation)
12. [Success Metrics](#success-metrics)

---

## Executive Summary

This implementation plan addresses all gaps identified between the design document and current codebase state. The plan is organized into 7 phases, prioritizing foundational work and missing core modules before enhancements.

### Key Priorities

1. **Create missing core modules** (CompanyManagement, StaffManagement)
2. **Consolidate booking logic** (Merge BookingEngine + ReservationManagement)
3. **Complete shared infrastructure** (Logger, event_store)
4. **Enhance existing modules** (SiteManagement value objects, domain events)
5. **Establish premium module foundation** (module_licenses, feature flags)

### Architectural Decision: Next.js vs Express

The design document assumes Express.js API server. The current codebase uses Next.js API routes.

**Decision: KEEP Next.js API Routes**

Rationale:
- Unified deployment (single Next.js app)
- Better DX with co-located routes
- SSR/RSC benefits for frontend
- Module handlers are framework-agnostic (can be called from any route)

The module structure will follow DDD patterns with handlers that can be invoked from Next.js API routes.

---

## Implementation Phases Overview

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 0: Infrastructure & Tooling (Prep)                        │
├─────────────────────────────────────────────────────────────────┤
│ Phase 1: Complete Shared Kernel                                 │
├─────────────────────────────────────────────────────────────────┤
│ Phase 2: Missing Core Modules                                   │
│  ├── 2A: CompanyManagement Module                               │
│  └── 2B: StaffManagement Module                                 │
├─────────────────────────────────────────────────────────────────┤
│ Phase 3: Enhance Existing Modules                               │
│  ├── 3A: Consolidate BookingEngine + ReservationManagement      │
│  ├── 3B: Complete SiteManagement                                │
│  ├── 3C: Enhance GuestManagement                                │
│  └── 3D: Complete Financial Module                              │
├─────────────────────────────────────────────────────────────────┤
│ Phase 4: API Consolidation                                      │
├─────────────────────────────────────────────────────────────────┤
│ Phase 5: Database Schema Evolution                              │
├─────────────────────────────────────────────────────────────────┤
│ Phase 6: Testing & Quality Gates                                │
├─────────────────────────────────────────────────────────────────┤
│ Phase 7: Premium Module Foundation                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Infrastructure & Tooling

**Goal:** Establish tooling and patterns before module work

### 0.1 Module Generator Script

Create a CLI script to scaffold new modules consistently.

```
scripts/
└── generate-module.ts
```

**Implementation:**

```typescript
// scripts/generate-module.ts
// Generates:
// - src/modules/{ModuleName}/
//   ├── domain/
//   │   ├── {Entity}.ts
//   │   ├── I{Entity}Repository.ts
//   │   ├── events/
//   │   │   └── index.ts
//   │   ├── value-objects/
//   │   └── __tests__/
//   ├── application/
//   │   ├── commands/
//   │   ├── queries/
//   │   └── DTOs/
//   ├── infrastructure/
//   │   └── Supabase{Entity}Repository.ts
//   └── index.ts (barrel export)
```

### 0.2 Module Index Pattern

Each module must have a barrel export for clean imports.

```typescript
// src/modules/{ModuleName}/index.ts
// Domain
export * from './domain/{Entity}';
export * from './domain/I{Entity}Repository';
export * from './domain/events';

// Application
export * from './application/commands';
export * from './application/queries';
export * from './application/DTOs';

// Infrastructure (only repository implementations)
export { Supabase{Entity}Repository } from './infrastructure/Supabase{Entity}Repository';
```

### 0.3 Dependency Injection Container

Create lightweight DI for handler instantiation.

```typescript
// src/shared/infrastructure/container/Container.ts
export class Container {
  private static instances: Map<string, unknown> = new Map();

  static register<T>(key: string, instance: T): void;
  static resolve<T>(key: string): T;
  static createScoped(): ScopedContainer;
}
```

### Tasks

- [ ] Create `scripts/generate-module.ts`
- [ ] Add npm script: `npm run generate:module`
- [ ] Create `src/shared/infrastructure/container/Container.ts`
- [ ] Document module creation process in `docs/creating-modules.md`

---

## Phase 1: Complete Shared Kernel

**Goal:** Fill gaps in shared infrastructure

### 1.1 Logger Infrastructure

```
src/shared/infrastructure/logging/
├── Logger.ts
├── ILogger.ts
├── ConsoleLogger.ts
└── index.ts
```

**Implementation:**

```typescript
// src/shared/infrastructure/logging/ILogger.ts
export interface ILogger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
}

// src/shared/infrastructure/logging/Logger.ts
export class Logger implements ILogger {
  constructor(
    private readonly context: string,
    private readonly tenantId?: string
  ) {}

  private formatMessage(level: string, message: string, ctx?: Record<string, unknown>): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      context: this.context,
      tenantId: this.tenantId,
      message,
      ...ctx
    });
  }

  // Implementation...
}
```

### 1.2 Event Store Table Migration

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_event_store.sql

CREATE TABLE IF NOT EXISTS public.event_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL UNIQUE,
  event_type VARCHAR(255) NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_type VARCHAR(100) NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT event_store_aggregate_version UNIQUE (aggregate_id, aggregate_type, version)
);

-- Indexes for common query patterns
CREATE INDEX idx_event_store_event_type ON public.event_store(event_type);
CREATE INDEX idx_event_store_aggregate ON public.event_store(aggregate_id, aggregate_type);
CREATE INDEX idx_event_store_company ON public.event_store(company_id);
CREATE INDEX idx_event_store_property ON public.event_store(property_id);
CREATE INDEX idx_event_store_occurred_at ON public.event_store(occurred_at DESC);

-- RLS Policies
ALTER TABLE public.event_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view events for their company"
  ON public.event_store FOR SELECT
  USING (company_id IN (
    SELECT id FROM public.companies WHERE owner_id = auth.uid()
  ));

-- Comment
COMMENT ON TABLE public.event_store IS 'Domain event store for event sourcing and audit trail';
```

### 1.3 Event Store Repository

```typescript
// src/shared/infrastructure/eventStore/EventStoreRepository.ts
export interface StoredEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  companyId: string;
  propertyId?: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  version: number;
  occurredAt: Date;
}

export interface IEventStoreRepository {
  append(event: DomainEvent, aggregateType: string, version: number): Promise<void>;
  getEvents(aggregateId: string, aggregateType: string): Promise<StoredEvent[]>;
  getEventsByType(eventType: string, since?: Date): Promise<StoredEvent[]>;
}

export class SupabaseEventStoreRepository implements IEventStoreRepository {
  constructor(private supabase: SupabaseClient) {}

  async append(event: DomainEvent, aggregateType: string, version: number): Promise<void> {
    const { error } = await this.supabase
      .from('event_store')
      .insert({
        event_id: event.eventId,
        event_type: event.eventType,
        aggregate_id: event.aggregateId,
        aggregate_type: aggregateType,
        company_id: event.companyId,
        property_id: event.propertyId,
        data: event.toJSON(),
        version,
        occurred_at: event.occurredAt
      });

    if (error) throw new Error(`Failed to store event: ${error.message}`);
  }

  // Additional methods...
}
```

### 1.4 Enhanced Event Bus with Persistence

```typescript
// src/shared/infrastructure/eventBus/PersistentEventBus.ts
export class PersistentEventBus implements IEventBus {
  constructor(
    private inMemoryBus: InMemoryEventBus,
    private eventStore: IEventStoreRepository,
    private logger: ILogger
  ) {}

  async publish<T extends DomainEvent>(event: T, aggregateType: string, version: number): Promise<void> {
    // 1. Persist event first (for durability)
    await this.eventStore.append(event, aggregateType, version);

    // 2. Then dispatch to handlers
    await this.inMemoryBus.publish(event);

    this.logger.info('Event published', {
      eventType: event.eventType,
      aggregateId: event.aggregateId
    });
  }

  subscribe<T extends DomainEvent>(
    eventType: new (...args: unknown[]) => T,
    handler: (event: T) => Promise<void>
  ): void {
    this.inMemoryBus.subscribe(eventType, handler);
  }
}
```

### Tasks

- [ ] Create `src/shared/infrastructure/logging/ILogger.ts`
- [ ] Create `src/shared/infrastructure/logging/Logger.ts`
- [ ] Create `src/shared/infrastructure/logging/ConsoleLogger.ts`
- [ ] Create migration `add_event_store.sql`
- [ ] Create `src/shared/infrastructure/eventStore/IEventStoreRepository.ts`
- [ ] Create `src/shared/infrastructure/eventStore/SupabaseEventStoreRepository.ts`
- [ ] Create `src/shared/infrastructure/eventBus/PersistentEventBus.ts`
- [ ] Update `src/shared/index.ts` barrel exports
- [ ] Write tests for Logger
- [ ] Write tests for EventStoreRepository
- [ ] Write tests for PersistentEventBus

---

## Phase 2: Missing Core Modules

### Phase 2A: CompanyManagement Module

**Priority:** HIGH - Core SaaS tenant functionality

```
src/modules/CompanyManagement/
├── domain/
│   ├── Company.ts                    # Aggregate Root
│   ├── ICompanyRepository.ts
│   ├── value-objects/
│   │   ├── CompanyName.ts
│   │   ├── SubscriptionPlan.ts
│   │   ├── SubscriptionStatus.ts
│   │   ├── BillingCycle.ts
│   │   └── OnboardingToken.ts
│   ├── events/
│   │   ├── CompanyCreatedEvent.ts
│   │   ├── CompanyUpdatedEvent.ts
│   │   ├── SubscriptionActivatedEvent.ts
│   │   ├── SubscriptionCancelledEvent.ts
│   │   ├── SubscriptionPlanChangedEvent.ts
│   │   └── InviteGeneratedEvent.ts
│   └── __tests__/
│       ├── Company.test.ts
│       └── SubscriptionPlan.test.ts
├── application/
│   ├── commands/
│   │   ├── CreateCompanyCommand.ts
│   │   ├── UpdateCompanyCommand.ts
│   │   ├── ActivateSubscriptionCommand.ts
│   │   ├── CancelSubscriptionCommand.ts
│   │   ├── ChangePlanCommand.ts
│   │   └── GenerateInviteTokenCommand.ts
│   ├── queries/
│   │   ├── GetCompanyQuery.ts
│   │   ├── GetCompanyByOwnerQuery.ts
│   │   └── GetSubscriptionStatusQuery.ts
│   └── DTOs/
│       ├── CompanyDTO.ts
│       └── SubscriptionDTO.ts
├── infrastructure/
│   ├── SupabaseCompanyRepository.ts
│   └── __tests__/
│       └── SupabaseCompanyRepository.test.ts
└── index.ts
```

**Company Aggregate Root:**

```typescript
// src/modules/CompanyManagement/domain/Company.ts
import { AggregateRoot } from '@/shared/domain/AggregateRoot';
import { CompanyName } from './value-objects/CompanyName';
import { SubscriptionPlan } from './value-objects/SubscriptionPlan';
import { SubscriptionStatus } from './value-objects/SubscriptionStatus';
import { BillingCycle } from './value-objects/BillingCycle';
import { OnboardingToken } from './value-objects/OnboardingToken';
import { CompanyCreatedEvent } from './events/CompanyCreatedEvent';
import { SubscriptionActivatedEvent } from './events/SubscriptionActivatedEvent';

export interface CompanyProps {
  id: string;
  name: CompanyName;
  ownerId: string;
  stripeCustomerId?: string;
  subscriptionId?: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  billingCycle: BillingCycle;
  onboardingToken?: OnboardingToken;
  createdAt: Date;
  updatedAt: Date;
}

export class Company extends AggregateRoot<string> {
  private _name: CompanyName;
  private _ownerId: string;
  private _stripeCustomerId?: string;
  private _subscriptionId?: string;
  private _subscriptionStatus: SubscriptionStatus;
  private _subscriptionPlan: SubscriptionPlan;
  private _billingCycle: BillingCycle;
  private _onboardingToken?: OnboardingToken;

  private constructor(props: CompanyProps) {
    super(props.id, props.createdAt, props.updatedAt);
    this._name = props.name;
    this._ownerId = props.ownerId;
    this._stripeCustomerId = props.stripeCustomerId;
    this._subscriptionId = props.subscriptionId;
    this._subscriptionStatus = props.subscriptionStatus;
    this._subscriptionPlan = props.subscriptionPlan;
    this._billingCycle = props.billingCycle;
    this._onboardingToken = props.onboardingToken;
  }

  // Factory method for creating new companies
  static create(params: {
    id: string;
    name: string;
    ownerId: string;
    plan?: SubscriptionPlan;
  }): Company {
    const company = new Company({
      id: params.id,
      name: CompanyName.create(params.name),
      ownerId: params.ownerId,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      subscriptionPlan: params.plan || SubscriptionPlan.FREE,
      billingCycle: BillingCycle.MONTHLY,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    company.addDomainEvent(
      new CompanyCreatedEvent(company.id, params.name, params.ownerId)
    );

    return company;
  }

  // Reconstitute from persistence
  static reconstitute(props: CompanyProps): Company {
    return new Company(props);
  }

  // Business logic methods
  activateSubscription(
    stripeCustomerId: string,
    subscriptionId: string,
    plan: SubscriptionPlan,
    billingCycle: BillingCycle
  ): void {
    if (this._subscriptionStatus === SubscriptionStatus.ACTIVE) {
      throw new Error('Subscription is already active');
    }

    this._stripeCustomerId = stripeCustomerId;
    this._subscriptionId = subscriptionId;
    this._subscriptionPlan = plan;
    this._billingCycle = billingCycle;
    this._subscriptionStatus = SubscriptionStatus.ACTIVE;
    this.touch();

    this.addDomainEvent(
      new SubscriptionActivatedEvent(
        this.id,
        plan.value,
        billingCycle.value,
        subscriptionId
      )
    );
  }

  cancelSubscription(reason?: string): void {
    if (this._subscriptionStatus !== SubscriptionStatus.ACTIVE) {
      throw new Error('No active subscription to cancel');
    }

    this._subscriptionStatus = SubscriptionStatus.CANCELLED;
    this.touch();

    this.addDomainEvent(
      new SubscriptionCancelledEvent(this.id, reason)
    );
  }

  generateInviteToken(): OnboardingToken {
    this._onboardingToken = OnboardingToken.generate();
    this.touch();

    this.addDomainEvent(
      new InviteGeneratedEvent(this.id, this._onboardingToken.value)
    );

    return this._onboardingToken;
  }

  canAddProperty(): boolean {
    const limits = this._subscriptionPlan.propertyLimit;
    // Would need to check current property count
    return true; // Simplified
  }

  // Getters
  get name(): CompanyName { return this._name; }
  get ownerId(): string { return this._ownerId; }
  get stripeCustomerId(): string | undefined { return this._stripeCustomerId; }
  get subscriptionId(): string | undefined { return this._subscriptionId; }
  get subscriptionStatus(): SubscriptionStatus { return this._subscriptionStatus; }
  get subscriptionPlan(): SubscriptionPlan { return this._subscriptionPlan; }
  get billingCycle(): BillingCycle { return this._billingCycle; }
  get onboardingToken(): OnboardingToken | undefined { return this._onboardingToken; }
}
```

**API Routes to Create:**

```
src/app/api/v1/companies/
├── route.ts                          # POST (create), GET (list for owner)
├── [id]/
│   ├── route.ts                      # GET, PATCH
│   ├── subscription/
│   │   └── route.ts                  # GET, POST (activate), DELETE (cancel)
│   └── invite/
│       └── route.ts                  # POST (generate invite token)
```

### Phase 2B: StaffManagement Module

**Priority:** HIGH - RBAC functionality

```
src/modules/StaffManagement/
├── domain/
│   ├── PropertyStaff.ts              # Aggregate Root
│   ├── IPropertyStaffRepository.ts
│   ├── value-objects/
│   │   ├── StaffRole.ts              # owner, manager, staff, viewer
│   │   └── Permissions.ts            # JSONB permissions wrapper
│   ├── events/
│   │   ├── StaffAddedEvent.ts
│   │   ├── StaffRemovedEvent.ts
│   │   ├── StaffRoleChangedEvent.ts
│   │   └── PermissionsUpdatedEvent.ts
│   └── __tests__/
│       ├── PropertyStaff.test.ts
│       └── Permissions.test.ts
├── application/
│   ├── commands/
│   │   ├── AddStaffMemberCommand.ts
│   │   ├── RemoveStaffMemberCommand.ts
│   │   ├── ChangeStaffRoleCommand.ts
│   │   └── UpdatePermissionsCommand.ts
│   ├── queries/
│   │   ├── GetPropertyStaffQuery.ts
│   │   ├── GetStaffMemberQuery.ts
│   │   └── CheckPermissionQuery.ts
│   └── DTOs/
│       └── PropertyStaffDTO.ts
├── infrastructure/
│   ├── SupabasePropertyStaffRepository.ts
│   └── __tests__/
│       └── SupabasePropertyStaffRepository.test.ts
└── index.ts
```

**Permissions Value Object:**

```typescript
// src/modules/StaffManagement/domain/value-objects/Permissions.ts
export type PermissionKey =
  | 'reservations:read'
  | 'reservations:create'
  | 'reservations:update'
  | 'reservations:delete'
  | 'guests:read'
  | 'guests:create'
  | 'guests:update'
  | 'sites:read'
  | 'sites:update'
  | 'financial:read'
  | 'financial:manage'
  | 'staff:read'
  | 'staff:manage'
  | 'settings:read'
  | 'settings:manage';

export class Permissions {
  private constructor(private readonly _permissions: Set<PermissionKey>) {}

  static create(permissions: PermissionKey[]): Permissions {
    return new Permissions(new Set(permissions));
  }

  static fromRole(role: StaffRole): Permissions {
    switch (role.value) {
      case 'owner':
        return Permissions.all();
      case 'manager':
        return Permissions.create([
          'reservations:read', 'reservations:create', 'reservations:update',
          'guests:read', 'guests:create', 'guests:update',
          'sites:read', 'sites:update',
          'financial:read',
          'staff:read',
          'settings:read'
        ]);
      case 'staff':
        return Permissions.create([
          'reservations:read', 'reservations:create', 'reservations:update',
          'guests:read', 'guests:create',
          'sites:read'
        ]);
      case 'viewer':
        return Permissions.create([
          'reservations:read',
          'guests:read',
          'sites:read'
        ]);
    }
  }

  static all(): Permissions {
    return Permissions.create([
      'reservations:read', 'reservations:create', 'reservations:update', 'reservations:delete',
      'guests:read', 'guests:create', 'guests:update',
      'sites:read', 'sites:update',
      'financial:read', 'financial:manage',
      'staff:read', 'staff:manage',
      'settings:read', 'settings:manage'
    ]);
  }

  has(permission: PermissionKey): boolean {
    return this._permissions.has(permission);
  }

  hasAny(permissions: PermissionKey[]): boolean {
    return permissions.some(p => this._permissions.has(p));
  }

  hasAll(permissions: PermissionKey[]): boolean {
    return permissions.every(p => this._permissions.has(p));
  }

  toArray(): PermissionKey[] {
    return Array.from(this._permissions);
  }

  toJSON(): Record<PermissionKey, boolean> {
    const result: Partial<Record<PermissionKey, boolean>> = {};
    for (const p of this._permissions) {
      result[p] = true;
    }
    return result as Record<PermissionKey, boolean>;
  }
}
```

**API Routes to Create:**

```
src/app/api/v1/properties/[propertyId]/staff/
├── route.ts                          # GET (list), POST (add)
├── [staffId]/
│   ├── route.ts                      # GET, PATCH, DELETE
│   └── permissions/
│       └── route.ts                  # GET, PUT
```

### Tasks for Phase 2

**CompanyManagement:**
- [ ] Create `src/modules/CompanyManagement/` directory structure
- [ ] Implement `Company.ts` aggregate root
- [ ] Implement value objects: CompanyName, SubscriptionPlan, SubscriptionStatus, BillingCycle, OnboardingToken
- [ ] Implement domain events (6 events)
- [ ] Implement `ICompanyRepository.ts`
- [ ] Implement commands (6 commands)
- [ ] Implement queries (3 queries)
- [ ] Implement DTOs
- [ ] Implement `SupabaseCompanyRepository.ts`
- [ ] Create API routes under `/api/v1/companies/`
- [ ] Write unit tests for Company aggregate
- [ ] Write integration tests for repository
- [ ] Write API route tests

**StaffManagement:**
- [ ] Create `src/modules/StaffManagement/` directory structure
- [ ] Implement `PropertyStaff.ts` aggregate root
- [ ] Implement value objects: StaffRole, Permissions
- [ ] Implement domain events (4 events)
- [ ] Implement `IPropertyStaffRepository.ts`
- [ ] Implement commands (4 commands)
- [ ] Implement queries (3 queries)
- [ ] Implement DTOs
- [ ] Implement `SupabasePropertyStaffRepository.ts`
- [ ] Create API routes under `/api/v1/properties/[propertyId]/staff/`
- [ ] Write unit tests for PropertyStaff aggregate
- [ ] Write integration tests for repository
- [ ] Create permission-checking middleware

---

## Phase 3: Enhance Existing Modules

### Phase 3A: Consolidate BookingEngine + ReservationManagement

**Goal:** Merge into single cohesive BookingEngine module per design doc

**Current State:**
- `src/modules/BookingEngine/` - Has Reservation, availability queries
- `src/modules/ReservationManagement/` - Has events, value objects, tests

**Target State:**
```
src/modules/BookingEngine/
├── domain/
│   ├── aggregates/
│   │   ├── Reservation.ts            # Primary aggregate root
│   │   └── ReservationExtension.ts   # Extension entity
│   ├── value-objects/
│   │   ├── DateRange.ts              # From ReservationManagement
│   │   ├── GuestCount.ts             # From ReservationManagement
│   │   ├── ReservationPricing.ts     # From ReservationManagement
│   │   ├── MoneyAmount.ts            # Already exists
│   │   ├── OccupancyInfo.ts          # Already exists
│   │   ├── BookingType.ts            # nightly, weekly, monthly, seasonal
│   │   ├── ReservationStatus.ts      # pending, confirmed, checked_in, etc.
│   │   ├── PaymentStatus.ts          # unpaid, partial, paid, refunded
│   │   └── ConfirmationNumber.ts
│   ├── services/
│   │   ├── AvailabilityService.ts    # Domain service for availability
│   │   └── PricingCalculator.ts      # Domain service for pricing
│   ├── repositories/
│   │   └── IReservationRepository.ts
│   ├── events/
│   │   ├── ReservationCreatedEvent.ts
│   │   ├── ReservationConfirmedEvent.ts
│   │   ├── ReservationExtendedEvent.ts
│   │   ├── ReservationRenewedEvent.ts
│   │   ├── ReservationModifiedEvent.ts
│   │   ├── ReservationCancelledEvent.ts
│   │   ├── GuestCheckedInEvent.ts
│   │   ├── GuestCheckedOutEvent.ts
│   │   ├── PaymentRecordedEvent.ts
│   │   └── RefundIssuedEvent.ts
│   └── __tests__/
├── application/
│   ├── commands/
│   │   ├── CreateReservationCommand.ts
│   │   ├── ConfirmReservationCommand.ts  # Already exists
│   │   ├── ExtendReservationCommand.ts
│   │   ├── RenewReservationCommand.ts
│   │   ├── ModifyReservationCommand.ts
│   │   ├── CancelReservationCommand.ts
│   │   ├── CheckInGuestCommand.ts
│   │   └── CheckOutGuestCommand.ts
│   ├── queries/
│   │   ├── GetReservationQuery.ts        # Already exists
│   │   ├── ListReservationsQuery.ts
│   │   ├── CheckSiteAvailabilityQuery.ts # Already exists
│   │   ├── GetPropertyAvailabilityQuery.ts
│   │   └── GetUpcomingCheckInsQuery.ts
│   └── DTOs/
│       ├── ReservationDTO.ts             # Already exists
│       └── AvailabilityDTO.ts
├── infrastructure/
│   ├── SupabaseReservationRepository.ts
│   └── __tests__/
└── index.ts
```

**Migration Steps:**

1. Move all `ReservationManagement` content into `BookingEngine`:
   ```bash
   # Conceptually:
   # ReservationManagement/domain/value-objects/* → BookingEngine/domain/value-objects/
   # ReservationManagement/domain/events/* → BookingEngine/domain/events/
   # ReservationManagement/domain/__tests__/* → BookingEngine/domain/__tests__/
   ```

2. Update all imports referencing `ReservationManagement`

3. Delete `src/modules/ReservationManagement/` directory

4. Add missing domain services (AvailabilityService, PricingCalculator)

5. Add missing commands (Extend, Renew, Modify, CheckIn, CheckOut)

### Phase 3B: Complete SiteManagement

**Missing Components:**

```
src/modules/SiteManagement/domain/value-objects/
├── Hookup.ts                 # MISSING - water, electric, sewer
├── Amenity.ts                # MISSING - site-specific amenities
├── Coordinates.ts            # MISSING - lat/lng for map
├── PetPolicy.ts              # MISSING - pet rules
└── AccessibilityFeatures.ts  # MISSING - ADA compliance
```

**Hookup Value Object:**

```typescript
// src/modules/SiteManagement/domain/value-objects/Hookup.ts
export type HookupType = 'water' | 'electric_30amp' | 'electric_50amp' | 'sewer' | 'wifi';

export class Hookup {
  private constructor(
    private readonly _types: Set<HookupType>
  ) {}

  static create(types: HookupType[]): Hookup {
    return new Hookup(new Set(types));
  }

  static none(): Hookup {
    return new Hookup(new Set());
  }

  static fullHookup(): Hookup {
    return Hookup.create(['water', 'electric_50amp', 'sewer']);
  }

  has(type: HookupType): boolean {
    return this._types.has(type);
  }

  hasWater(): boolean { return this._types.has('water'); }
  hasElectric(): boolean {
    return this._types.has('electric_30amp') || this._types.has('electric_50amp');
  }
  hasSewer(): boolean { return this._types.has('sewer'); }

  get isFullHookup(): boolean {
    return this.hasWater() && this.hasElectric() && this.hasSewer();
  }

  toArray(): HookupType[] {
    return Array.from(this._types);
  }

  equals(other: Hookup): boolean {
    if (this._types.size !== other._types.size) return false;
    for (const type of this._types) {
      if (!other._types.has(type)) return false;
    }
    return true;
  }
}
```

**Site Entity Enhancements:**

```typescript
// Add to Site.ts
export class Site extends AggregateRoot<string> {
  // Existing properties...
  private _hookups: Hookup;
  private _amenities: Amenity[];
  private _coordinates?: Coordinates;
  private _petPolicy: PetPolicy;
  private _accessibilityFeatures: AccessibilityFeatures;

  // Business logic methods to add:

  markAsReserved(): void {
    if (this._status.equals(SiteStatus.MAINTENANCE)) {
      throw new Error('Cannot reserve site under maintenance');
    }
    if (this._status.equals(SiteStatus.OCCUPIED)) {
      throw new Error('Site is already occupied');
    }
    this._status = SiteStatus.RESERVED;
    this.touch();
    this.addDomainEvent(new SiteStatusChangedEvent(this.id, 'reserved'));
  }

  markAsOccupied(): void {
    if (!this._status.equals(SiteStatus.RESERVED)) {
      throw new Error('Site must be reserved before occupancy');
    }
    this._status = SiteStatus.OCCUPIED;
    this.touch();
    this.addDomainEvent(new SiteStatusChangedEvent(this.id, 'occupied'));
  }

  release(): void {
    this._status = SiteStatus.AVAILABLE;
    this.touch();
    this.addDomainEvent(new SiteStatusChangedEvent(this.id, 'available'));
  }

  putUnderMaintenance(reason: string): void {
    if (this._status.equals(SiteStatus.OCCUPIED)) {
      throw new Error('Cannot put occupied site under maintenance');
    }
    this._status = SiteStatus.MAINTENANCE;
    this.touch();
    this.addDomainEvent(new SiteMaintenanceStartedEvent(this.id, reason));
  }

  updatePricing(newPricing: Pricing): void {
    const oldPricing = this._pricing;
    this._pricing = newPricing;
    this.touch();
    this.addDomainEvent(new SitePricingUpdatedEvent(
      this.id,
      oldPricing.toJSON(),
      newPricing.toJSON()
    ));
  }

  canAccommodate(occupancy: OccupancyInfo): boolean {
    return occupancy.totalGuests <= this._maxOccupancy &&
           occupancy.vehicles <= this._maxVehicles &&
           (occupancy.pets === 0 || this._petPolicy.allowsPets);
  }
}
```

### Phase 3C: Enhance GuestManagement

**Missing Value Objects:**

```typescript
// src/modules/GuestManagement/domain/value-objects/EmergencyContact.ts
export class EmergencyContact {
  private constructor(
    private readonly _name: string,
    private readonly _relationship: string,
    private readonly _phone: string
  ) {}

  static create(name: string, relationship: string, phone: string): EmergencyContact {
    if (!name || name.trim().length < 2) {
      throw new Error('Emergency contact name is required');
    }
    if (!phone || phone.trim().length < 10) {
      throw new Error('Emergency contact phone is required');
    }
    return new EmergencyContact(name.trim(), relationship.trim(), phone.trim());
  }

  get name(): string { return this._name; }
  get relationship(): string { return this._relationship; }
  get phone(): string { return this._phone; }

  equals(other: EmergencyContact): boolean {
    return this._name === other._name &&
           this._relationship === other._relationship &&
           this._phone === other._phone;
  }

  toJSON(): { name: string; relationship: string; phone: string } {
    return {
      name: this._name,
      relationship: this._relationship,
      phone: this._phone
    };
  }
}
```

**Missing Events:**

```typescript
// src/modules/GuestManagement/domain/events/GuestUpdatedEvent.ts
export class GuestUpdatedEvent extends DomainEvent {
  constructor(
    companyId: string,
    propertyId: string,
    public readonly guestId: string,
    public readonly changes: Record<string, { old: unknown; new: unknown }>
  ) {
    super(companyId, propertyId, guestId);
  }

  get eventType(): string {
    return 'GuestManagement.GuestUpdated';
  }
}
```

### Phase 3D: Complete Financial Module

**Current State:** Well-implemented with Invoice, PaymentPlan, SecurityDeposit, Transaction aggregates.

**Gaps to Address:**

1. **Missing Stripe Integration in Module:**
   - Create `src/modules/Financial/infrastructure/stripe/`
   - Move Stripe logic from `src/lib/stripe/` or create adapters

2. **Add Financial Reporting Domain Service:**

```typescript
// src/modules/Financial/domain/services/FinancialReportingService.ts
export interface RevenueReport {
  period: { start: Date; end: Date };
  totalRevenue: MoneyAmount;
  totalRefunds: MoneyAmount;
  netRevenue: MoneyAmount;
  byPaymentMethod: Record<string, MoneyAmount>;
  transactionCount: number;
}

export class FinancialReportingService {
  constructor(
    private transactionRepository: ITransactionRepository,
    private invoiceRepository: IInvoiceRepository
  ) {}

  async generateRevenueReport(
    propertyId: string,
    startDate: Date,
    endDate: Date
  ): Promise<RevenueReport> {
    // Implementation
  }

  async getOutstandingBalance(reservationId: string): Promise<MoneyAmount> {
    // Implementation
  }
}
```

3. **Event Subscriptions:**

```typescript
// src/modules/Financial/application/eventHandlers/ReservationEventHandlers.ts
export class ReservationEventHandlers {
  constructor(
    private invoiceGenerator: GenerateInvoiceCommandHandler,
    private eventBus: IEventBus
  ) {
    // Subscribe to booking events
    this.eventBus.subscribe(ReservationCreatedEvent, this.onReservationCreated.bind(this));
    this.eventBus.subscribe(ReservationExtendedEvent, this.onReservationExtended.bind(this));
  }

  async onReservationCreated(event: ReservationCreatedEvent): Promise<void> {
    // Generate initial invoice
    await this.invoiceGenerator.execute(new GenerateInvoiceCommand(
      event.reservationId,
      event.totalAmount
    ));
  }

  async onReservationExtended(event: ReservationExtendedEvent): Promise<void> {
    // Add charges for extension
    // ...
  }
}
```

### Tasks for Phase 3

**3A - BookingEngine Consolidation:**
- [ ] Create new folder structure under BookingEngine
- [ ] Move ReservationManagement value objects to BookingEngine
- [ ] Move ReservationManagement events to BookingEngine
- [ ] Update all imports across codebase
- [ ] Delete ReservationManagement module
- [ ] Create AvailabilityService domain service
- [ ] Create PricingCalculator domain service
- [ ] Add ExtendReservationCommand
- [ ] Add RenewReservationCommand
- [ ] Add ModifyReservationCommand
- [ ] Add CheckInGuestCommand
- [ ] Add CheckOutGuestCommand
- [ ] Update/create API routes for new commands
- [ ] Write tests for all new commands

**3B - SiteManagement:**
- [ ] Create Hookup value object
- [ ] Create Amenity value object
- [ ] Create Coordinates value object
- [ ] Create PetPolicy value object
- [ ] Create AccessibilityFeatures value object
- [ ] Add business logic methods to Site entity
- [ ] Add SiteMaintenanceStartedEvent
- [ ] Update SupabaseSiteRepository for new fields
- [ ] Write tests for new value objects
- [ ] Write tests for Site business methods

**3C - GuestManagement:**
- [ ] Create EmergencyContact value object
- [ ] Create GuestUpdatedEvent
- [ ] Update Guest aggregate to use EmergencyContact
- [ ] Update repository and DTO

**3D - Financial Module:**
- [ ] Create Stripe adapter in infrastructure
- [ ] Create FinancialReportingService
- [ ] Create event handlers for reservation events
- [ ] Add API endpoint for financial summary

---

## Phase 4: API Consolidation

**Goal:** Ensure all API endpoints from design doc exist and are properly integrated with module handlers

### API Endpoint Checklist

#### Companies API
| Endpoint | Method | Status | Action |
|----------|--------|--------|--------|
| `/v1/companies` | POST | Missing | Create |
| `/v1/companies/:id` | GET | Missing | Create |
| `/v1/companies/:id` | PATCH | Missing | Create |
| `/v1/companies/:id/subscription` | GET | Missing | Create |
| `/v1/companies/:id/subscription` | POST | Missing | Create |
| `/v1/companies/:id/invite` | POST | Missing | Create |

#### Properties API
| Endpoint | Method | Status | Action |
|----------|--------|--------|--------|
| `/v1/properties` | POST | ✅ Exists | Verify |
| `/v1/properties/:id` | GET | ✅ Exists | Verify |
| `/v1/properties/:id` | PATCH | ✅ Exists | Verify |
| `/v1/properties/:id/settings` | GET | Missing | Create |
| `/v1/properties/:id/settings` | PATCH | Missing | Create |
| `/v1/properties/:id/connect-stripe` | POST | ✅ Exists | Verify |

#### Sites API
| Endpoint | Method | Status | Action |
|----------|--------|--------|--------|
| `/v1/properties/:propertyId/sites` | POST | ✅ Exists | Verify |
| `/v1/properties/:propertyId/sites` | GET | ✅ Exists | Verify |
| `/v1/properties/:propertyId/sites/:id` | GET | ✅ Exists | Verify |
| `/v1/properties/:propertyId/sites/:id` | PATCH | ✅ Exists | Verify |
| `/v1/properties/:propertyId/sites/:id` | DELETE | ❓ Check | Verify/Create |
| `/v1/properties/:propertyId/sites/available` | GET | ✅ Exists | Verify |

#### Guests API
| Endpoint | Method | Status | Action |
|----------|--------|--------|--------|
| `/v1/guests` | POST | Missing | Create |
| `/v1/guests/:id` | GET | ✅ Exists | Verify |
| `/v1/guests/:id` | PATCH | ✅ Exists | Verify |
| `/v1/guests?propertyId=:propertyId` | GET | ✅ Exists | Verify |
| `/v1/guests/:id/reservations` | GET | Missing | Create |

#### Reservations API
| Endpoint | Method | Status | Action |
|----------|--------|--------|--------|
| `/v1/reservations` | POST | Missing | Create |
| `/v1/reservations/:id` | GET | ✅ Exists | Verify |
| `/v1/reservations/:id` | PATCH | ✅ Exists | Verify |
| `/v1/reservations/:id/extend` | POST | Missing | Create |
| `/v1/reservations/:id/renew` | POST | Missing | Create |
| `/v1/reservations/:id/check-in` | POST | ✅ Exists | Verify |
| `/v1/reservations/:id/check-out` | POST | ✅ Exists | Verify |
| `/v1/reservations/:id/cancel` | POST | ✅ Exists | Verify |
| `/v1/properties/:propertyId/availability` | GET | ✅ Exists | Verify |

#### Financial API
| Endpoint | Method | Status | Action |
|----------|--------|--------|--------|
| `/v1/payments` | POST | Missing | Create |
| `/v1/payments/:id` | GET | Missing | Create |
| `/v1/payments/:id/refund` | POST | Missing | Create |
| `/v1/reservations/:id/payments` | GET | ✅ Exists | Verify |
| `/v1/reservations/:id/installments` | POST | Missing | Create |
| `/v1/reservations/:id/installments` | GET | Missing | Create |
| `/v1/installments/:id/mark-paid` | PATCH | Missing | Create |
| `/v1/properties/:propertyId/financial-summary` | GET | Missing | Create |

#### Staff API (New)
| Endpoint | Method | Status | Action |
|----------|--------|--------|--------|
| `/v1/properties/:propertyId/staff` | GET | Missing | Create |
| `/v1/properties/:propertyId/staff` | POST | Missing | Create |
| `/v1/properties/:propertyId/staff/:staffId` | GET | Missing | Create |
| `/v1/properties/:propertyId/staff/:staffId` | PATCH | Missing | Create |
| `/v1/properties/:propertyId/staff/:staffId` | DELETE | Missing | Create |

### API Route Template

```typescript
// src/app/api/v1/{resource}/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { Container } from '@/shared/infrastructure/container';
import { CreateXCommand, CreateXCommandHandler } from '@/modules/X';
import { apiResponse, apiError } from '@/lib/api/response';
import { validateRequest } from '@/lib/api/validate';
import { xSchema } from '@/types/api/v1/schemas/x';

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient();

    // 1. Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return apiError('Unauthorized', 401);
    }

    // 2. Parse and validate body
    const body = await req.json();
    const validation = validateRequest(xSchema, body);
    if (!validation.success) {
      return apiError(validation.error, 400);
    }

    // 3. Get handler from container
    const handler = Container.resolve<CreateXCommandHandler>('CreateXCommandHandler');

    // 4. Execute command
    const command = new CreateXCommand(validation.data);
    const result = await handler.execute(command);

    // 5. Return response
    return apiResponse(result, 201);
  } catch (error) {
    console.error('API Error:', error);
    return apiError('Internal server error', 500);
  }
}
```

### Tasks for Phase 4

- [ ] Create all missing Companies API routes
- [ ] Create missing Properties settings routes
- [ ] Create missing Guests routes
- [ ] Create missing Reservations routes (extend, renew)
- [ ] Create missing Payments API routes
- [ ] Create missing Installments API routes
- [ ] Create all Staff API routes
- [ ] Create financial-summary endpoint
- [ ] Update all existing routes to use Container/handlers
- [ ] Add OpenAPI/Swagger documentation
- [ ] Create API integration tests for all endpoints

---

## Phase 5: Database Schema Evolution

### 5.1 Event Store Table (from Phase 1)
Already covered in Phase 1.

### 5.2 Module Licenses Table

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_add_module_licenses.sql

CREATE TABLE IF NOT EXISTS public.module_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  module_name VARCHAR(100) NOT NULL,
  enabled BOOLEAN DEFAULT false,
  trial_ends_at TIMESTAMP WITH TIME ZONE,
  subscription_starts_at TIMESTAMP WITH TIME ZONE,
  subscription_ends_at TIMESTAMP WITH TIME ZONE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  UNIQUE(company_id, module_name),

  CONSTRAINT valid_module_name CHECK (module_name IN (
    'core',
    'dynamic_pricing',
    'guest_communications',
    'channel_management',
    'advanced_analytics',
    'maintenance_management',
    'review_system'
  ))
);

-- Indexes
CREATE INDEX idx_module_licenses_company ON public.module_licenses(company_id);
CREATE INDEX idx_module_licenses_module ON public.module_licenses(module_name);

-- RLS
ALTER TABLE public.module_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's licenses"
  ON public.module_licenses FOR SELECT
  USING (company_id IN (
    SELECT id FROM public.companies WHERE owner_id = auth.uid()
  ));

-- Trigger for updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.module_licenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Comment
COMMENT ON TABLE public.module_licenses IS 'Premium module licensing for SaaS feature gating';
```

### 5.3 Subscription Events Table Enhancement

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_enhance_subscription_events.sql

-- Check if subscription_events exists, create if not
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL,
  stripe_event_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  old_plan VARCHAR(50),
  new_plan VARCHAR(50),
  old_status VARCHAR(50),
  new_status VARCHAR(50),
  amount_cents INTEGER,
  currency VARCHAR(3) DEFAULT 'USD',
  metadata JSONB DEFAULT '{}',
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

  CONSTRAINT valid_event_type CHECK (event_type IN (
    'subscription.created',
    'subscription.updated',
    'subscription.deleted',
    'subscription.trial_will_end',
    'invoice.paid',
    'invoice.payment_failed',
    'customer.subscription.paused',
    'customer.subscription.resumed'
  ))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscription_events_company
  ON public.subscription_events(company_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_stripe_event
  ON public.subscription_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_occurred
  ON public.subscription_events(occurred_at DESC);

-- RLS
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their company's subscription events"
  ON public.subscription_events FOR SELECT
  USING (company_id IN (
    SELECT id FROM public.companies WHERE owner_id = auth.uid()
  ));
```

### Tasks for Phase 5

- [ ] Create migration for event_store table (Phase 1)
- [ ] Create migration for module_licenses table
- [ ] Create/enhance subscription_events table
- [ ] Run migrations in development
- [ ] Verify RLS policies work correctly
- [ ] Update Supabase types (`npm run db:types`)
- [ ] Test migrations in staging
- [ ] Deploy to production

---

## Phase 6: Testing & Quality Gates

### 6.1 Test Coverage Requirements

| Layer | Target Coverage | Current Est. |
|-------|----------------|--------------|
| Domain Entities/Aggregates | 90% | ~70% |
| Value Objects | 95% | ~60% |
| Command Handlers | 85% | ~50% |
| Query Handlers | 80% | ~50% |
| Repositories | 80% | ~40% |
| API Routes | 75% | ~30% |
| E2E Critical Paths | 100% | ~20% |

### 6.2 Test Structure

```
tests/
├── unit/
│   └── modules/
│       ├── CompanyManagement/
│       │   ├── domain/
│       │   │   ├── Company.test.ts
│       │   │   └── value-objects/
│       │   └── application/
│       │       ├── commands/
│       │       └── queries/
│       ├── StaffManagement/
│       ├── BookingEngine/
│       └── ...
├── integration/
│   └── modules/
│       ├── CompanyManagement/
│       │   └── SupabaseCompanyRepository.test.ts
│       └── ...
├── api/
│   └── v1/
│       ├── companies.test.ts
│       ├── properties.test.ts
│       ├── reservations.test.ts
│       └── ...
├── e2e/
│   ├── booking-flow.spec.ts
│   ├── onboarding-wizard.spec.ts
│   ├── check-in-check-out.spec.ts
│   ├── payment-flow.spec.ts
│   └── staff-management.spec.ts
└── security/
    ├── tenant-isolation.test.ts
    ├── rls-policies.test.ts
    └── permission-checks.test.ts
```

### 6.3 E2E Critical Paths

1. **Complete Booking Flow:**
   - Guest searches availability
   - Guest creates reservation
   - Payment processed
   - Confirmation sent
   - Guest checks in
   - Guest checks out

2. **Onboarding Wizard:**
   - Company creation
   - Property setup
   - Site creation
   - Stripe Connect
   - First booking page live

3. **Reservation Lifecycle:**
   - Create → Confirm → Check-in → Extend → Check-out
   - Create → Cancel → Refund

4. **Staff Management:**
   - Add staff member
   - Assign role
   - Verify permissions
   - Remove staff

### 6.4 Quality Gates

Before merging to main:

```yaml
# .github/workflows/quality-gate.yml
quality_checks:
  - name: TypeScript Compilation
    command: npm run type-check
    required: true

  - name: Linting
    command: npm run lint
    required: true

  - name: Unit Tests
    command: npm run test:unit
    coverage_threshold: 80%
    required: true

  - name: Integration Tests
    command: npm run test:integration
    required: true

  - name: E2E Tests (Critical)
    command: npm run test:e2e:critical
    required: true

  - name: Security Tests
    command: npm run test:security
    required: true
```

### Tasks for Phase 6

- [ ] Create test file structure as specified
- [ ] Write unit tests for CompanyManagement domain (90% coverage)
- [ ] Write unit tests for StaffManagement domain (90% coverage)
- [ ] Write unit tests for BookingEngine consolidation
- [ ] Write integration tests for new repositories
- [ ] Write API tests for all new endpoints
- [ ] Create E2E test: Complete Booking Flow
- [ ] Create E2E test: Onboarding Wizard
- [ ] Create E2E test: Reservation Lifecycle
- [ ] Create E2E test: Staff Management
- [ ] Create security tests for tenant isolation
- [ ] Create security tests for RLS policies
- [ ] Set up GitHub Actions quality gate workflow
- [ ] Configure coverage thresholds

---

## Phase 7: Premium Module Foundation

**Goal:** Establish foundation for premium features without full implementation

### 7.1 Feature Flag System

```typescript
// src/shared/infrastructure/features/FeatureFlags.ts
export type PremiumModule =
  | 'dynamic_pricing'
  | 'guest_communications'
  | 'channel_management'
  | 'advanced_analytics'
  | 'maintenance_management'
  | 'review_system';

export interface IFeatureFlagService {
  isEnabled(companyId: string, module: PremiumModule): Promise<boolean>;
  getEnabledModules(companyId: string): Promise<PremiumModule[]>;
  enableModule(companyId: string, module: PremiumModule, options?: EnableOptions): Promise<void>;
  disableModule(companyId: string, module: PremiumModule): Promise<void>;
}

export class SupabaseFeatureFlagService implements IFeatureFlagService {
  constructor(private supabase: SupabaseClient) {}

  async isEnabled(companyId: string, module: PremiumModule): Promise<boolean> {
    const { data } = await this.supabase
      .from('module_licenses')
      .select('enabled, trial_ends_at, subscription_ends_at')
      .eq('company_id', companyId)
      .eq('module_name', module)
      .single();

    if (!data) return false;
    if (!data.enabled) return false;

    // Check if in valid trial
    if (data.trial_ends_at && new Date(data.trial_ends_at) > new Date()) {
      return true;
    }

    // Check if subscription active
    if (data.subscription_ends_at && new Date(data.subscription_ends_at) > new Date()) {
      return true;
    }

    return false;
  }

  // ... other methods
}
```

### 7.2 Premium Module Stubs

Create stub module structures that can be implemented later:

```
src/modules/
├── DynamicPricing/           # Premium
│   ├── domain/
│   │   └── .gitkeep
│   ├── application/
│   │   └── .gitkeep
│   └── README.md             # Module spec/requirements
├── GuestCommunications/      # Premium
│   ├── domain/
│   │   └── .gitkeep
│   ├── application/
│   │   └── .gitkeep
│   └── README.md
├── ChannelManagement/        # Premium
│   └── README.md
├── AdvancedAnalytics/        # Premium
│   └── README.md
├── MaintenanceManagement/    # Premium
│   └── README.md
└── ReviewSystem/             # Premium
    └── README.md
```

### 7.3 API Guard Middleware

```typescript
// src/lib/middleware/premiumGuard.ts
import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/shared/infrastructure/container';
import { IFeatureFlagService, PremiumModule } from '@/shared/infrastructure/features';

export function requirePremiumModule(module: PremiumModule) {
  return async function premiumGuard(
    req: NextRequest,
    context: { companyId: string }
  ): Promise<NextResponse | null> {
    const featureService = Container.resolve<IFeatureFlagService>('FeatureFlagService');

    const isEnabled = await featureService.isEnabled(context.companyId, module);

    if (!isEnabled) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PREMIUM_REQUIRED',
            message: `This feature requires the ${module} premium module`,
            module,
            upgradeUrl: `/settings/billing?upgrade=${module}`
          }
        },
        { status: 402 } // Payment Required
      );
    }

    return null; // Continue to handler
  };
}
```

### Tasks for Phase 7

- [ ] Create FeatureFlags service interface
- [ ] Implement SupabaseFeatureFlagService
- [ ] Create premium guard middleware
- [ ] Create stub folders for all premium modules
- [ ] Write README specs for each premium module
- [ ] Add upgrade prompts in UI where premium features would appear
- [ ] Create billing/upgrade page placeholder

---

## Risk Mitigation

### High-Risk Items

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality during BookingEngine consolidation | High | Feature flags, comprehensive tests before merge, gradual rollout |
| Data migration issues with new tables | High | Backup before migration, rollback scripts ready |
| API breaking changes | Medium | Version APIs, deprecation notices, client library updates |
| Performance regression | Medium | Benchmark tests, monitoring alerts |

### Rollback Strategy

1. **Database Migrations:** All migrations must have corresponding `down` migrations
2. **Feature Flags:** New modules behind flags until stable
3. **Blue-Green API:** Can route to old handlers if needed
4. **Git Tags:** Tag before each phase completion

---

## Success Metrics

### Phase Completion Criteria

| Phase | Criteria |
|-------|----------|
| Phase 0 | Module generator works, DI container functional |
| Phase 1 | Logger works, event_store table exists, events persisting |
| Phase 2 | CompanyManagement and StaffManagement modules pass all tests |
| Phase 3 | BookingEngine consolidated, all modules at 85%+ domain test coverage |
| Phase 4 | All API endpoints exist and pass integration tests |
| Phase 5 | All migrations applied, types regenerated |
| Phase 6 | All quality gates passing, E2E tests green |
| Phase 7 | Premium foundation ready, feature flags working |

### Overall Success Metrics

- [ ] 100% of design doc core modules implemented
- [ ] 0 TypeScript errors
- [ ] 85%+ unit test coverage on domain layer
- [ ] All E2E critical paths passing
- [ ] API response times < 200ms (p95)
- [ ] Zero security test failures

---

## Appendix A: File Creation Checklist

### New Files to Create

```
# Phase 0
scripts/generate-module.ts
docs/creating-modules.md
src/shared/infrastructure/container/Container.ts
src/shared/infrastructure/container/index.ts

# Phase 1
src/shared/infrastructure/logging/ILogger.ts
src/shared/infrastructure/logging/Logger.ts
src/shared/infrastructure/logging/ConsoleLogger.ts
src/shared/infrastructure/logging/index.ts
src/shared/infrastructure/eventStore/IEventStoreRepository.ts
src/shared/infrastructure/eventStore/SupabaseEventStoreRepository.ts
src/shared/infrastructure/eventStore/index.ts
src/shared/infrastructure/eventBus/PersistentEventBus.ts
supabase/migrations/YYYYMMDDHHMMSS_add_event_store.sql

# Phase 2A - CompanyManagement (~25 files)
src/modules/CompanyManagement/domain/Company.ts
src/modules/CompanyManagement/domain/ICompanyRepository.ts
src/modules/CompanyManagement/domain/value-objects/CompanyName.ts
src/modules/CompanyManagement/domain/value-objects/SubscriptionPlan.ts
src/modules/CompanyManagement/domain/value-objects/SubscriptionStatus.ts
src/modules/CompanyManagement/domain/value-objects/BillingCycle.ts
src/modules/CompanyManagement/domain/value-objects/OnboardingToken.ts
src/modules/CompanyManagement/domain/events/CompanyCreatedEvent.ts
src/modules/CompanyManagement/domain/events/CompanyUpdatedEvent.ts
src/modules/CompanyManagement/domain/events/SubscriptionActivatedEvent.ts
src/modules/CompanyManagement/domain/events/SubscriptionCancelledEvent.ts
src/modules/CompanyManagement/domain/events/SubscriptionPlanChangedEvent.ts
src/modules/CompanyManagement/domain/events/InviteGeneratedEvent.ts
src/modules/CompanyManagement/domain/events/index.ts
src/modules/CompanyManagement/application/commands/CreateCompanyCommand.ts
src/modules/CompanyManagement/application/commands/UpdateCompanyCommand.ts
src/modules/CompanyManagement/application/commands/ActivateSubscriptionCommand.ts
src/modules/CompanyManagement/application/commands/CancelSubscriptionCommand.ts
src/modules/CompanyManagement/application/commands/ChangePlanCommand.ts
src/modules/CompanyManagement/application/commands/GenerateInviteTokenCommand.ts
src/modules/CompanyManagement/application/queries/GetCompanyQuery.ts
src/modules/CompanyManagement/application/queries/GetCompanyByOwnerQuery.ts
src/modules/CompanyManagement/application/queries/GetSubscriptionStatusQuery.ts
src/modules/CompanyManagement/application/DTOs/CompanyDTO.ts
src/modules/CompanyManagement/application/DTOs/SubscriptionDTO.ts
src/modules/CompanyManagement/infrastructure/SupabaseCompanyRepository.ts
src/modules/CompanyManagement/index.ts

# Phase 2B - StaffManagement (~20 files)
src/modules/StaffManagement/domain/PropertyStaff.ts
src/modules/StaffManagement/domain/IPropertyStaffRepository.ts
src/modules/StaffManagement/domain/value-objects/StaffRole.ts
src/modules/StaffManagement/domain/value-objects/Permissions.ts
src/modules/StaffManagement/domain/events/StaffAddedEvent.ts
src/modules/StaffManagement/domain/events/StaffRemovedEvent.ts
src/modules/StaffManagement/domain/events/StaffRoleChangedEvent.ts
src/modules/StaffManagement/domain/events/PermissionsUpdatedEvent.ts
src/modules/StaffManagement/domain/events/index.ts
src/modules/StaffManagement/application/commands/AddStaffMemberCommand.ts
src/modules/StaffManagement/application/commands/RemoveStaffMemberCommand.ts
src/modules/StaffManagement/application/commands/ChangeStaffRoleCommand.ts
src/modules/StaffManagement/application/commands/UpdatePermissionsCommand.ts
src/modules/StaffManagement/application/queries/GetPropertyStaffQuery.ts
src/modules/StaffManagement/application/queries/GetStaffMemberQuery.ts
src/modules/StaffManagement/application/queries/CheckPermissionQuery.ts
src/modules/StaffManagement/application/DTOs/PropertyStaffDTO.ts
src/modules/StaffManagement/infrastructure/SupabasePropertyStaffRepository.ts
src/modules/StaffManagement/index.ts

# Phase 3 (various enhancements)
src/modules/SiteManagement/domain/value-objects/Hookup.ts
src/modules/SiteManagement/domain/value-objects/Amenity.ts
src/modules/SiteManagement/domain/value-objects/Coordinates.ts
src/modules/SiteManagement/domain/value-objects/PetPolicy.ts
src/modules/SiteManagement/domain/value-objects/AccessibilityFeatures.ts
src/modules/GuestManagement/domain/value-objects/EmergencyContact.ts
src/modules/GuestManagement/domain/events/GuestUpdatedEvent.ts
src/modules/BookingEngine/domain/services/AvailabilityService.ts
src/modules/BookingEngine/domain/services/PricingCalculator.ts
src/modules/Financial/domain/services/FinancialReportingService.ts
src/modules/Financial/application/eventHandlers/ReservationEventHandlers.ts

# Phase 4 - API Routes
src/app/api/v1/companies/route.ts
src/app/api/v1/companies/[id]/route.ts
src/app/api/v1/companies/[id]/subscription/route.ts
src/app/api/v1/companies/[id]/invite/route.ts
src/app/api/v1/properties/[propertyId]/settings/route.ts
src/app/api/v1/properties/[propertyId]/staff/route.ts
src/app/api/v1/properties/[propertyId]/staff/[staffId]/route.ts
src/app/api/v1/guests/route.ts
src/app/api/v1/guests/[id]/reservations/route.ts
src/app/api/v1/reservations/route.ts
src/app/api/v1/reservations/[id]/extend/route.ts
src/app/api/v1/reservations/[id]/renew/route.ts
src/app/api/v1/payments/route.ts
src/app/api/v1/payments/[id]/route.ts
src/app/api/v1/payments/[id]/refund/route.ts
src/app/api/v1/reservations/[id]/installments/route.ts
src/app/api/v1/installments/[id]/mark-paid/route.ts
src/app/api/v1/properties/[propertyId]/financial-summary/route.ts

# Phase 5 - Migrations
supabase/migrations/YYYYMMDDHHMMSS_add_module_licenses.sql
supabase/migrations/YYYYMMDDHHMMSS_enhance_subscription_events.sql

# Phase 7 - Premium Foundation
src/shared/infrastructure/features/FeatureFlags.ts
src/shared/infrastructure/features/IFeatureFlagService.ts
src/shared/infrastructure/features/SupabaseFeatureFlagService.ts
src/lib/middleware/premiumGuard.ts
src/modules/DynamicPricing/README.md
src/modules/GuestCommunications/README.md
src/modules/ChannelManagement/README.md
src/modules/AdvancedAnalytics/README.md
src/modules/MaintenanceManagement/README.md
src/modules/ReviewSystem/README.md
```

---

## Appendix B: Execution Order

For a solo developer or small team, recommended execution order:

1. **Phase 0** - Foundation (1-2 days)
2. **Phase 1** - Shared Kernel (2-3 days)
3. **Phase 5** - Database Migrations (1 day) - Do early to have tables ready
4. **Phase 2A** - CompanyManagement (3-4 days)
5. **Phase 2B** - StaffManagement (2-3 days)
6. **Phase 3A** - BookingEngine Consolidation (3-4 days)
7. **Phase 3B-D** - Module Enhancements (2-3 days)
8. **Phase 4** - API Consolidation (3-4 days)
9. **Phase 6** - Testing (ongoing, 3-5 days dedicated)
10. **Phase 7** - Premium Foundation (1-2 days)

**Estimated Total:** 20-30 days of focused development

---

*Document generated: November 24, 2025*
*Next review: After Phase 2 completion*

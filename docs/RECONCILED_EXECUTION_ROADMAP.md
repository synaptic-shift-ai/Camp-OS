# CampOps Modular Architecture - Execution Roadmap

**Version:** 5.2
**Created:** December 18, 2025
**Last Updated:** December 18, 2025
**Source of Truth:** `docs/implementation-plan-modular-architecture.md`
**Status:** Phase 0 ✅ | Phase 1 ✅ | Phase 2 Ready

---

## Purpose

This document tracks execution of the modular architecture implementation plan. The implementation plan (`docs/implementation-plan-modular-architecture.md`) is the source of truth for WHAT to build. This document tracks progress and notes discovered issues.

**Do not deviate from the implementation plan phase order.**

---

## Known Issues (To Be Fixed In Relevant Phases)

Issues discovered during development. Each will be resolved in its designated phase.

### Issue: BookingEngine Persistence Layer Broken

**Discovered:** December 18, 2025
**Location:** `src/modules/BookingEngine/domain/Reservation.ts`
**Fix In:** Phase 3A (Consolidate BookingEngine + ReservationManagement)

`toPersistence()` writes to non-existent columns:
- `total_amount_cents` → should be `total_amount`
- `paid_amount_cents` → should be `paid_amount`
- `balance_paid_at_check_in_cents` → should be `balance_paid_at_checkin`
- `refund_amount_cents` → column doesn't exist

### Issue: Duplicate Booking Modules

**Fix In:** Phase 3A

Both `BookingEngine` and `ReservationManagement` modules exist. Implementation plan specifies merging them.

### Issue: Legacy lib/booking Code

**Fix In:** After Phase 4 (API Consolidation)

`lib/booking/` exists alongside modules. Delete after all routes migrated to module handlers.

### ~~Issue: Inconsistent Module Structures~~ RESOLVED

**Discovered:** December 18, 2025
**Fixed In:** Phase 0 (Prerequisites) - December 18, 2025

~~Existing modules do not conform to canonical structure defined in CLAUDE.md (M-1).~~

**Resolution:** All 5 modules now conform to canonical structure. Generator tested and working.

---

## Phase 0: Infrastructure & Tooling

**Status:** ✅ COMPLETE
**Completed:** December 18, 2025
**Goal:** Establish tooling and patterns before module work

### 0.1 Prerequisites: Conform Existing Modules to Canonical Structure ✅

All modules now conform to canonical structure per CLAUDE.md (M-1 through M-5):

```
src/modules/{ModuleName}/
├── domain/
│   ├── {Entity}.ts
│   ├── I{Entity}Repository.ts
│   ├── events/
│   │   └── index.ts
│   ├── value-objects/
│   │   └── index.ts
│   └── __tests__/
├── application/
│   ├── commands/
│   ├── queries/
│   └── DTOs/
├── infrastructure/
│   └── __tests__/
└── index.ts
```

**Conformance Tasks:**
- [x] Add missing `domain/value-objects/` to GuestManagement, PropertyManagement, SiteManagement
- [x] Add missing `domain/__tests__/` to BookingEngine, Financial
- [x] Add missing `infrastructure/__tests__/` to BookingEngine, Financial, PropertyManagement
- [x] Move Financial `domain/aggregates/*` contents to `domain/`
- [x] Move Financial `domain/repositories/*` contents to `domain/`
- [x] Remove empty `domain/aggregates/` and `domain/repositories/` from Financial
- [x] Relocate `infrastructure/__benchmarks__/` from PropertyManagement to `benchmarks/PropertyManagement/`
- [x] Create `index.ts` barrel export for ALL modules (except ReservationManagement)
- [x] Add `events/index.ts` barrel export to all modules
- [x] Add `value-objects/index.ts` barrel export to all modules
- [x] Verify all modules pass structure validation

### 0.2 Generator & DI Container ✅

**Tasks:**
- [x] Create `scripts/generate-module.ts` (based on conforming module structure)
- [x] Add npm script: `npm run generate:module`
- [x] Create `src/shared/infrastructure/container/Container.ts`
- [x] Create `src/shared/infrastructure/container/index.ts`
- [ ] Document module creation process in `docs/creating-modules.md` (deferred - not blocking)
- [x] Test generator output matches canonical structure exactly
- [x] Fix generator issues discovered during testing (events export, table name typing)

### Files Created

```
scripts/generate-module.ts                              ✅
src/shared/infrastructure/container/Container.ts       ✅
src/shared/infrastructure/container/index.ts           ✅
src/modules/BookingEngine/index.ts                     ✅
src/modules/Financial/index.ts                         ✅
src/modules/GuestManagement/index.ts                   ✅
src/modules/PropertyManagement/index.ts                ✅
src/modules/SiteManagement/index.ts                    ✅
src/modules/*/domain/events/index.ts                   ✅ (all modules)
src/modules/*/domain/value-objects/index.ts            ✅ (all modules)
benchmarks/PropertyManagement/                         ✅ (relocated)
```

### Completion Criteria

- [x] ALL existing modules conform to canonical structure (M-1)
- [x] ALL modules have barrel exports (M-2)
- [x] No non-standard folders exist (M-3)
- [x] Module generator works and produces conforming output
- [x] Generator tested with TestModule - type-check passes
- [x] DI container functional (singleton/transient support)
- [ ] Documentation complete (deferred - `docs/creating-modules.md`)

---

## Phase 1: Complete Shared Kernel

**Status:** ✅ COMPLETE
**Completed:** December 18, 2025
**Goal:** Fill gaps in shared infrastructure
**Prerequisites:** Phase 0 ✅

### Tasks

**Logger Infrastructure:**
- [x] Create `src/shared/infrastructure/logging/ILogger.ts`
- [x] Create `src/shared/infrastructure/logging/ConsoleLogger.ts`
- [x] Create `src/shared/infrastructure/logging/index.ts`
- [x] Write tests for Logger (16 tests)

**Event Store:**
- [x] Migration exists: `20251105000001_add_event_store_table.sql`
- [x] Create `src/shared/infrastructure/eventStore/IEventStoreRepository.ts`
- [x] Create `src/shared/infrastructure/eventStore/SupabaseEventStoreRepository.ts`
- [x] Create `src/shared/infrastructure/eventStore/index.ts`
- [x] Repository implementation complete (integration tests deferred to Phase 6)

**Persistent Event Bus:**
- [x] Create `src/shared/infrastructure/eventBus/PersistentEventBus.ts`
- [x] Write tests for PersistentEventBus (17 tests)
- [x] Update `src/shared/infrastructure/index.ts` barrel exports

### Files Created

```
src/shared/infrastructure/logging/ILogger.ts           ✅
src/shared/infrastructure/logging/ConsoleLogger.ts    ✅
src/shared/infrastructure/logging/index.ts            ✅
src/shared/infrastructure/logging/__tests__/ConsoleLogger.test.ts  ✅

src/shared/infrastructure/eventStore/IEventStoreRepository.ts      ✅
src/shared/infrastructure/eventStore/SupabaseEventStoreRepository.ts ✅
src/shared/infrastructure/eventStore/index.ts         ✅

src/shared/infrastructure/eventBus/PersistentEventBus.ts ✅
src/shared/infrastructure/eventBus/__tests__/PersistentEventBus.test.ts ✅
```

### Completion Criteria

- [x] Logger works (ConsoleLogger with levels, context, child loggers)
- [x] event_store table exists (migration present)
- [x] Event store repository implemented
- [x] PersistentEventBus persists and dispatches events
- [x] All tests pass (94 tests in shared/)

---

## Phase 2: Missing Core Modules

**Status:** 🔜 READY TO START
**Goal:** Create CompanyManagement and StaffManagement modules
**Prerequisites:** Phase 0 ✅, Phase 1 ✅

### Phase 2A: CompanyManagement Module

**Priority:** HIGH - Core SaaS tenant functionality

**Tasks:**
- [ ] Create directory structure
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

### Phase 2B: StaffManagement Module

**Priority:** HIGH - RBAC functionality

**Tasks:**
- [ ] Create directory structure
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

### Completion Criteria

- [ ] CompanyManagement module passes all tests
- [ ] StaffManagement module passes all tests
- [ ] All API routes functional

---

## Phase 3: Enhance Existing Modules

**Status:** NOT STARTED
**Goal:** Consolidate and complete existing modules

### Phase 3A: Consolidate BookingEngine + ReservationManagement

**NOTE:** This is where the persistence layer issue gets fixed.

**Tasks:**
- [ ] Create new folder structure under BookingEngine
- [ ] Move ReservationManagement value objects to BookingEngine
- [ ] Move ReservationManagement events to BookingEngine
- [ ] **FIX `toPersistence()` column names** (see Known Issues)
- [ ] **Add schema validation tests for persistence**
- [ ] Update all imports across codebase
- [ ] Delete ReservationManagement module
- [ ] Create AvailabilityService domain service
- [ ] Create PricingCalculator domain service
- [ ] Add ExtendReservationCommand
- [ ] Add RenewReservationCommand
- [ ] Add ModifyReservationCommand
- [ ] Add CheckInGuestCommand (verify existing)
- [ ] Add CheckOutGuestCommand (verify existing)
- [ ] Update/create API routes for new commands
- [ ] Write tests for all new commands

### Phase 3B: Complete SiteManagement

**Tasks:**
- [ ] Create Hookup value object
- [ ] Create Amenity value object
- [ ] Create Coordinates value object
- [ ] Create PetPolicy value object
- [ ] Create AccessibilityFeatures value object
- [ ] Add business logic methods to Site entity (markAsReserved, markAsOccupied, release, putUnderMaintenance, canAccommodate)
- [ ] Add SiteMaintenanceStartedEvent
- [ ] Add SitePricingUpdatedEvent
- [ ] Update SupabaseSiteRepository for new fields
- [ ] Write tests for new value objects
- [ ] Write tests for Site business methods

### Phase 3C: Enhance GuestManagement

**Tasks:**
- [ ] Create EmergencyContact value object
- [ ] Create GuestUpdatedEvent
- [ ] Update Guest aggregate to use EmergencyContact
- [ ] Update repository and DTO
- [ ] Write tests

### Phase 3D: Complete Financial Module

**Tasks:**
- [ ] Create Stripe adapter in `infrastructure/stripe/`
- [ ] Create FinancialReportingService domain service
- [ ] Create ReservationEventHandlers (event subscriptions)
- [ ] Add API endpoint for financial summary
- [ ] Write tests

### Completion Criteria

- [ ] BookingEngine consolidated (single module)
- [ ] Persistence layer works correctly
- [ ] All modules at 85%+ domain test coverage

---

## Phase 4: API Consolidation

**Status:** NOT STARTED
**Goal:** All API endpoints exist and use module handlers

### Missing Endpoints to Create

**Companies API:**
- [ ] POST `/v1/companies`
- [ ] GET `/v1/companies/:id`
- [ ] PATCH `/v1/companies/:id`
- [ ] GET `/v1/companies/:id/subscription`
- [ ] POST `/v1/companies/:id/subscription`
- [ ] POST `/v1/companies/:id/invite`

**Properties API:**
- [ ] GET `/v1/properties/:id/settings`
- [ ] PATCH `/v1/properties/:id/settings`

**Guests API:**
- [ ] POST `/v1/guests`
- [ ] GET `/v1/guests/:id/reservations`

**Reservations API:**
- [ ] POST `/v1/reservations`
- [ ] POST `/v1/reservations/:id/extend`
- [ ] POST `/v1/reservations/:id/renew`

**Financial API:**
- [ ] POST `/v1/payments`
- [ ] GET `/v1/payments/:id`
- [ ] POST `/v1/payments/:id/refund`
- [ ] POST `/v1/reservations/:id/installments`
- [ ] GET `/v1/reservations/:id/installments`
- [ ] PATCH `/v1/installments/:id/mark-paid`
- [ ] GET `/v1/properties/:propertyId/financial-summary`

**Staff API:**
- [ ] GET `/v1/properties/:propertyId/staff`
- [ ] POST `/v1/properties/:propertyId/staff`
- [ ] GET `/v1/properties/:propertyId/staff/:staffId`
- [ ] PATCH `/v1/properties/:propertyId/staff/:staffId`
- [ ] DELETE `/v1/properties/:propertyId/staff/:staffId`

### Additional Tasks

- [ ] Update all existing routes to use Container/handlers pattern
- [ ] Add OpenAPI/Swagger documentation
- [ ] Create API integration tests for all endpoints

### Completion Criteria

- [ ] All API endpoints exist
- [ ] All routes use module handlers (no direct Supabase in routes)
- [ ] Integration tests pass

---

## Phase 5: Database Schema Evolution

**Status:** NOT STARTED
**Goal:** Add required tables

### Tasks

- [ ] Create migration for event_store table (if not done in Phase 1)
- [ ] Create migration for module_licenses table
- [ ] Create/enhance subscription_events table
- [ ] Run migrations in development
- [ ] Verify RLS policies work correctly
- [ ] Update Supabase types (`npm run gen:db`)
- [ ] Test migrations in staging
- [ ] Deploy to production

### Completion Criteria

- [ ] All tables exist
- [ ] RLS policies correct
- [ ] Types regenerated

---

## Phase 6: Testing & Quality Gates

**Status:** NOT STARTED
**Goal:** Comprehensive test coverage and CI gates

### Coverage Targets

| Layer | Target |
|-------|--------|
| Domain Entities/Aggregates | 90% |
| Value Objects | 95% |
| Command Handlers | 85% |
| Query Handlers | 80% |
| Repositories | 80% |
| API Routes | 75% |
| E2E Critical Paths | 100% |

### Tasks

- [ ] Create test file structure per implementation plan
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

### Completion Criteria

- [ ] All quality gates passing
- [ ] E2E tests green
- [ ] Coverage targets met

---

## Phase 7: Premium Module Foundation

**Status:** NOT STARTED
**Goal:** Foundation for premium features

### Tasks

- [ ] Create FeatureFlags service interface
- [ ] Implement SupabaseFeatureFlagService
- [ ] Create premium guard middleware
- [ ] Create stub folders for all premium modules
- [ ] Write README specs for each premium module
- [ ] Add upgrade prompts in UI where premium features would appear
- [ ] Create billing/upgrade page placeholder

### Premium Module Stubs to Create

- DynamicPricing/README.md
- GuestCommunications/README.md
- ChannelManagement/README.md
- AdvancedAnalytics/README.md
- MaintenanceManagement/README.md
- ReviewSystem/README.md

### Completion Criteria

- [ ] Premium foundation ready
- [ ] Feature flags working
- [ ] Guard middleware functional

---

## Post-Implementation: Cleanup

**After Phase 4 completion:**

- [ ] Delete `src/lib/booking/` (legacy code)
- [ ] Remove any remaining adapter layers
- [ ] Clean up unused types
- [ ] Update CLAUDE.md with final architecture

---

## Execution Order

Per implementation plan Appendix B:

1. ✅ **Phase 0 - Foundation** - COMPLETE (December 18, 2025)
2. ✅ **Phase 1 - Shared Kernel** - COMPLETE (December 18, 2025)
3. Phase 5 - Database Migrations - Do early to have tables ready
4. 🔜 **Phase 2A - CompanyManagement** - NEXT
5. Phase 2B - StaffManagement
6. Phase 3A - BookingEngine Consolidation
7. Phase 3B-D - Module Enhancements
8. Phase 4 - API Consolidation
9. Phase 6 - Testing (ongoing)
10. Phase 7 - Premium Foundation

---

## Success Metrics

From implementation plan:

- [ ] 100% of design doc core modules implemented
- [ ] 0 TypeScript errors
- [ ] 85%+ unit test coverage on domain layer
- [ ] All E2E critical paths passing
- [ ] API response times < 200ms (p95)
- [ ] Zero security test failures

---

**Document Status:** IN PROGRESS - Phase 0 & 1 Complete, Phase 2 Ready
**Last Updated:** December 18, 2025
**Source of Truth:** `docs/implementation-plan-modular-architecture.md`

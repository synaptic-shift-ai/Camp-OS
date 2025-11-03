# Dashboard Audit & Integration Planning - PRD

**Linear Issue:** [CAM-150](https://linear.app/campgroundops/issue/CAM-150/dashboard-audit-and-integration-planning)
**Status:** Ready for Implementation
**Created:** 2025-11-01
**Updated:** 2025-11-01
**Product Owner:** AI Product Owner
**Priority:** Urgent
**Sprint:** Week 1
**Labels:** planning, validation-approved, sprint-week-1, documentation, frontend

---

## Executive Summary

The CampOps dashboard currently displays a mix of real database-driven data and hardcoded mock data across different pages. This creates an inconsistent user experience and prevents property operators from seeing accurate, real-time information about their campground operations. This PRD outlines the comprehensive audit of all dashboard components, identification of mock data usage, and planning for minimal database integration required for an effective product demo.

**Goal:** Create a clear integration plan that prioritizes visible dashboard components for demo readiness while documenting the current state of data sources across the entire dashboard.

---

## Business Value

### Problem Statement

**Current State:**
- Dashboard pages inconsistently use real vs. mock data
- Demo presentations cannot showcase real-time operational data
- Difficult to assess which components need database integration for MVP
- No centralized documentation of data dependencies per component
- Risk of showing static mock data during investor/customer demos

**Evidence:**
1. **Main Dashboard (`/dashboard/page.tsx`)**: Uses real data via `getDashboardStats()` and `getReservations()`
2. **Reservations Page (`/dashboard/reservations/page.tsx`)**: Fully integrated with database queries
3. **Payments Page (`/dashboard/payments/page.tsx`)**: Fully integrated with database queries
4. **Analytics Page (`/dashboard/analytics/page.tsx`)**: 100% hardcoded mock data (line 29: `$45,231`, line 86-115: mock arrays)
5. **Sites Page (`/dashboard/sites/page.tsx`)**: 100% hardcoded mock data (lines 35-76: const sites array)
6. **Guests Page (`/dashboard/guests/page.tsx`)`: 100% hardcoded mock data (lines 19-47: const guests array)
7. **Settings Page (`/dashboard/settings/page.tsx`)**: Static form with no data persistence

### Opportunity

**Immediate Benefits:**
- **Demo Confidence**: Know exactly which screens show real data vs. mocks
- **Development Priority**: Clear roadmap for database integration work
- **Technical Debt Visibility**: Document which components need real data
- **Quality Assurance**: Prevent embarrassing demo failures with mock data

**Long-Term Benefits:**
- **Data-Driven Operations**: Real-time insights for campground operators
- **Competitive Advantage**: Live operational dashboard vs. competitors' static reports
- **User Trust**: Operators see their actual property data, not placeholders
- **Scalability Foundation**: Clear data architecture for future features

### Strategic Alignment

Aligns with CampOps platform goals:
- **MVP Readiness**: Prioritize demo-visible components for integration
- **User-Centric Design**: Show operators their real data, not mock examples
- **Technical Foundation**: Document data architecture for team scale
- **Quality Standards**: Establish patterns for database integration

### Key Product Decisions (Updated 2025-11-01)

Following product owner clarifications, these critical decisions now guide implementation:

1. **All Pages Required**: Sites, Guests, Analytics, and Settings pages are ALL equally important for demo - no prioritization trade-offs
2. **Real Data Only**: Empty states must show only real data or actionable CTAs - no sample data, no educational placeholders
3. **Testing Mandatory**: Integration tests required for ALL dashboard queries (not optional)
4. **Incremental Delivery**: Pages can be integrated incrementally as long as all completed by deadline
5. **Industry Standards**: Apply SaaS industry best practices for caching and query performance
6. **Scale Planning**: Design for significant volumes (dozens of companies, hundreds of sites per property, thousands of reservations)

---

## User Stories

### Primary Users

**Property Operators (Primary Users)**
- Need: See real-time data about their campground operations
- Pain: Mock data doesn't reflect their actual business metrics
- Benefit: Make data-driven decisions based on actual reservations, revenue, occupancy

**Demo Presenters (Internal Users)**
- Need: Showcase working product with believable data
- Pain: Risk of showing obviously fake data during demos
- Benefit: Confidently demonstrate platform capabilities with realistic scenarios

**Engineering Team (Internal Users)**
- Need: Clear documentation of component data dependencies
- Pain: Unclear which components need database integration
- Benefit: Prioritized integration roadmap with clear requirements

### User Stories

**As a** property operator, **I want** to see my actual revenue and occupancy statistics, **so that** I can make informed business decisions about pricing and capacity.

**As a** property operator, **I want** to view my real site inventory and status, **so that** I can manage availability and maintenance schedules.

**As a** demo presenter, **I want** to know which dashboard screens use real data, **so that** I can confidently showcase product capabilities without embarrassment.

**As a** developer, **I want** clear documentation of database tables and queries needed per component, **so that** I can efficiently implement data integration.

**As a** product manager, **I want** prioritized components based on demo visibility, **so that** I can allocate engineering resources to highest-impact work.

### User Scenarios

**Scenario 1: Live Demo to Investor**
1. Demo presenter shows main dashboard - displays real reservation data ✓
2. Navigate to Sites page - shows hardcoded "Site 15, Riverside Site 15" mock data ✗
3. Investor asks "Can you show me a different property's sites?" - cannot, data is hardcoded ✗
4. **Outcome**: Lost credibility due to obvious mock data

**Scenario 2: Property Operator First Login**
1. New operator completes onboarding wizard, creates property
2. Navigates to Analytics page expecting to see baseline metrics
3. Sees "$45,231 revenue" and "156 bookings" despite having zero reservations
4. **Outcome**: Confused operator, reduced trust in platform

**Scenario 3: Engineering Sprint Planning**
1. Team needs to integrate Sites page with database
2. No documentation of which database tables/queries are needed
3. Developer spends 2 hours reverse-engineering requirements from mock data
4. **Outcome**: Wasted time, potential misalignment with data model

---

## Functional Requirements

### Core Requirements

**REQ-1: Component Audit (MUST)**
- **Description**: Systematically audit all dashboard components (`/app/dashboard/**/*.tsx`)
- **Acceptance Criteria**:
  - List all dashboard pages (main, reservations, sites, guests, analytics, payments, settings)
  - For each page, identify data source: Real DB, Mock Data, or Hybrid
  - For mock data, document exact location (file:line numbers)
  - For real data, document query functions used
- **Priority**: P0 (Blocker for integration planning)

**REQ-2: Database Mapping (MUST)**
- **Description**: Map each component's data needs to database schema
- **Acceptance Criteria**:
  - Identify required tables for each component
  - Document specific queries needed (aggregations, joins, filters)
  - Note any missing database tables/columns
  - Specify multi-tenant isolation requirements (property_id filtering)
- **Priority**: P0 (Required for accurate integration estimates)

**REQ-3: Demo Visibility Prioritization (MUST)**
- **Description**: Rank components by visibility in product demos
- **Acceptance Criteria**:
  - Classify each page: High Demo Visibility, Medium, Low, Not Shown
  - Justify priority ranking based on typical demo flow
  - Consider user journey: signup → wizard → dashboard → reservations → sites
  - Account for investor vs. customer demo differences
- **Priority**: P0 (Drives integration roadmap)

**REQ-4: Integration Plan Document (MUST)**
- **Description**: Create comprehensive `docs/DASHBOARD_INTEGRATION_PLAN.md`
- **Acceptance Criteria**:
  - Document structure matches CAM-129 PRD quality standards
  - Includes executive summary for stakeholders
  - Provides detailed component-by-component breakdown
  - Contains prioritized implementation roadmap
  - Lists specific database queries/tables per component
  - Estimates integration effort (T-shirt sizes: S/M/L)
- **Priority**: P0 (Deliverable for Linear issue)

**REQ-5: Query Implementation Guide (SHOULD)**
- **Description**: Provide reusable query patterns for common dashboard needs
- **Acceptance Criteria**:
  - Example aggregation queries (sum, count, avg)
  - Example join queries (reservations + guests + sites)
  - Example filter queries (date ranges, status filters)
  - Multi-tenant query examples (always include property_id)
  - Follow patterns from `lib/dashboard/queries.ts`
- **Priority**: P1 (Accelerates implementation)

### Edge Cases

**EDGE-1: Empty State Data**
- Components must handle zero reservations, sites, guests gracefully
- Mock data should NEVER appear for new properties (Product Decision: Real data only)
- Empty states should show relevant CTAs to setup requirements (e.g., "Create your first site", "Add property details")
- No sample/demo data in empty states - only actionable guidance

**EDGE-2: Multi-Tenant Data Isolation**
- All queries MUST include property_id filtering
- Dashboard must show only current property's data
- Property switcher (if implemented) must refresh all data

**EDGE-3: Large Data Sets**
- Consider pagination for tables (guests, reservations, payments)
- Performance implications of aggregation queries (analytics)
- Lazy loading vs. eager loading trade-offs

**EDGE-4: Real-Time Updates**
- Analytics page: Consider data staleness (cache duration)
- Main dashboard: Balance real-time accuracy vs. query performance
- Occupancy calculations: Current day vs. historical periods

### Multi-Tenant Considerations

**All database queries identified in this audit MUST:**
1. Include `property_id` in WHERE clause for tenant isolation
2. Use typed Supabase client from `@/lib/supabase/server`
3. Follow patterns from `lib/dashboard/queries.ts`
4. Handle Supabase errors gracefully
5. Return user-friendly error messages (never expose SQL errors)

**Example Pattern (from existing code):**
```typescript
const { data, error } = await supabase
  .from('sites')
  .select('*')
  .eq('property_id', propertyId) // REQUIRED for tenant isolation
  .eq('status', 'available')
```

### Security & Compliance

**SEC-1: Data Access Control**
- Only authenticated users can access dashboard pages
- Users can only view data for their own properties
- Property ID validation on all queries
- No query parameters should override property_id filter

**SEC-2: Sensitive Data Handling**
- Guest contact information: Handle PII appropriately
- Payment data: Display partial information only (mask card numbers)
- Financial metrics: Ensure accurate calculations (money in cents)

### Testing Requirements

**TEST-1: Integration Tests (MUST)**
- **Requirement**: Integration tests required for ALL dashboard queries
- **Coverage**:
  - Each query function in `lib/dashboard/queries.ts`
  - Multi-tenant data isolation verification
  - Empty state handling (zero records)
  - Large dataset handling (pagination, performance)
- **Test Files**: `tests/integration/dashboard-queries.test.ts`
- **Success Criteria**: 100% of dashboard query functions have passing integration tests

**TEST-2: Performance Tests (SHOULD)**
- **Requirement**: Validate query response times meet SLA targets (Appendix C)
- **Benchmarks**: Test against realistic data volumes (see Data Volume Requirements)
- **Tools**: Use Vitest performance testing utilities
- **Success Criteria**: All queries meet "Acceptable Max" thresholds under load

**TEST-3: Security Tests (MUST)**
- **Requirement**: Tenant isolation tests for all multi-tenant queries
- **Test Files**: `tests/security/tenant-isolation.test.ts`
- **Coverage**: Verify property_id filtering, unauthorized access prevention
- **Success Criteria**: Zero cross-tenant data leakage in all scenarios

### Data Volume Requirements

**Expected Production Scale:**
- **Companies/Tenants**: Dozens of campground businesses
- **Properties per Company**: Multiple properties (multi-property management)
- **Sites per Property**: Hundreds (100-500 sites typical for large campgrounds)
- **Reservations**: Significant volumes (thousands per property per season)
- **Total Scale Impact**: Queries must handle 500+ sites, 10,000+ reservations per property

**Performance Implications:**
- Pagination REQUIRED for all list queries (sites, guests, reservations)
- Database indexes CRITICAL for property_id, site_id, guest_id foreign keys
- Aggregation queries must be optimized for large datasets
- Consider materialized views for expensive analytics calculations

**Test Environment:**
- Demo data generator should populate test/dev databases with realistic volumes
- Minimum test data: 100 sites, 1000 reservations, 500 guests per property
- Performance tests should validate against upper bounds (500 sites, 10,000 reservations)

---

## Success Metrics

### Key Performance Indicators

**Planning Phase Success:**
- **Documentation Completeness**: 100% of dashboard components audited
- **Database Coverage**: All required tables/queries identified
- **Prioritization Clarity**: Stakeholder agreement on component priority ranking
- **Estimation Accuracy**: Integration effort estimates within 20% of actual

**Implementation Phase Success (Post-Integration):**
- **Data Accuracy**: 100% of dashboard metrics match database state
- **Demo Readiness**: High-priority components show real data
- **Query Performance**: All dashboard queries < 500ms response time
- **Zero Mock Data**: No hardcoded values in high-priority components

### Success Criteria

This planning task is successful when:

1. **DASHBOARD_INTEGRATION_PLAN.md exists** with comprehensive component audit
2. **Engineering team has clear roadmap** for database integration work
3. **Product team knows demo limitations** (which screens show real vs. mock data)
4. **Integration estimates are validated** by engineering leads
5. **Stakeholders approve priority ranking** for component integration order

### Measurement Plan

**Immediate (Planning Phase):**
- Document review by engineering leads (technical accuracy)
- Document review by product manager (priority alignment)
- Sprint planning uses document to estimate integration work

**Post-Implementation (Integration Phase):**
- Query performance monitoring (avg response time, p95, p99)
- Error rate tracking for dashboard queries
- User engagement metrics (time spent on dashboard pages)
- Demo success rate (no mock data embarrassments)

---

## Dependencies & Risks

### Technical Dependencies

**Database Schema:**
- Requires complete understanding of existing tables: `properties`, `sites`, `reservations`, `guests`, `payments`
- Assumes database types are up-to-date in `src/contracts/db.ts`
- Depends on multi-tenant schema with `property_id` on all tables

**Query Infrastructure:**
- Existing query patterns in `lib/dashboard/queries.ts` serve as templates
- Supabase client library (`@/lib/supabase/server`) must support required queries
- Type-safe database access via generated types

**Component Architecture:**
- Dashboard pages use Next.js 15 App Router with server components
- Async data fetching in server components (no client-side queries for initial load)
- Suspense boundaries for loading states

### Assumptions

1. **Database schema is stable** - No major migrations planned during integration
2. **Supabase is primary data source** - Not migrating to different database
3. **Single property per user** - MVP assumes operators manage one property (based on `getCurrentPropertyId()` pattern)
4. **Money stored as cents** - All financial values use integer cents (not decimal dollars)
5. **Existing queries are performant** - `lib/dashboard/queries.ts` patterns scale to MVP data volumes

### Risks

| Risk | Impact | Likelihood | Mitigation Strategy |
|------|--------|------------|---------------------|
| **Missing database tables** | High - Blocks integration | Medium | Audit existing schema against component needs; create migration plan for missing tables |
| **Poor query performance** | Medium - Slow dashboard | Medium | Implement query optimization; add database indexes; consider caching layer |
| **Incomplete audit** | High - Integration gaps | Low | Use systematic file-by-file review; code review by second engineer |
| **Scope creep during integration** | Medium - Timeline slip | High | Strictly prioritize high-visibility components; defer low-priority pages to future sprints |
| **Breaking changes to data model** | High - Rework required | Low | Freeze schema during integration sprint; version control migration scripts |
| **Hardcoded values missed in audit** | Medium - Demo failures | Medium | Automated grep/search for common mock patterns; manual code review |

### Open Questions

**Remaining Open Questions:**

**For Database/Ops Team:**
1. **Index Strategy**: Which columns need indexes for dashboard query performance?
   - *Status*: Pending engineering analysis based on query patterns
2. **Backup/Restore**: Are there test environments with realistic data volumes?
   - *Status*: Pending ops team response

**Answered Questions (Incorporated into PRD):**

**Product Decisions:**
- **Priority Trade-offs**: ALL pages (Sites, Guests, Analytics, Settings) are equally important and required for demo
- **Empty State UX**: Only real data or relevant CTAs to setup. No sample data, no educational placeholders.
- **Data Seeding**: Demo data generator acceptable for test/dev environments only. Production patterns must not depend on seeded data.

**Engineering Decisions:**
- **Query Optimization**: Use industry standard best practices for caching and query optimization
- **Performance Targets**: Apply industry standard best practices for SaaS dashboard response times (see Appendix C for specific benchmarks)
- **Migration Strategy**: Incremental integration is acceptable as long as all pages completed by deadline
- **Testing Strategy**: Integration tests required for all dashboard queries (see Testing Requirements section)

---

## Out of Scope

**Explicitly NOT included in this planning task:**

1. **Actual Database Integration** - This PRD is for audit and planning only; implementation is separate
2. **New Features** - No new dashboard capabilities beyond matching mock data functionality
3. **UI/UX Redesign** - Focus on data integration, not component redesign
4. **Advanced Analytics** - Complex charts, trend analysis, forecasting (future phase)
5. **Real-Time Data Streaming** - WebSocket updates, live refresh (future enhancement)
6. **Mobile Dashboard** - Focus on desktop web experience for demo
7. **Multi-Property Management** - MVP assumes single property per user
8. **Third-Party Integrations** - No external data sources (weather, maps, etc.)
9. **Data Export** - CSV/PDF export of dashboard data (future feature)
10. **Custom Dashboards** - User-configurable widgets and layouts (future feature)

---

## Future Considerations

### Phase 2 Enhancements (Post-MVP)

**Advanced Analytics:**
- Historical trend charts (revenue over time, occupancy trends)
- Seasonal analysis (peak vs. off-peak performance)
- Predictive analytics (forecasted revenue, occupancy predictions)
- Comparison metrics (vs. last year, vs. industry benchmarks)

**Interactive Visualizations:**
- Replace placeholder charts with real Chart.js/D3 visualizations
- Interactive site map showing availability by location
- Occupancy calendar heat map
- Revenue funnel visualization

**Performance Optimization:**
- Implement query result caching (Redis or in-memory)
- Add database indexes based on production query patterns
- Optimize aggregation queries with materialized views
- Implement pagination for large data sets

**Real-Time Features:**
- WebSocket updates for live reservation status
- Push notifications for new bookings
- Live occupancy updates as guests check in/out
- Real-time payment status updates

**Multi-Property Support:**
- Property switcher in dashboard header
- Aggregate metrics across all properties
- Per-property drill-down
- Consolidated reporting

**Customization:**
- User-configurable dashboard widgets
- Custom date range selection
- Saved filter presets
- Personalized dashboard layouts

### Technical Debt to Address

1. **Inconsistent Data Patterns**: Some pages use server components, others could benefit from React Server Components refactoring
2. **Duplicated Logic**: `getCurrentPropertyId()` repeated across pages - should be centralized
3. **Type Safety**: Some mock data uses inline types - should use shared types from `src/contracts/`
4. **Error Handling**: Inconsistent error boundary implementation across dashboard pages
5. **Loading States**: Some pages use Suspense, others don't - standardize loading UX

---

## Appendix A: Current Component Audit Summary

### Fully Integrated (Real Database Data)

| Component | File | Data Source | Tables Used | Status |
|-----------|------|-------------|-------------|--------|
| Main Dashboard | `/app/dashboard/page.tsx` | `getDashboardStats()`, `getReservations()` | `reservations`, `payments`, `sites`, `guests` | ✅ Complete |
| Reservations Page | `/app/dashboard/reservations/page.tsx` | `getReservations()` | `reservations`, `guests`, `sites` | ✅ Complete |
| Payments Page | `/app/dashboard/payments/page.tsx` | `getPayments()`, `getDashboardStats()` | `payments`, `reservations`, `guests` | ✅ Complete |

### Using Mock Data (Requires Integration)

| Component | File | Mock Data Location | Demo Priority | Integration Effort |
|-----------|------|-------------------|---------------|-------------------|
| Analytics Page | `/app/dashboard/analytics/page.tsx` | Lines 29, 39, 49, 59 (stats), 86-115 (arrays) | HIGH | Large |
| Sites Page | `/app/dashboard/sites/page.tsx` | Lines 35-76 (const sites array), 215-240 (stats) | HIGH | Medium |
| Guests Page | `/app/dashboard/guests/page.tsx` | Lines 19-47 (const guests array) | MEDIUM | Small |
| Settings Page | `/app/dashboard/settings/page.tsx` | Entire page (no persistence) | LOW | Medium |

### Required Database Tables by Component

**Sites Page Integration Needs:**
- **Table**: `sites` (already exists)
- **Queries**:
  - Get all sites for property: `SELECT * FROM sites WHERE property_id = ? ORDER BY site_number`
  - Get site stats: `SELECT status, COUNT(*) FROM sites WHERE property_id = ? GROUP BY status`
  - Filter by status: `WHERE status = ?`
  - Search by name/number: `WHERE site_name ILIKE ? OR site_number ILIKE ?`
- **Data Fields**: id, site_number, site_name, site_type, max_occupancy, base_price_cents, hookups (array), status

**Guests Page Integration Needs:**
- **Table**: `guests` (already exists)
- **Queries**:
  - Get all guests for property: `SELECT * FROM guests WHERE property_id = ? ORDER BY created_at DESC`
  - Search guests: `WHERE first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?`
  - Get guest reservation count: `JOIN reservations ON guests.id = reservations.guest_id`
  - Calculate total spent: `SUM(reservations.paid_amount) WHERE guest_id = ?`
  - Get last visit: `MAX(reservations.check_out_date) WHERE guest_id = ?`
- **Data Fields**: id, first_name, last_name, email, phone, total_stays (calculated), total_spent (calculated), last_visit (calculated)

**Analytics Page Integration Needs:**
- **Tables**: `reservations`, `payments`, `sites`, `guests`
- **Queries**:
  - Revenue over time: `SELECT DATE(created_at), SUM(amount) FROM payments WHERE property_id = ? GROUP BY DATE(created_at)`
  - Bookings by month: `SELECT DATE_TRUNC('month', check_in_date), COUNT(*) FROM reservations WHERE property_id = ? GROUP BY DATE_TRUNC('month', check_in_date)`
  - Top performing sites: `SELECT site_id, COUNT(*) as bookings, SUM(total_amount) as revenue FROM reservations WHERE property_id = ? GROUP BY site_id ORDER BY revenue DESC LIMIT 5`
  - Booking sources: Requires new `booking_source` column on `reservations` table (FUTURE)
- **Data Fields**: Aggregations across multiple tables

**Settings Page Integration Needs:**
- **Table**: `properties` (already exists)
- **Queries**:
  - Get property details: `SELECT * FROM properties WHERE id = ?`
  - Update property: `UPDATE properties SET ... WHERE id = ?`
- **Data Fields**: property_name, property_type, description, email, phone, address, city, state, zip, check_in_time, check_out_time, timezone, booking_settings (JSON)

---

## Appendix B: Implementation Roadmap (Recommended)

**Note**: Per product decision, ALL pages (Sites, Guests, Analytics, Settings) are equally important and required for demo. Roadmap organized by technical dependencies and complexity, not business priority.

### Sprint 1: Foundation Components

**Sites Page Integration** (Estimated: 5 story points)
- Create `getSites()` query in `lib/dashboard/queries.ts`
- Create `getSiteStats()` query for status breakdown
- Replace mock data with real queries
- Add search/filter functionality
- Add empty state UI
- Test multi-tenant isolation

**Analytics Page - Phase 1** (Estimated: 8 story points)
- Implement basic stats (total revenue, bookings, avg occupancy, total guests)
- Reuse existing `getDashboardStats()` for top-level metrics
- Create placeholder for charts (defer actual chart implementation)
- Add date range selector (state only, connect in Phase 2)
- Test query performance with large datasets

### Sprint 2: Medium-Priority Components

**Guests Page Integration** (Estimated: 3 story points)
- Create `getGuests()` query with calculated fields
- Implement search functionality
- Add pagination (limit 50 per page)
- Replace mock data with real queries
- Test guest count edge cases (zero guests)

**Settings Page - Property Details** (Estimated: 5 story points)
- Create `getPropertyDetails()` query
- Create `updatePropertyDetails()` mutation
- Implement form persistence
- Add validation (Zod schema)
- Test update edge cases (concurrent edits)

### Sprint 3: Polish & Performance

**Analytics Page - Phase 2** (Estimated: 8 story points)
- Implement "Top Performing Sites" query
- Implement revenue trend chart (Chart.js)
- Implement occupancy trend chart
- Add date range filtering
- Optimize aggregation queries
- Add caching layer if needed

**Settings Page - Booking & Payment Settings** (Estimated: 5 story points)
- Extend property table with settings JSON column
- Implement booking preferences persistence
- Implement payment preferences persistence
- Implement notification preferences persistence
- Add settings validation

### Total Estimated Effort: 34 Story Points (~3 Sprints)

---

## Appendix C: Query Performance Benchmarks

**Target Performance SLAs:**

| Query Type | Target Response Time | Acceptable Max | Critical Max |
|------------|---------------------|----------------|--------------|
| Simple fetch (by ID) | < 50ms | < 100ms | < 200ms |
| List query (paginated) | < 200ms | < 500ms | < 1000ms |
| Aggregation (stats) | < 300ms | < 800ms | < 1500ms |
| Complex join (3+ tables) | < 400ms | < 1000ms | < 2000ms |
| Analytics (full table scan) | < 800ms | < 2000ms | < 5000ms |

**Monitoring Strategy:**
- Log all query execution times in development
- Set up Supabase query performance monitoring
- Alert if queries exceed "Acceptable Max" thresholds
- Optimize or cache queries exceeding "Critical Max"

**Optimization Techniques:**
1. **Indexes**: Add indexes on foreign keys (property_id, site_id, guest_id, reservation_id)
2. **Pagination**: Always use LIMIT/OFFSET for list queries
3. **Select Specific Fields**: Avoid `SELECT *` in production queries
4. **Denormalization**: Consider calculated columns for frequently accessed aggregations
5. **Caching**: Implement Redis cache for expensive analytics queries (TTL: 5-15 minutes)

---

## Document Change History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-01 | AI Product Owner | Initial PRD creation based on Linear issue CAM-150 |
| 1.1 | 2025-11-01 | AI Product Owner | Updated with answers to open questions: All pages equally important, real data only in empty states, integration tests required, industry-standard performance practices, incremental integration allowed, significant data volumes expected |

---

## Sign-Off

**Product Owner Approval:** _________________ Date: _________

**Engineering Lead Approval:** _________________ Date: _________

**Demo Team Acknowledgment:** _________________ Date: _________

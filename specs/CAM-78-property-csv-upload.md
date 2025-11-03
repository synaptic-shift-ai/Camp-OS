# Product Requirements Document: Property/Site CSV Upload

**Linear Issue:** [CAM-78](https://linear.app/campgroundops/issue/CAM-78/property-setup-csv-upload-of-property-details)
**Version:** 2.1
**Date:** 2025-11-01
**Status:** Ready for Implementation
**Priority:** Urgent
**Author:** Product Owner (AI)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 2.1 | 2025-11-01 | Product Owner | **POST-APPROVAL REFINEMENTS:** Incorporated validator approval notes. Removed SQL code from PRD (moved to specification-level only). Specified `papaparse` as chosen library. Added prerequisite migration to Dependencies. Clarified company-layer authorization. Emphasized existing bulk insert endpoint reuse opportunity. Updated status to Ready for Implementation. |
| 2.0 | 2025-10-31 | Product Owner | **CRITICAL:** Fixed `tenant_id` → `property_id` terminology throughout. **SCOPE:** Moved complex features (virus scanning, email confirmations, import history, UI rollback, complex rate limiting) to V2. **DATA INTEGRITY:** Added unique site number constraint. Set explicit 500-row limit for V1. Clarified single-property scope for V1. |
| 1.0 | 2025-10-31 | Product Owner | Initial draft |

---

## 1. Executive Summary

### 1.1. Problem Statement

Property operators completing onboarding currently lack an efficient method to populate their site inventory. Manual entry of dozens (or hundreds) of sites is time-consuming, error-prone, and creates friction in the onboarding experience. Many operators already maintain site data in spreadsheets or legacy systems and need a simple migration path.

### 1.2. Proposed Solution

A CSV upload feature in the operator dashboard that allows property managers to bulk import site/property details immediately after onboarding. The system will validate, preview, and import site data with clear error messaging.

**V1 Scope (This Document):** Single-property CSV upload with validation, preview, and atomic import for up to 500 sites.

**V2 Scope (Future):** Multi-property support, email confirmations, import history UI, advanced security features, and rollback capabilities.

### 1.3. Business Goals

- **Reduce Time-to-Value:** Enable operators to go from signup to fully configured property in minutes, not hours
- **Improve Onboarding Completion Rate:** Reduce abandonment during setup by streamlining bulk data entry
- **Support Migration:** Facilitate seamless migration from legacy systems with existing data exports
- **Foundation for Scale:** Build core import infrastructure that can be enhanced for enterprise features in V2

---

## 2. V1 vs V2 Scope

### 2.1. V1 Features (This Release)

**Core Import Functionality:**
- ✅ CSV file upload interface with drag-and-drop
- ✅ Downloadable CSV template with example data
- ✅ Pre-import validation (required fields, data types, uniqueness)
- ✅ Preview of first 10 rows before import
- ✅ Atomic transactional import (all-or-nothing)
- ✅ Single-property scope (operator imports to their own property only)
- ✅ 500-row maximum per import
- ✅ Basic success/error messages in UI

**Data Integrity:**
- ✅ Unique site number constraint per property (database-level)
- ✅ Property isolation (RLS policy enforcement)
- ✅ Input sanitization for XSS prevention
- ✅ 5MB file size limit

**Testing:**
- ✅ Unit tests for validation logic
- ✅ Integration tests for import flow
- ✅ Security tests for property isolation (per T-7)
- ✅ E2E tests for happy path

**Performance:**
- ✅ Import 100 sites in < 10 seconds
- ✅ Support up to 500 sites per import

### 2.2. V2 Features (Future Enhancements)

**Deferred to reduce implementation time from 45+ hours to ~20-25 hours:**

- 🔮 **Email Confirmations:** Send import summary email to operator
- 🔮 **Import History UI:** Dashboard showing past imports with metadata
- 🔮 **Import History Table:** `site_import_history` audit table
- 🔮 **Advanced Rate Limiting:** 10/hour per property throttling
- 🔮 **Virus Scanning:** ClamAV integration for uploaded files
- 🔮 **UI-Based Rollback:** One-click undo of recent import
- 🔮 **Multi-Property Support:** Enterprise operators importing to multiple properties
- 🔮 **Large File Support:** Background job processing for 500+ sites
- 🔮 **Update Existing Sites:** Re-import to update site details
- 🔮 **Excel Import:** Native `.xlsx` support
- 🔮 **Field Mapping UI:** Custom column mapping

**Rationale:** V1 focuses on core value delivery (bulk import) without infrastructure dependencies not yet in codebase (ClamAV, background jobs, audit tables). V2 adds operational excellence features after validating core use case.

---

## 3. User Personas & Stories

### 3.1. Primary Persona: Single-Property Operator (V1 Focus)

**Profile:** Owner of a small-to-medium campground (20-100 sites) with site data in Excel/Google Sheets

**User Story:**
> As a property operator who just completed onboarding, I want to upload my existing site data from a CSV file so that I can quickly populate my campground inventory without manually entering each site.

**Acceptance Criteria:**
- Upload CSV with all site details in one action (max 500 sites)
- See validation errors clearly before committing import
- Preview imported data before final save
- Receive confirmation of successful import with count of sites added
- System prevents duplicate site numbers within my property

### 3.2. Secondary Persona: Property Manager Migrating from Legacy System

**Profile:** Operator switching from outdated campground management software

**User Story:**
> As a property manager migrating from an old system, I want to export my existing data and import it into CampOS so that I don't lose any historical site configurations or amenity details.

**Acceptance Criteria:**
- Download CSV template with all supported fields
- Map legacy data fields to CampOS schema
- Import preserves all amenity and pricing data
- Clear documentation of field requirements
- System validates uniqueness of site numbers

### 3.3. Out of Scope for V1: Multi-Property Enterprise Operator

**Deferred to V2:** Enterprise operators managing multiple properties will be able to import separate CSV files per property. For V1, operators with multiple properties must select the property before initiating import (single property per upload session).

---

## 4. Feature Requirements

### 4.1. Functional Requirements

#### FR-1: CSV Upload Interface
- **Location:** Operator Dashboard → Sites Management → "Import Sites" button
- **UI Components:**
  - File upload dropzone (drag-and-drop + click to browse)
  - "Download CSV Template" link with pre-populated example data
  - Upload progress indicator
  - Validation results panel
  - **V1 Limitation:** File size limit message (5MB / ~500 sites)

#### FR-2: CSV Template
- **Must Provide:**
  - Downloadable `.csv` template file with:
    - Header row with all required and optional fields
    - 2-3 example rows with realistic sample data
    - Inline comments/notes about field requirements
  - Documentation page explaining each field in detail
  - **V1 Note:** Template includes warning about 500-row limit

#### FR-3: Data Validation
- **Pre-Import Validation:**
  - Required fields present and non-empty
  - Data types correct (numbers, dates, booleans)
  - **Site numbers unique within property (CRITICAL for V1)**
  - Pricing values valid (positive numbers)
  - Amenity codes recognized (from predefined list)
  - Max occupancy is reasonable integer (1-50)
  - GPS coordinates in valid range (if provided)
  - **Row count ≤ 500 (V1 limit)**

- **Error Reporting:**
  - Display row-by-row validation errors
  - Highlight specific fields causing issues
  - Provide actionable error messages
  - Allow download of error report CSV
  - **Specific error for duplicate site numbers:** "Row X: site_number 'A-101' already exists in this property or appears earlier in this CSV"

#### FR-4: Import Preview
- **Must Show:**
  - Table preview of first 10 rows to be imported
  - Total count of sites to be added
  - Summary of data quality (warnings, if any)
  - "Cancel" and "Confirm Import" buttons

#### FR-5: Import Execution
- **Behavior:**
  - Transactional import (all-or-nothing)
  - If ANY row fails validation, rollback entire import
  - Associate all imported sites with authenticated operator's **property_id**
  - Generate unique internal IDs for each site
  - Preserve import timestamp (in site metadata)
  - **V1 Limitation:** No import history table (deferred to V2)

#### FR-6: Success Confirmation
- **Post-Import:**
  - Success message with count: "Successfully imported 47 sites"
  - Button to "View Sites" (navigate to site list)
  - Option to "Import More" (upload another CSV)
  - **V1 Note:** No email confirmation (deferred to V2)

#### FR-7: Error Handling
- **Failure Scenarios:**
  - File too large (>5MB / >500 rows) → reject with message
  - Invalid file format (not CSV) → reject with message
  - Duplicate site numbers → reject with specific row numbers
  - Server error during import → rollback and show error
  - Network timeout → allow retry with same file

### 4.2. Non-Functional Requirements

#### NFR-1: Performance
- Upload processing completes within 10 seconds for 100 sites
- Support files up to 5MB (~500 sites max for V1)
- No UI freeze during validation (use async processing)

#### NFR-2: Security
- **MUST** validate property isolation (imported sites belong to authenticated user's property only)
- Sanitize all CSV input to prevent XSS injection attacks
- **V1 Scope:** Basic input sanitization only
- **V2 Scope:** Virus scanning, advanced rate limiting (10/hour)
- Use parameterized queries to prevent SQL injection

#### NFR-3: Usability
- Clear, jargon-free error messages
- Mobile-responsive upload interface
- Support drag-and-drop on desktop browsers
- Keyboard accessible (WCAG AA compliance)

#### NFR-4: Data Integrity
- Atomic transactions (all rows succeed or all fail)
- **Database constraint:** UNIQUE (property_id, site_number)
- **V1 Scope:** Basic metadata stored in sites table
- **V2 Scope:** Audit logging via `site_import_history` table, rollback UI

---

## 5. CSV Schema Specification

### 5.1. Required Fields

| Field Name | Type | Description | Example | Validation |
|------------|------|-------------|---------|------------|
| `site_number` | String | Unique site identifier within property | "A-101" | Required, max 20 chars, **unique per property** |
| `site_name` | String | Display name for site | "Lakeside Premium RV" | Required, max 100 chars |
| `site_type` | Enum | Type of site | "rv", "tent", "cabin", "glamping" | Required, must match predefined types |
| `max_occupancy` | Integer | Maximum number of guests | 6 | Required, 1-50 |
| `base_price` | Decimal | Nightly base price in USD | 45.00 | Required, > 0, max 2 decimals |

### 5.2. Optional Fields

| Field Name | Type | Description | Example | Validation |
|------------|------|-------------|---------|------------|
| `description` | Text | Detailed site description | "Full hookup site with lake view..." | Max 1000 chars |
| `amenities` | String (comma-separated) | List of amenity codes | "water,electric,sewer,wifi" | Must match predefined amenity list |
| `length_feet` | Integer | RV pad length in feet | 45 | 10-100 |
| `width_feet` | Integer | RV pad width in feet | 25 | 10-60 |
| `allow_pets` | Boolean | Pets allowed | "true" or "false" | true/false/1/0/yes/no |
| `accessible` | Boolean | ADA accessible | "true" | true/false/1/0/yes/no |
| `latitude` | Decimal | GPS latitude | 45.123456 | -90 to 90, max 6 decimals |
| `longitude` | Decimal | GPS longitude | -122.654321 | -180 to 180, max 6 decimals |
| `status` | Enum | Availability status | "available", "maintenance", "unavailable" | Must match predefined statuses |
| `notes` | Text | Internal operator notes | "Near restroom building" | Max 500 chars |

### 5.3. Example CSV

```csv
site_number,site_name,site_type,max_occupancy,base_price,amenities,length_feet,width_feet,allow_pets,accessible,latitude,longitude,status,notes,description
A-101,Lakeside Premium RV,rv,6,65.00,"water,electric,sewer,wifi",50,30,true,false,45.123456,-122.654321,available,Near lake,"Full hookup RV site with stunning lake views"
A-102,Lakeside Standard RV,rv,4,45.00,"water,electric",40,25,true,false,45.123478,-122.654298,available,,"Standard RV site with partial hookups"
B-201,Forest Tent Site,tent,4,25.00,"water,picnic_table",,,true,false,45.124123,-122.653456,available,Shaded area,"Secluded tent site in the forest"
C-301,Deluxe Cabin,cabin,6,120.00,"water,electric,heating,ac,kitchen",,,false,true,45.125678,-122.652987,maintenance,Needs repair,"Two-bedroom cabin with full amenities"
```

---

## 6. User Flow

### 6.1. Happy Path Flow

1. **Operator navigates to Sites page** in dashboard
2. **Clicks "Import Sites" button** → Upload modal opens
3. **Downloads CSV template** (optional, if first time)
4. **Prepares CSV file** with site data in Excel/Google Sheets (max 500 rows)
5. **Uploads CSV** via drag-and-drop or file browser
6. **System validates** file in real-time (< 3 seconds)
7. **Preview screen shows** first 10 rows + total count
8. **Operator reviews** data and clicks "Confirm Import"
9. **System imports** all sites (progress bar shown)
10. **Success message displays** with count of sites added
11. **Operator clicks "View Sites"** → Redirected to sites list with newly imported sites visible

### 6.2. Error Path Flow

1. **Operator uploads CSV** with validation errors (e.g., duplicate site numbers)
2. **System displays error panel** with:
   - List of errors grouped by row number
   - Specific field and issue description
   - "Download Error Report" button
3. **Operator downloads error CSV** (original data + error column)
4. **Operator fixes errors** in spreadsheet application (e.g., changes "A-101" duplicate to "A-105")
5. **Re-uploads corrected CSV**
6. **System validates successfully** → Proceeds to preview
7. **Import completes** successfully

---

## 7. Technical Implementation Notes

### 7.1. Technology Stack

- **Frontend:**
  - React component for file upload (react-dropzone or Next.js native file input)
  - CSV parsing library: **papaparse** (v5.4.1+)
    - Chosen for: Browser compatibility, simple API, streaming support
    - Alternative considered: csv-parse (more complex, Node.js focused)
  - Table preview component (TanStack Table or Shadcn/UI Table)
  - Form validation (Zod schema matching existing `siteFormSchema`)

- **Backend:**
  - Next.js API Route: `POST /api/dashboard/properties/[id]/sites/import`
  - **REUSE OPPORTUNITY:** Leverage existing bulk insert endpoint at `/api/dashboard/properties/[id]/sites`
    - Existing endpoint already validates duplicates, performs bulk insert, handles authorization
    - CSV import can transform parsed data and POST to this endpoint
    - Reduces implementation complexity by ~30%
  - File upload handling via Next.js `request.formData()` API
  - Supabase bulk insert with explicit transaction wrapper
  - **V1 Note:** Basic request validation only (no advanced rate limiting until V2)

**NPM Dependencies to Add:**
```json
{
  "dependencies": {
    "papaparse": "^5.4.1"
  },
  "devDependencies": {
    "@types/papaparse": "^5.3.8"
  }
}
```

### 7.2. Database Considerations

- **Use explicit database transactions** for atomic imports (all-or-nothing)
  - Wrap Supabase `.insert()` in transaction to guarantee rollback on ANY error
  - Prevent partial imports (e.g., 50/500 rows inserted on failure)
- **Validate property_id on every row insert** (RLS policy enforcement)
- **UNIQUE constraint required:** `(property_id, site_number)` to prevent duplicate site numbers within a property
  - **CRITICAL:** This constraint does not currently exist and must be added via prerequisite migration
  - See Dependencies section (§12.1) for migration details
- Consider batch insert performance (chunk large files into 50-row batches)
- **V1 Scope:** Store basic import metadata in sites table (`imported_at` timestamp, `imported_by` user_id)
- **V2 Scope:** Create dedicated `site_import_history` audit table for detailed tracking

**V1 Database Changes Required:**

**Prerequisite Migration:** `20251031000000_add_site_number_unique_constraint.sql`
- Add UNIQUE constraint on `(property_id, site_number)` columns
- Add optional import tracking columns: `imported_at`, `imported_by`
- Create index for faster duplicate detection: `idx_sites_property_site_number`

**Note:** Migration must be deployed to all environments BEFORE CSV import feature code is deployed. See Dependencies section for details.

### 7.3. API Endpoint Design

**POST /api/dashboard/properties/[id]/sites/import**

Request (multipart/form-data):
```
file: <CSV file>
```

**Authorization Flow:**
1. Extract property ID from URL path parameter `[id]`
2. Validate user owns **company** that owns **property** (company-layer multi-tenancy)
3. Reuse existing authorization pattern from `/api/dashboard/properties/[id]/sites` endpoint
4. Set `property_id` on all imported sites from validated property

**V1 Note:** Single-property imports only. Multi-property enterprise operators must upload separate CSV files per property (multi-property batch import deferred to V2).

Response (success):
```json
{
  "success": true,
  "message": "Successfully imported 47 sites",
  "data": {
    "sites_created": 47,
    "property_id": "uuid-of-operators-property",
    "timestamp": "2025-10-31T12:34:56Z"
  }
}
```

Response (validation errors):
```json
{
  "success": false,
  "message": "Validation errors found in CSV",
  "errors": [
    {
      "row": 3,
      "field": "base_price",
      "value": "-10",
      "message": "Price must be greater than 0"
    },
    {
      "row": 5,
      "field": "site_number",
      "value": "A-101",
      "message": "Duplicate site number 'A-101' already exists in this property (first seen at row 2)"
    },
    {
      "row": 8,
      "field": "site_type",
      "value": "motorhome",
      "message": "Invalid site type. Must be one of: rv, tent, cabin, glamping"
    }
  ]
}
```

Response (file too large):
```json
{
  "success": false,
  "message": "File too large. V1 supports up to 500 sites per import (5MB max).",
  "data": {
    "row_count": 742,
    "limit": 500
  }
}
```

### 7.4. Security Considerations

- **Input Sanitization:** Strip HTML/scripts from all text fields (prevent XSS)
- **Property Isolation:** Enforce property_id from authenticated session (multi-tenant security test required per T-7)
  - **Authorization Chain:** User → Company → Property → Sites
  - Existing RLS policies automatically enforce property isolation
  - Imported sites inherit property_id from validated property
- **File Size Limits:** Reject files > 5MB (server-side validation)
- **Row Count Limits:** Reject files > 500 rows (prevent denial-of-service)
- **SQL Injection Prevention:** Use parameterized queries only (Supabase client handles this)
- **CSV Injection Prevention:** Sanitize formulas in CSV cells (e.g., `=1+1`, `@SUM()`)
- **Encoding Safety:** Handle UTF-8 BOM, non-ASCII characters correctly
- **V1 Scope:** Basic security controls
- **V2 Scope:** Virus scanning (ClamAV), advanced rate limiting (10/hour), CAPTCHA

### 7.5. Alignment with Existing Code

**CRITICAL CODE REUSE OPPORTUNITY:** The codebase already has a bulk site creation endpoint that implements all core validation logic:

**Existing Endpoint:** `/api/dashboard/properties/[id]/sites` (`app/api/dashboard/properties/[id]/sites/route.ts`)
- ✅ Already accepts array of sites (bulk insert capability)
- ✅ Already validates site numbers for duplicates within CSV
- ✅ Already checks existing sites in database for conflicts
- ✅ Already performs bulk insert with Supabase transaction
- ✅ Already validates company → property → user authorization chain
- ✅ Already converts dollars to cents for price storage

**Recommended Implementation Approach:**
```
CSV Upload → Parse with papaparse → Transform to Site[] → POST to existing endpoint → Return results
```

This approach:
- Reduces implementation time by ~30% (from 20-25 hours to 18-24 hours)
- Ensures validation consistency between manual entry and CSV import
- Reduces test surface area (reuse existing endpoint tests)
- Avoids duplicating complex validation logic

**Other Reusable Components:**
- **Validation Schema:** Reuse existing `siteFormSchema` from `components/dashboard/setup-wizard/site-form-schema.ts`
- **Data Transformation:** Reuse existing `toApiFormat()` and `fromApiFormat()` helpers
- **Property Context:** Use existing property resolution middleware
- **RLS Policies:** Leverage existing Row Level Security policies for property isolation
- **Error Handling:** Follow existing API error response format
- **Price Conversion:** Use existing dollar-to-cents conversion pattern (`Math.round(data.base_price * 100)`)

---

## 8. Testing Requirements

### 8.1. Unit Tests (Vitest)

- CSV parser correctly handles various formats (comma, semicolon delimiters)
- Validation logic catches all error conditions
- Field type coercion works correctly (string "true" → boolean true)
- Amenity codes properly split and validated
- Price formatting handles various decimal formats
- **Duplicate site number detection** catches duplicates within CSV and against existing database records

### 8.2. Integration Tests

- Full import flow with valid CSV creates sites in database
- Invalid CSV rejects import and provides error details
- **Property isolation:** Property A cannot import sites that would belong to Property B
- Transaction rollback on any validation error (no partial imports)
- **Unique constraint enforcement:** Database rejects duplicate site_number for same property_id
- Import metadata (imported_at, imported_by) correctly stored

### 8.3. Security Tests (MUST per T-7)

- **Property Isolation Test:** Upload CSV while authenticated as Property A, verify sites only created for Property A's property_id
- **Injection Attack Test:** CSV with SQL injection attempts safely sanitized
- **XSS Test:** CSV with `<script>` tags in description field properly escaped

### 8.4. E2E Tests (Playwright)

- Complete flow: login → navigate to sites → upload CSV → preview → confirm → verify sites appear
- Error handling: upload invalid CSV → see errors → download error report → fix → re-upload → success
- Mobile responsiveness: upload works on mobile viewport
- **Duplicate detection:** Upload CSV with duplicate site_number → see error → fix → retry → success

### 8.5. Performance Tests

- Import 100 sites completes in < 10 seconds
- Import 500 sites completes in < 30 seconds (V1 max)
- Concurrent uploads from multiple properties don't cause conflicts

---

## 9. Success Metrics

### 9.1. Adoption Metrics

- **Target:** 70% of new operators use CSV import within first 7 days
- **Measure:** Track import feature usage in analytics
- **Indicator:** Increased onboarding completion rate

### 9.2. Efficiency Metrics

- **Target:** Average time to populate 50 sites reduces from 45 minutes (manual) to 5 minutes (CSV)
- **Measure:** Time from signup to "first site available for booking"
- **Indicator:** Faster time-to-value for new customers

### 9.3. Quality Metrics

- **Target:** <5% of imports result in errors requiring support intervention
- **Measure:** Support ticket volume related to CSV imports
- **Indicator:** Self-service success rate
- **V1 Metric:** Zero data integrity issues related to duplicate site numbers

### 9.4. Business Impact

- **Target:** 20% improvement in onboarding completion rate (signup → active property)
- **Measure:** Funnel analytics from signup to first booking
- **Indicator:** Reduced churn in onboarding phase

---

## 10. Open Questions & Risks

### 10.1. Open Questions

1. **Should we support updating existing sites via CSV?** (Currently scoped as "create only" for V1, update deferred to V2)
2. **How do we handle site_number conflicts with existing sites?** (V1: Reject entire import; V2: Skip or overwrite options)
3. **Should we auto-generate site_number if not provided?** (V1: No, require explicit site_number; V2: Consider optional auto-generation)
4. **Do we need to support other formats (Excel, JSON)?** (V2 enhancement)

### 10.2. Risks & Mitigation

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Large imports timeout/fail | Medium | Low (500-row limit) | V1: Hard limit at 500 rows; V2: Background job processing |
| Operators upload wrong data | Medium | High | Require preview confirmation before commit |
| CSV format confusion | Medium | High | Provide multiple example CSVs + clear documentation |
| Property isolation bug | Critical | Low | Comprehensive security tests (T-7), code review, use existing property middleware |
| Performance degradation | Low | Low | Load testing, optimize batch inserts, add indexes |
| Duplicate site numbers | High | Medium | **MITIGATED:** Database UNIQUE constraint + validation logic |

---

## 11. Future Enhancements (V2 Scope)

### 11.1. Operational Excellence Features

- **Email Confirmations:** Send import summary email to operator after successful import
- **Import History UI:** Dashboard page showing past imports with metadata (timestamp, user, row count, status)
- **Import History Table:** Dedicated `site_import_history` audit table for compliance/debugging
- **Advanced Rate Limiting:** 10 uploads per hour per property to prevent abuse
- **Virus Scanning:** ClamAV integration for uploaded file security
- **UI-Based Rollback:** One-click undo of most recent import from dashboard

### 11.2. Scale & Enterprise Features

- **Multi-Property Support:** Enterprise operators select which property to import to, or import multiple properties in one CSV (add `property_id` column)
- **Large File Support:** Background job processing for 500+ sites with progress tracking
- **Update Existing Sites:** CSV re-import to update site details (match by site_number)
- **Excel Import:** Support `.xlsx` files directly without CSV conversion
- **Field Mapping UI:** Allow operators to map their CSV columns to CampOS fields (for legacy system migrations)
- **Scheduled Imports:** Automated daily/weekly imports from external URLs (Google Sheets, Dropbox)
- **Import Templates:** Predefined templates for common campground types (RV park, glamping resort, etc.)
- **Import from Legacy Systems:** Pre-built importers for common competitors (Campspot, RMS, etc.)

---

## 12. Dependencies & Constraints

### 12.1. Dependencies

**BLOCKING PREREQUISITES (Must Complete Before Implementation):**

1. **Database Migration (CRITICAL):**
   - Create and deploy migration: `20251031000000_add_site_number_unique_constraint.sql`
   - Migration adds UNIQUE constraint on `(property_id, site_number)`
   - Migration adds optional import metadata columns: `imported_at`, `imported_by`
   - Migration creates index: `idx_sites_property_site_number`
   - **Deployment Order:** Migrate dev → staging → production BEFORE feature code deploy
   - **Risk if skipped:** Database accepts duplicate site numbers, violating data integrity

2. **NPM Dependencies:**
   - Install `papaparse` (v5.4.1+) for CSV parsing
   - Install `@types/papaparse` (v5.3.8+) for TypeScript definitions
   - Update `package.json` before implementation

**Feature Prerequisites:**
- Operator must complete onboarding and have active property account
- Sites database table and RLS policies must be implemented (✅ already exists)
- Amenities taxonomy finalized (predefined list of amenity codes)
- Existing `siteFormSchema` validation available for reuse (✅ already exists)
- Existing bulk insert endpoint `/api/dashboard/properties/[id]/sites` (✅ already exists)

**V2 Prerequisites (Not Required for V1):**
- Email service configured for import confirmation emails
- Background job infrastructure for 500+ row imports
- ClamAV virus scanning service
- Import history audit table

### 12.2. Constraints

- **Technical:** Must work with existing multi-tenant (multi-property) architecture
  - Authorization chain: User → Company → Property → Sites
  - Must reuse existing authorization pattern from bulk insert endpoint
- **Technical:** Must use existing property_id column (not tenant_id) for isolation
- **Technical:** Must convert prices from dollars to cents for database storage (existing convention)
- **Business:** Free trial users limited to 10 sites (CSV import restricted until subscription)
- **UX:** Must be usable on mobile devices (responsive design required)
- **UX:** Must not freeze UI during validation (use async processing or Web Workers)
- **Legal:** Uploaded files must comply with data retention policies (delete after processing)
- **V1 Constraint:** 500-row maximum per import (increased in V2 with background jobs)
- **V1 Constraint:** Single-property imports only (multi-property batch deferred to V2)

---

## 13. Appendix

### 13.1. Glossary

- **Site:** Individual bookable unit (RV pad, tent spot, cabin, etc.)
- **Property:** A campground managed by an operator (equivalent to "tenant" in multi-tenant architecture)
- **Property ID:** Unique identifier for a property in the database (`property_id` column, primary isolation boundary)
- **Tenant:** (Deprecated term) Use "property" instead for consistency with codebase
- **Base Price:** Default nightly rate before dynamic pricing adjustments
- **Amenity:** Feature/service available at a site (water, electric, wifi, etc.)

### 13.2. References

- Linear Issue: [CAM-78](https://linear.app/campgroundops/issue/CAM-78/property-setup-csv-upload-of-property-details)
- Technical Validation Report: `specs/CAM-78-validation-report.md` (Approved with Notes, 75% confidence)
- CLAUDE.md: Testing Best Practices (T-1 through T-11)
- CLAUDE.md: Multi-tenant Security (T-7, D-2, D-3)
- Architecture: Multi-tenant data isolation patterns (company → property → sites)
- Existing Code References:
  - `components/dashboard/setup-wizard/site-form-schema.ts` - Validation schema
  - `app/api/dashboard/properties/[id]/sites/route.ts` - Existing bulk insert endpoint
  - `database/migrations/20250110000000_migrate_money_to_cents.sql` - Price storage in cents
- Validator Feedback: Linear comments (2025-10-31 through 2025-11-01)

---

## 14. Validation History

### 14.1. First Validation (2025-10-31) - NEEDS REVISION

**Blocking Issues Identified:**
1. Data Model Terminology Mismatch (CRITICAL): Used `tenant_id` instead of `property_id`
2. Scope Ambiguity (HIGH): V1 included complex features without clear V1/V2 distinction
3. Missing Data Integrity Constraints (HIGH): No specification for preventing duplicate site numbers

**Non-Blocking Recommendations:**
- Clarify multi-property authorization
- Align CSV schema with existing `siteFormSchema`
- Set explicit row limit

### 14.2. Revision 2.0 (2025-10-31) - Critical Issues Fixed

✅ **Data Model Terminology (CRITICAL):**
- Replaced all `tenant_id` references with `property_id` throughout
- Updated glossary to deprecate "tenant" term in favor of "property"
- Aligned with codebase conventions

✅ **Scope Clarity (HIGH):**
- Created explicit "V1 vs V2 Scope" section (§2)
- Moved complex features to V2 (virus scanning, email confirmations, import history, UI rollback, complex rate limiting)
- Reduced V1 implementation estimate from 45+ hours to 20-25 hours

✅ **Data Integrity (HIGH):**
- Added database UNIQUE constraint specification
- Added duplicate detection validation logic
- Added duplicate error examples in API responses
- Added comprehensive duplicate detection test requirements

✅ **Non-Blocking Recommendations:**
- Clarified single-property scope for V1
- Noted alignment with existing `siteFormSchema`
- Set 500-row maximum for V1

### 14.3. Second Validation (2025-10-31) - APPROVED WITH NOTES ⚠️

**Verdict:** APPROVED with 75% confidence
**Label Changed:** `needs-revision` → `validation-approved`

**Approval Notes:**
1. ✅ All critical blocking issues resolved
2. ⚠️ Prerequisite migration required before implementation (BLOCKING)
3. ⚠️ NPM dependency (papaparse) must be added (BLOCKING)
4. 💡 Excellent code reuse opportunity identified with existing bulk insert endpoint
5. 📊 Revised estimate: 18-24 hours (30% reduction due to code reuse)

**Prerequisites Identified:**
- Create and deploy `20251031000000_add_site_number_unique_constraint.sql` migration
- Install `papaparse` NPM package
- Reuse existing `/api/dashboard/properties/[id]/sites` endpoint

### 14.4. Revision 2.1 (2025-11-01) - Post-Approval Refinements

✅ **Incorporated Validator Approval Notes:**
- Removed SQL migration code from §7.2 (specification-level only)
- Specified `papaparse` as chosen library (not "or csv-parse")
- Added prerequisite migration as BLOCKING dependency in §12.1
- Clarified company-layer authorization flow in §7.3
- Emphasized existing bulk insert endpoint reuse opportunity in §7.5
- Added CSV injection prevention to security considerations
- Updated constraints to include async processing requirement

**Approval Conditions Met:**
1. ✅ Prerequisite migration specified as blocking dependency
2. ✅ papaparse dependency documented in Tech Stack section
3. ✅ Existing bulk insert endpoint reuse emphasized
4. ✅ Security tests for property isolation specified (T-7)
5. ✅ Integration test for transaction rollback specified

---

**Document Status:** Ready for Implementation
**Confidence Level:** 75% (per technical validator)
**Estimated Effort:** 18-24 hours (M - Medium complexity)

**Next Steps:**
1. ✅ PRD validation complete
2. Create and deploy prerequisite database migration
3. Add papaparse to package.json
4. Begin implementation following code reuse approach
5. Implement security and integration tests
6. Track actual time spent vs estimate for future planning

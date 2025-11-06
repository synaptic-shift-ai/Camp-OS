# E2E Tests for Critical User Flows

**Issue**: CAM-143 - Implement E2E Tests for Critical User Flows
**Parent**: CAM-129 - CRITICAL BUG - Middleware hardening
**Priority**: URGENT
**Created**: 2025-11-01

## Overview

This directory contains end-to-end (E2E) tests using Playwright that validate critical user flows through the CampgroundOps middleware system. These tests were created in response to the October 30, 2025 incident where middleware changes caused complete conversion pipeline failure.

## Critical Regression Coverage

The E2E tests specifically validate the flows that broke during the incident:

1. **New User Onboarding Flow**: Signup → Payment → Wizard → Dashboard
   - CRITICAL: Validates wizard access with `?wizard=true` parameter
   - Prevents infinite redirect loops
   - Ensures new customers can complete onboarding after payment

2. **Existing User Login Flow**: Login → Dashboard (no wizard)
   - Validates completed onboarding users go directly to dashboard
   - Ensures wizard access is denied for completed users

3. **Session Persistence**: Login → Refresh → Logout
   - Validates session persistence across page refreshes
   - Ensures tenant context is preserved
   - Validates logout clears session properly

4. **Complete Onboarding Wizard Flow** (Week 6, Phase 2): All 5 wizard steps
   - CRITICAL: Validates October 30 bug fix (`onboarding_completed` field)
   - Tests complete entity fetching (no selective `.select()`)
   - Validates wizard completion and post-completion behavior
   - Ensures v1 Properties API integration (when frontend migrated)

## Test Structure

```
tests/e2e/
├── README.md                                # This file
├── middleware-flows.spec.ts                 # Middleware flow validation (CAM-143)
├── onboarding-wizard-complete.spec.ts       # Complete wizard E2E tests (Week 6, Phase 2)
├── helpers/
│   └── test-data.ts                         # Dynamic test data generators
└── pages/                                   # Page Object Model
    ├── auth.page.ts                         # Authentication flows
    ├── wizard.page.ts                       # Onboarding wizard
    └── dashboard.page.ts                    # Dashboard operations
```

## Week 6 Tests: Onboarding Wizard Complete Flow

**File**: `onboarding-wizard-complete.spec.ts`

**Purpose**: Comprehensive E2E validation of the complete onboarding wizard flow, specifically testing the October 30, 2025 bug fix.

### What These Tests Validate

1. **Complete 5-Step Wizard Flow**
   - Property Details step completion
   - Sites Setup step (with at least one site created)
   - Dashboard Tour step
   - Stripe Connect step (skipped in test env)
   - Review & Launch step with final completion

2. **October 30 Bug Fix Validation** (CRITICAL)
   - Verifies `onboarding_completed` field is set to `true` upon completion
   - Confirms `onboarding_completed_at` timestamp is set
   - Tests that v1 Properties API returns complete entities (all fields)
   - Prevents regression of selective field fetching bug

3. **Complete Entity Fetching** (Regression Prevention)
   - Validates repository always uses `.select('*')`
   - Ensures ALL property fields are present in API responses
   - Tests for presence of 15+ core fields including `wizard_progress`

4. **Wizard State Management**
   - Tests wizard resumption from last incomplete step
   - Validates wizard access denial after completion
   - Ensures proper redirect after completion to `/dashboard?setup=complete`

5. **v1 API Integration** (Frontend Migration Validation)
   - Monitors API calls to verify v1 endpoints are used
   - Detects usage of deprecated endpoints
   - Documents migration status for frontend components

### Key Test Scenarios

| Test | Purpose | Critical Validation |
|------|---------|-------------------|
| Complete 5-step flow | End-to-end wizard | `onboarding_completed = true` |
| Complete entity fetching | Regression test | All fields present in response |
| Resume from incomplete | State persistence | Wizard resumes at correct step |
| v1 API usage | Frontend migration | v1 endpoints called, not deprecated ones |

### Expected Behavior

**Before Completion:**
- Property has `onboarding_completed = false`
- Wizard is accessible at `/dashboard/sites?wizard=true`
- Dashboard redirects to `/onboarding`

**After Completion:**
- Property has `onboarding_completed = true`
- Property has `onboarding_completed_at` timestamp
- Wizard access redirects to `/dashboard`
- Dashboard is fully accessible

## Running Tests

### Local Development (with UI)
```bash
npm run test:e2e:ui
```

### Headless Mode (CI-compatible)
```bash
npm run test:e2e
```

### Headed Mode (visible browser)
```bash
npm run test:e2e:headed
```

### View Test Report
```bash
npm run test:e2e:report
```

## Prerequisites

1. **Local Dev Server**: Tests expect app running at `http://localhost:3000`
   - Automatically started if `webServer` configured in playwright.config.ts
   - Or run manually: `npm run dev`

2. **Supabase Connection**: Tests require valid Supabase connection
   - Ensure `.env.local` has correct Supabase credentials
   - Database should have migrations applied

3. **Stripe Integration** (if testing payment flow):
   - Tests may need Stripe test mode configured
   - Use Stripe test card numbers for payment steps

## Test Data Strategy

**CRITICAL**: All tests follow time-invariant testing practices.

- **NEVER** use hardcoded dates, times, or IDs
- **ALWAYS** use dynamic generation functions from `helpers/test-data.ts`
- **Examples**:
  - `generateTestUser()` - Creates unique user with timestamp
  - `generateTestEmail()` - Creates unique email address
  - `generatePropertyDetails()` - Creates unique property data

This ensures tests remain valid indefinitely without maintenance.

## Page Object Model (POM)

Tests use Page Object Model pattern for maintainability:

### AuthPage
- `navigateToSignup()` - Go to signup page
- `navigateToLogin()` - Go to login page
- `signup(email, password, firstName, lastName)` - Complete signup
- `login(email, password)` - Complete login
- `logout()` - Perform logout
- `isAuthenticated()` - Check auth status

### WizardPage
- `navigateToWizard()` - Go to wizard with `?wizard=true`
- `verifyWizardVisible()` - Assert wizard is accessible
- `completePropertyDetails(details)` - Fill property form
- `clickNext()` - Navigate wizard forward
- `verifyWizardNotAccessible()` - Assert wizard redirects

### DashboardPage
- `navigateToDashboard()` - Go to dashboard
- `verifyOnDashboard()` - Assert on dashboard
- `verifyDashboardAccessible()` - Assert no redirect
- `verifyWizardAccessDenied()` - Assert wizard redirects

## CI/CD Integration

Tests are configured for GitHub Actions CI:

```yaml
# .github/workflows/e2e.yml
- name: Run E2E Tests
  run: npm run test:e2e
  env:
    PLAYWRIGHT_BASE_URL: ${{ secrets.STAGING_URL }}
```

## Debugging Failed Tests

1. **View Screenshots**: Automatically captured on failure in `test-results/`
2. **View Videos**: Captured on failure in `test-results/`
3. **View Traces**: Captured on first retry, open with `npx playwright show-trace`
4. **Run in Headed Mode**: `npm run test:e2e:headed` to watch browser
5. **Use Playwright Inspector**: `npx playwright test --debug`

## Common Issues

### Test Timeout
- Increase timeout in `playwright.config.ts` or individual test
- Check if dev server is running and accessible
- Verify Supabase connection

### Flaky Tests
- Tests should be deterministic with dynamic data
- If flaky, check for race conditions or missing `waitFor` calls
- Run 3x to verify: `npx playwright test --repeat-each=3`

### Authentication Failures
- Verify Supabase auth is configured correctly
- Check `.env.local` has correct credentials
- Ensure email confirmation is disabled for test users

## Success Criteria

All tests must:
- ✅ Pass in headless mode (CI-compatible)
- ✅ Use dynamic test data (no hardcoded values)
- ✅ Follow Page Object Model pattern
- ✅ Capture screenshots/videos on failure
- ✅ Run reliably 3x in a row (no flakiness)

## Related Documentation

- [CAM-143 Linear Issue](https://linear.app/campgroundops/issue/CAM-143)
- [CAM-134 Test Plan](../../tests/middleware/TEST_PLAN.md)
- [CAM-133 Middleware Spec](../../specs/CAM-129-middleware-spec.md)
- [Testing Guidelines](../../.claude/testing-guidelines.md)

## Maintenance

These tests should be updated when:
- Middleware logic changes
- New critical user flows are added
- Auth/onboarding UI changes significantly
- Wizard steps are added/removed

**Owner**: Testing Team
**Last Updated**: 2025-11-01

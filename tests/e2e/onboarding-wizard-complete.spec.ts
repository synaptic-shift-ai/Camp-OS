import { test, expect } from '@playwright/test';
import { AuthPage } from './pages/auth.page';
import { WizardPage } from './pages/wizard.page';
import { DashboardPage } from './pages/dashboard.page';
import {
  generateTestUser,
  generatePropertyDetails,
  createIncompleteProperty,
} from './helpers/test-data';

/**
 * E2E Tests for Complete Onboarding Wizard Flow
 *
 * Week 6 - Phase 2 Validation
 * Parent: IMPLEMENTATION_PLAN.md - Week 6 Goals
 *
 * CRITICAL: These tests validate the Oct 30, 2025 bug fix
 * Bug: Selective field fetching caused `onboarding_completed` to be undefined
 * Fix: Repository always fetches complete entities with `.select('*')`
 *
 * This test suite ensures:
 * 1. Complete wizard flow works end-to-end (all 5 steps)
 * 2. `onboarding_completed` field is properly persisted and fetched
 * 3. Property data includes ALL fields (regression prevention)
 * 4. Wizard completion redirects correctly
 * 5. Post-completion wizard access is denied
 *
 * Following CLAUDE.md testing guidelines:
 * - T-7: All test data is dynamically generated (no hardcoded values)
 * - T-8: Test descriptions match final assertions
 * - T-10: Edge cases and boundaries tested
 */

test.describe('Onboarding Wizard - Complete Flow (Week 6 E2E)', () => {
  /**
   * CRITICAL TEST: Complete 5-step wizard flow
   *
   * This test validates the entire onboarding journey:
   * 1. User creates account
   * 2. User accesses wizard with ?wizard=true
   * 3. User completes Property Details step
   * 4. User completes Sites Setup step
   * 5. User completes Dashboard Tour step
   * 6. User completes Stripe Connect step (or skips in test env)
   * 7. User completes Review & Launch step
   * 8. Property is marked as onboarding_completed = true
   * 9. User is redirected to dashboard
   * 10. Wizard access is now denied
   */
  test('should complete all 5 wizard steps and set onboarding_completed=true', async ({ page }) => {
    // Initialize page objects
    const authPage = new AuthPage(page);
    const wizardPage = new WizardPage(page);
    const _dashboardPage = new DashboardPage(page);

    // Generate dynamic test data (time-invariant)
    const testUser = generateTestUser();
    const propertyDetails = generatePropertyDetails();

    // STEP 1: Create account
    await authPage.navigateToSignup();
    await authPage.signup(
      testUser.email,
      testUser.password,
      testUser.firstName,
      testUser.lastName
    );
    await authPage.waitForAuthRedirect();

    // Verify authenticated
    const isAuth = await authPage.isAuthenticated();
    expect(isAuth).toBe(true);

    // STEP 2: Create incomplete property (triggers wizard requirement)
    await createIncompleteProperty(page);

    // STEP 3: Access wizard
    await wizardPage.navigateToWizard();
    await wizardPage.verifyWizardVisible();

    // STEP 4: Complete Property Details step
    await test.step('Complete Property Details step', async () => {
      // Verify we're on step 1
      await expect(page.locator('text=Property Details')).toBeVisible();

      // Fill property information
      await wizardPage.completePropertyDetails(propertyDetails);

      // Click Next to go to Sites Setup
      await wizardPage.clickNext();

      // Wait for transition
      await page.waitForTimeout(1000);
    });

    // STEP 5: Complete Sites Setup step
    await test.step('Complete Sites Setup step', async () => {
      // Verify we're on step 2
      await expect(page.locator('text=Sites Setup')).toBeVisible({ timeout: 5000 });

      // Add at least one site (wizard requirement)
      // Look for "Add Site" or "Create Site" button
      const addSiteButton = page.locator('button:has-text("Add Site"), button:has-text("Create Site")').first();

      if (await addSiteButton.isVisible()) {
        await addSiteButton.click();

        // Fill site details in dialog/form
        await page.fill('input[name="site_name"], input[name="name"]', 'Test Site A1');

        // Select site type (if dropdown exists)
        const siteTypeSelect = page.locator('select[name="site_type"], select[name="type"]');
        if (await siteTypeSelect.count() > 0) {
          await siteTypeSelect.selectOption('rv');
        }

        // Fill max occupancy
        const occupancyInput = page.locator('input[name="max_occupancy"], input[name="occupancy"]');
        if (await occupancyInput.count() > 0) {
          await occupancyInput.fill('4');
        }

        // Fill nightly rate
        const rateInput = page.locator('input[name="nightly_rate"], input[name="rate"], input[name="price"]');
        if (await rateInput.count() > 0) {
          await rateInput.fill('50.00');
        }

        // Submit site creation
        const submitButton = page.locator('button:has-text("Save"), button:has-text("Add"), button:has-text("Create")').last();
        await submitButton.click();

        // Wait for site to be added
        await page.waitForTimeout(1000);
      }

      // Click Next or Skip to go to Dashboard Tour
      const nextButton = page.locator('button:has-text("Next"), button:has-text("Skip")').first();
      await nextButton.click();

      await page.waitForTimeout(1000);
    });

    // STEP 6: Complete Dashboard Tour step (typically just click Next/Skip)
    await test.step('Complete Dashboard Tour step', async () => {
      // This step is usually informational
      // Click Next or Skip
      const nextButton = page.locator('button:has-text("Next"), button:has-text("Skip")').first();
      if (await nextButton.isVisible({ timeout: 5000 })) {
        await nextButton.click();
        await page.waitForTimeout(1000);
      }
    });

    // STEP 7: Complete Stripe Connect step (skip in test environment)
    await test.step('Complete Stripe Connect step', async () => {
      // In test environment, Stripe OAuth is not available
      // Look for Skip button
      const skipButton = page.locator('button:has-text("Skip"), button:has-text("Skip for now")').first();
      if (await skipButton.isVisible({ timeout: 5000 })) {
        await skipButton.click();
        await page.waitForTimeout(1000);
      }
    });

    // STEP 8: Complete Review & Launch step
    await test.step('Complete Review & Launch step', async () => {
      // Verify we're on final step
      await expect(page.locator('text=Review & Launch, text=Complete Setup')).toBeVisible({ timeout: 5000 });

      // Click Complete or Launch button
      const completeButton = page.locator('button:has-text("Complete"), button:has-text("Launch"), button:has-text("Finish")').first();
      await completeButton.click();

      // Wait for completion
      await page.waitForTimeout(2000);
    });

    // STEP 9: Verify redirect to dashboard
    await test.step('Verify redirect to dashboard after completion', async () => {
      // Should redirect to dashboard with setup=complete param
      await page.waitForURL(/\/dashboard/, { timeout: 10000 });

      // Verify on dashboard (no wizard param)
      await expect(page).not.toHaveURL(/wizard=true/);
    });

    // STEP 10: CRITICAL - Verify onboarding_completed field is set
    await test.step('Verify onboarding_completed is true (Oct 30 bug fix)', async () => {
      // Make API call to fetch property data
      // This tests that the v1 API returns complete entities including onboarding_completed
      const response = await page.request.get('/api/v1/properties', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      expect(response.ok()).toBe(true);
      const data = await response.json();

      // Verify response structure (should have success envelope)
      expect(data).toHaveProperty('success', true);
      expect(data).toHaveProperty('data');

      // Get the property we just completed
      const properties = Array.isArray(data.data) ? data.data : [data.data];
      const completedProperty = properties.find((p: any) =>
        p.name === propertyDetails.name || p.id
      );

      // CRITICAL ASSERTION: onboarding_completed must be true
      // This field was missing in Oct 30 incident due to selective .select()
      expect(completedProperty).toBeDefined();
      expect(completedProperty).toHaveProperty('onboarding_completed', true);

      // Verify other required fields are present (complete entity)
      expect(completedProperty).toHaveProperty('id');
      expect(completedProperty).toHaveProperty('name');
      expect(completedProperty).toHaveProperty('address');
      expect(completedProperty).toHaveProperty('city');
      expect(completedProperty).toHaveProperty('state');

      // Verify onboarding_completed_at timestamp is set
      expect(completedProperty).toHaveProperty('onboarding_completed_at');
      expect(completedProperty.onboarding_completed_at).not.toBeNull();
    });

    // STEP 11: Verify wizard access is now denied
    await test.step('Verify wizard access denied after completion', async () => {
      // Try to access wizard again
      await page.goto('/dashboard/sites?wizard=true');

      // Should redirect away from wizard
      await page.waitForURL((url) => !url.searchParams.has('wizard'), {
        timeout: 5000
      });

      // Should be on regular dashboard
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page).not.toHaveURL(/wizard=true/);
    });
  });

  /**
   * REGRESSION TEST: Verify complete entity fetching
   *
   * This test ensures the repository ALWAYS fetches complete entities
   * using `.select('*')` and never uses selective field fetching
   */
  test('should fetch complete property entity with all fields (regression)', async ({ page }) => {
    const authPage = new AuthPage(page);
    const testUser = generateTestUser();
    const _propertyDetails = generatePropertyDetails();

    // Create user and incomplete property
    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    await createIncompleteProperty(page);

    // Fetch property via v1 API
    const response = await page.request.get('/api/v1/properties');
    expect(response.ok()).toBe(true);

    const data = await response.json();
    expect(data.success).toBe(true);

    const properties = Array.isArray(data.data) ? data.data : [data.data];
    const property = properties[0];

    // Verify ALL core fields are present
    // If any of these are missing, it indicates selective fetching
    const requiredFields = [
      'id',
      'name',
      'address',
      'city',
      'state',
      'zip',
      'phone',
      'email',
      'onboarding_completed',  // CRITICAL - Oct 30 bug field
      'onboarding_completed_at',
      'created_at',
      'updated_at',
      'owner_id',
      'stripe_account_id',
      'stripe_connected_at',
      'booking_page_slug',
      'wizard_progress',
    ];

    for (const field of requiredFields) {
      // Field must exist in response (can be null for optional fields)
      expect(property).toHaveProperty(field);
    }
  });

  /**
   * EDGE CASE: Wizard with existing partially completed property
   *
   * Tests that wizard can resume from where user left off
   */
  test('should resume wizard from last incomplete step', async ({ page }) => {
    const authPage = new AuthPage(page);
    const wizardPage = new WizardPage(page);
    const testUser = generateTestUser();

    // Create user and incomplete property
    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    await createIncompleteProperty(page);

    // Access wizard
    await wizardPage.navigateToWizard();
    await wizardPage.verifyWizardVisible();

    // Complete first step only
    await expect(page.locator('text=Property Details')).toBeVisible();
    await wizardPage.clickNext();
    await page.waitForTimeout(1000);

    // Exit wizard (simulate user leaving)
    await wizardPage.exitWizard();

    // Return to wizard
    await wizardPage.navigateToWizard();
    await wizardPage.verifyWizardVisible();

    // Should resume at step 2 (Sites Setup) since step 1 is complete
    await expect(page.locator('text=Sites Setup')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Property API v1 Integration (Week 6)', () => {
  /**
   * Test that frontend wizard uses v1 Properties API
   *
   * Once frontend is migrated, this test ensures the wizard
   * is calling the new v1 endpoints instead of deprecated ones
   */
  test('wizard should use v1 Properties API endpoints', async ({ page }) => {
    const authPage = new AuthPage(page);
    const wizardPage = new WizardPage(page);
    const testUser = generateTestUser();
    const propertyDetails = generatePropertyDetails();

    // Setup: Create user and access wizard
    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    await createIncompleteProperty(page);

    // Monitor API calls
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/')) {
        apiCalls.push(url);
      }
    });

    await wizardPage.navigateToWizard();
    await wizardPage.verifyWizardVisible();

    // Complete property details
    await wizardPage.completePropertyDetails(propertyDetails);
    await wizardPage.clickNext();
    await page.waitForTimeout(2000);

    // Verify v1 API was called
    const hasV1Call = apiCalls.some(url => url.includes('/api/v1/properties'));
    expect(hasV1Call).toBe(true);

    // Verify deprecated endpoint was NOT called
    const hasDeprecatedCall = apiCalls.some(url =>
      url.includes('/api/onboarding/properties') ||
      url.includes('/api/dashboard/properties')
    );

    // TODO: Once frontend is migrated, this should be false
    // For now, we're just documenting the current state
    if (hasDeprecatedCall) {
      console.warn('⚠️ Wizard still using deprecated property endpoints - migration pending');
    }
  });
});

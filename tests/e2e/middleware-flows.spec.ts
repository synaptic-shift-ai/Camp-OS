import { test, expect } from '@playwright/test';
import { AuthPage } from './pages/auth.page';
import { WizardPage } from './pages/wizard.page';
import { DashboardPage } from './pages/dashboard.page';
import {
  generateTestUser,
  generatePropertyDetails,
  generateCampgroundName,
  createIncompleteProperty,
} from './helpers/test-data';

/**
 * E2E Tests for Critical Middleware User Flows
 *
 * Issue: CAM-143 - Implement E2E Tests for Critical User Flows
 * Parent: CAM-129 - CRITICAL BUG - Middleware hardening
 *
 * CRITICAL REGRESSION COVERAGE:
 * These tests validate the middleware flows that broke in the October 30, 2025 incident.
 * The incident caused infinite redirect loops preventing new users from completing onboarding.
 *
 * Test Flows:
 * 1. New User Onboarding: Signup → Wizard → Dashboard (REGRESSION TEST)
 * 2. Existing User Login: Login → Dashboard (no wizard)
 * 3. Session Persistence: Login → Refresh → Still authenticated
 *
 * IMPORTANT: These tests follow time-invariant testing practices.
 * All test data is dynamically generated - no hardcoded dates, times, or IDs.
 */

test.describe('E2E Flow 1: New User Onboarding (CRITICAL REGRESSION)', () => {
  /**
   * CRITICAL: This test validates the exact flow that broke on Oct 30, 2025
   *
   * Expected flow:
   * 1. User signs up
   * 2. User is redirected to payment/plan selection
   * 3. After payment, user accesses wizard with ?wizard=true
   * 4. User completes wizard steps
   * 5. User gains dashboard access
   * 6. Wizard access is now denied (onboarding complete)
   *
   * Regression: Previously, step 3 redirected to /onboarding in infinite loop
   */
  test('should allow new user to complete signup → wizard → dashboard flow', async ({ page }) => {
    // Initialize page objects
    const authPage = new AuthPage(page);
    const wizardPage = new WizardPage(page);
    const dashboardPage = new DashboardPage(page);

    // Generate dynamic test data (time-invariant)
    const testUser = generateTestUser();
    const propertyDetails = generatePropertyDetails();

    // STEP 1: Navigate to signup
    await authPage.navigateToSignup();

    // STEP 2: Complete registration
    await authPage.signup(
      testUser.email,
      testUser.password,
      testUser.firstName,
      testUser.lastName
    );

    // STEP 3: Wait for auth redirect
    // Could be to email verification, payment, or wizard
    await authPage.waitForAuthRedirect();

    // Verify user is authenticated
    const isAuth = await authPage.isAuthenticated();
    expect(isAuth).toBe(true);

    // STEP 3.5: Create incomplete property to trigger wizard flow
    // This bypasses Stripe payment in test environment
    await createIncompleteProperty(page);

    // STEP 4: Access wizard (CRITICAL - This broke in Oct 30 incident)
    await wizardPage.navigateToWizard();

    // STEP 5: Verify wizard access is granted (NO REDIRECT)
    await wizardPage.verifyWizardVisible();

    // STEP 6: Complete wizard steps
    await wizardPage.completePropertyDetails(propertyDetails);
    await wizardPage.clickNext();

    // Wait for wizard completion
    await page.waitForTimeout(2000);

    // STEP 7: Verify dashboard access granted after wizard completion
    await dashboardPage.verifyDashboardAccessible();

    // STEP 8: Verify wizard access now denied (onboarding complete)
    // This should redirect back to dashboard
    await dashboardPage.verifyWizardAccessDenied();
  });

  test('should redirect to onboarding when accessing dashboard without wizard param before completion', async ({ page }) => {
    const authPage = new AuthPage(page);
    const dashboardPage = new DashboardPage(page);

    // Generate test user
    const testUser = generateTestUser();

    // Signup
    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    // Create incomplete property to trigger onboarding requirement
    await createIncompleteProperty(page);

    // Try to access dashboard directly (no wizard param)
    // Should redirect to /onboarding
    await dashboardPage.verifyRedirectsToOnboarding();
  });

  test('should allow access to /onboarding path with incomplete setup', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Generate test user
    const testUser = generateTestUser();

    // Signup
    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    // Navigate to /onboarding (should be allowed)
    await page.goto('/onboarding');

    // Should stay on /onboarding, not redirect
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 5000 });
  });
});

test.describe('E2E Flow 2: Existing User Login → Dashboard Access', () => {
  /**
   * Test existing users with completed onboarding
   *
   * Expected flow:
   * 1. User logs in
   * 2. User is redirected directly to dashboard
   * 3. Wizard access is denied (redirects to dashboard)
   */

  test('should allow existing user to login and access dashboard directly', async ({ page }) => {
    const authPage = new AuthPage(page);
    const dashboardPage = new DashboardPage(page);

    // For this test, we need an existing user with completed onboarding
    // In a real scenario, this would be seeded data or a user created in a previous test
    // For now, we'll create a user and complete wizard first

    const testUser = generateTestUser();
    const propertyDetails = generatePropertyDetails();

    // Create user and complete onboarding (setup)
    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    // Create incomplete property to trigger wizard flow
    await createIncompleteProperty(page);

    const wizardPage = new WizardPage(page);
    await wizardPage.navigateToWizard();
    await wizardPage.verifyWizardVisible();
    await wizardPage.completePropertyDetails(propertyDetails);
    await wizardPage.clickNext();
    await page.waitForTimeout(2000);

    // Logout
    await authPage.logout();

    // NOW TEST: Login as existing user
    await authPage.navigateToLogin();
    await authPage.login(testUser.email, testUser.password);

    // Should redirect directly to dashboard (no wizard)
    await dashboardPage.verifyDashboardAccessible();

    // Wizard access should be denied
    await dashboardPage.verifyWizardAccessDenied();
  });

  test('should redirect to dashboard if existing user tries to access wizard', async ({ page }) => {
    const authPage = new AuthPage(page);
    const wizardPage = new WizardPage(page);

    // Create user and complete onboarding
    const testUser = generateTestUser();
    const propertyDetails = generatePropertyDetails();

    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    // Create incomplete property to trigger wizard flow
    await createIncompleteProperty(page);

    await wizardPage.navigateToWizard();
    await wizardPage.verifyWizardVisible();
    await wizardPage.completePropertyDetails(propertyDetails);
    await wizardPage.clickNext();
    await page.waitForTimeout(2000);

    // Try to access wizard again (should be denied)
    await wizardPage.verifyWizardNotAccessible();
  });
});

test.describe('E2E Flow 3: Session Persistence and Logout', () => {
  /**
   * Test session management and persistence
   *
   * Expected behaviors:
   * 1. Session persists across page refreshes
   * 2. Tenant context is preserved
   * 3. Logout clears session and redirects to login
   */

  test('should preserve session and tenant context on page refresh', async ({ page }) => {
    const authPage = new AuthPage(page);
    const dashboardPage = new DashboardPage(page);

    // Create and login user
    const testUser = generateTestUser();
    const propertyDetails = generatePropertyDetails();

    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    // Create incomplete property to trigger wizard flow
    await createIncompleteProperty(page);

    const wizardPage = new WizardPage(page);
    await wizardPage.navigateToWizard();
    await wizardPage.verifyWizardVisible();
    await wizardPage.completePropertyDetails(propertyDetails);
    await wizardPage.clickNext();
    await page.waitForTimeout(2000);

    // Verify on dashboard
    await dashboardPage.verifyDashboardAccessible();

    // Refresh page
    await page.reload();

    // Should still be authenticated and on dashboard
    await dashboardPage.verifyOnDashboard();

    const isAuth = await authPage.isAuthenticated();
    expect(isAuth).toBe(true);
  });

  test('should clear session on logout and redirect to login', async ({ page }) => {
    const authPage = new AuthPage(page);
    const dashboardPage = new DashboardPage(page);

    // Create and login user
    const testUser = generateTestUser();
    const propertyDetails = generatePropertyDetails();

    await authPage.navigateToSignup();
    await authPage.signup(testUser.email, testUser.password);
    await authPage.waitForAuthRedirect();

    // Create incomplete property to trigger wizard flow
    await createIncompleteProperty(page);

    const wizardPage = new WizardPage(page);
    await wizardPage.navigateToWizard();
    await wizardPage.verifyWizardVisible();
    await wizardPage.completePropertyDetails(propertyDetails);
    await wizardPage.clickNext();
    await page.waitForTimeout(2000);

    // Verify authenticated
    const isAuthBefore = await authPage.isAuthenticated();
    expect(isAuthBefore).toBe(true);

    // Logout
    await authPage.logout();

    // Should be redirected to login or home
    await expect(page).toHaveURL(/\/(login|$)/);

    // Session should be cleared
    const isAuthAfter = await authPage.isAuthenticated();
    expect(isAuthAfter).toBe(false);

    // Attempting to access dashboard should redirect to login
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });

  test('should redirect to login when accessing protected route without session', async ({ page }) => {
    // Don't login - just try to access protected route
    await page.goto('/dashboard');

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
  });
});

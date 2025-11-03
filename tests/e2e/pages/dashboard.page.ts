import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page Object Model for Dashboard
 *
 * Handles dashboard navigation and verification
 */
export class DashboardPage {
  constructor(private page: Page) {}

  /**
   * Navigate to dashboard
   */
  async navigateToDashboard() {
    await this.page.goto('/dashboard');
  }

  /**
   * Verify user is on dashboard
   * ACTUAL CONTENT from app/dashboard/page.tsx:
   * - Heading: "Dashboard"
   * - Subheading: "Welcome back! Here's what's happening with your property."
   * - Stats cards (revenue, reservations, occupancy, guests)
   */
  async verifyOnDashboard() {
    // Wait for dashboard URL
    await expect(this.page).toHaveURL(/\/dashboard/);

    // Wait for actual dashboard heading to be visible
    await expect(this.page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });

    // Verify welcome message
    await expect(this.page.locator('text=Welcome back')).toBeVisible();
  }

  /**
   * Verify dashboard is accessible (not redirected away)
   */
  async verifyDashboardAccessible() {
    await this.navigateToDashboard();

    // Should stay on dashboard
    await expect(this.page).toHaveURL(/\/dashboard/, { timeout: 5000 });

    // Dashboard content should be visible
    await this.verifyOnDashboard();
  }

  /**
   * Verify dashboard redirects to onboarding (incomplete setup)
   * ACTUAL REDIRECT CHAIN from app/onboarding/page.tsx:
   * - /dashboard → /onboarding → /dashboard/sites?wizard=true
   * So we should check for wizard URL, not /onboarding URL
   */
  async verifyRedirectsToOnboarding() {
    await this.navigateToDashboard();

    // Should redirect to wizard (via onboarding intermediate redirect)
    await this.page.waitForURL(/wizard=true/, { timeout: 10000 });
  }

  /**
   * Get user display name from dashboard (if shown)
   */
  async getUserDisplayName(): Promise<string | null> {
    const userNameElement = this.page.locator(
      '[data-testid="user-name"], .user-display-name, .user-profile-name'
    ).first();

    if (await userNameElement.count() === 0) {
      return null;
    }

    return await userNameElement.textContent();
  }

  /**
   * Verify wizard access is denied (redirects to dashboard)
   * ACTUAL WIZARD URL: /dashboard/sites?wizard=true (NOT /dashboard?wizard=true)
   */
  async verifyWizardAccessDenied() {
    // Try to access wizard at its actual location
    await this.page.goto('/dashboard/sites?wizard=true');

    // Should redirect to dashboard without wizard parameter
    await this.page.waitForURL((url) => {
      return url.pathname.includes('/dashboard') && !url.searchParams.has('wizard');
    }, { timeout: 5000 });
  }

  /**
   * Check if onboarding is complete
   */
  async isOnboardingComplete(): Promise<boolean> {
    // Navigate to dashboard and check if redirected
    await this.page.goto('/dashboard');

    // Wait a moment for potential redirect
    await this.page.waitForTimeout(2000);

    // If still on dashboard, onboarding is complete
    const url = this.page.url();
    return url.includes('/dashboard') && !url.includes('/onboarding');
  }
}

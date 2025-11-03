import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page Object Model for Onboarding Wizard
 *
 * Handles wizard navigation and form completion
 */
export class WizardPage {
  constructor(private page: Page) {}

  /**
   * Navigate to wizard with explicit wizard parameter
   * CRITICAL: This tests the Oct 30 incident fix - wizard access must work
   * ACTUAL BEHAVIOR from app/onboarding/page.tsx:
   * - /onboarding redirects to /dashboard/sites?wizard=true
   * - /dashboard?wizard=true is NOT a valid route
   * - Wizard is actually at /dashboard/sites?wizard=true
   */
  async navigateToWizard() {
    // Navigate to onboarding which auto-redirects to wizard
    await this.page.goto('/onboarding');

    // Wait for redirect to complete
    await this.page.waitForURL(/\/dashboard\/sites\?wizard=true/, { timeout: 10000 });
  }

  /**
   * Verify wizard is accessible and visible
   * ACTUAL ELEMENTS from components/dashboard/setup-wizard/wizard-container.tsx:
   * - Heading: "Property Setup Wizard"
   * - "Exit Setup" button exists
   * - URL pattern: /dashboard/sites?wizard=true&step={stepId}
   */
  async verifyWizardVisible() {
    // Wait for wizard heading to be visible
    await expect(this.page.locator('h1:has-text("Property Setup Wizard")')).toBeVisible({ timeout: 10000 });

    // Verify "Exit Setup" button exists
    await expect(this.page.locator('button:has-text("Exit Setup")')).toBeVisible();

    // Verify URL contains wizard parameter
    await expect(this.page).toHaveURL(/wizard=true/);
  }

  /**
   * Complete property details step
   */
  async completePropertyDetails(details: {
    name: string;
    address: string;
    city: string;
    state: string;
    zip: string;
    phone?: string;
  }) {
    // Fill property name
    const nameInput = this.page.locator('input[name="name"], input[name="property_name"]');
    await nameInput.fill(details.name);

    // Fill address
    const addressInput = this.page.locator('input[name="address"]');
    await addressInput.fill(details.address);

    // Fill city
    const cityInput = this.page.locator('input[name="city"]');
    await cityInput.fill(details.city);

    // Fill state (could be select or input)
    const stateField = this.page.locator('input[name="state"], select[name="state"]');
    await stateField.fill(details.state);

    // Fill zip
    const zipInput = this.page.locator('input[name="zip"], input[name="postal_code"]');
    await zipInput.fill(details.zip);

    // Fill phone if provided
    if (details.phone) {
      const phoneInput = this.page.locator('input[name="phone"]');
      if (await phoneInput.count() > 0) {
        await phoneInput.fill(details.phone);
      }
    }
  }

  /**
   * Click next button in wizard
   * ACTUAL BUTTON from wizard-container.tsx line 319:
   * - Button text: "Next" with ArrowRight icon
   */
  async clickNext() {
    const nextButton = this.page.locator('button:has-text("Next")');
    await nextButton.click();
  }

  /**
   * Click previous button in wizard
   * ACTUAL BUTTON from wizard-container.tsx line 307:
   * - Button text: "Previous" with ArrowLeft icon
   * - Disabled on first step
   */
  async clickBack() {
    const backButton = this.page.locator('button:has-text("Previous")');
    await backButton.click();
  }

  /**
   * Exit wizard
   * ACTUAL BUTTON from wizard-container.tsx line 205:
   * - Button text: "Exit Setup" with ArrowLeft icon
   */
  async exitWizard() {
    const exitButton = this.page.locator('button:has-text("Exit Setup")');
    await exitButton.click();

    // Should redirect to dashboard
    await this.page.waitForURL(/\/dashboard$/, { timeout: 5000 });
  }

  /**
   * Complete entire wizard flow
   * NOTE: This is a simplified version - adjust based on actual wizard steps
   */
  async completeWizard(propertyDetails: any) {
    // Step 1: Property Details
    await this.completePropertyDetails(propertyDetails);
    await this.clickNext();

    // Wait for wizard completion or next step
    // Adjust based on actual wizard flow
    await this.page.waitForTimeout(1000);

    // If there are more steps, add them here
    // For now, assume simple wizard
  }

  /**
   * Verify wizard is NOT accessible (should redirect)
   */
  async verifyWizardNotAccessible() {
    await this.navigateToWizard();

    // Should redirect away from wizard
    await this.page.waitForURL((url) => !url.searchParams.has('wizard'), {
      timeout: 5000
    });

    // Should be on dashboard or another page
    await expect(this.page).not.toHaveURL(/wizard=true/);
  }

  /**
   * Get current wizard step number (if displayed)
   */
  async getCurrentStep(): Promise<number | null> {
    const stepIndicator = this.page.locator('[data-testid="wizard-step"], .wizard-step-number');

    if (await stepIndicator.count() === 0) {
      return null;
    }

    const stepText = await stepIndicator.textContent();
    const match = stepText?.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }
}

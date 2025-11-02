import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Page Object Model for Authentication flows
 *
 * Provides reusable methods for signup, login, and logout operations
 */
export class AuthPage {
  constructor(private page: Page) {}

  /**
   * Navigate to signup page
   */
  async navigateToSignup() {
    await this.page.goto('/signup');
    await expect(this.page).toHaveURL(/\/signup/);
  }

  /**
   * Navigate to login page
   */
  async navigateToLogin() {
    await this.page.goto('/login');
    await expect(this.page).toHaveURL(/\/login/);
  }

  /**
   * Fill and submit signup form
   * ACTUAL FORM FIELDS from components/signup-client.tsx:
   * - id="companyName" (required)
   * - id="fullName" (required)
   * - id="email" (required)
   * - id="password" (required)
   * - id="confirmPassword" (required)
   */
  async signup(email: string, password: string, companyName: string = 'Test Company', fullName: string = 'Test User') {
    // Wait for signup form to be visible
    await this.page.waitForSelector('form', { state: 'visible' });

    // Fill company name (ACTUAL FIELD from signup form)
    await this.page.locator('input#companyName').fill(companyName);

    // Fill full name (ACTUAL FIELD from signup form)
    await this.page.locator('input#fullName').fill(fullName);

    // Fill email (ACTUAL FIELD from signup form)
    await this.page.locator('input#email').fill(email);

    // Fill password (ACTUAL FIELD - uses ID to avoid ambiguity)
    await this.page.locator('input#password').fill(password);

    // Fill confirm password (ACTUAL FIELD - required in signup form)
    await this.page.locator('input#confirmPassword').fill(password);

    // Submit form - button text is "Create Account"
    const submitButton = this.page.locator('button[type="submit"]:has-text("Create Account")');
    await submitButton.click();
  }

  /**
   * Fill and submit login form
   * ACTUAL FORM FIELDS from app/(auth)/login/page.tsx:
   * - id="email" (type="email")
   * - id="password" (type="password")
   * Submit button text: "Sign In"
   */
  async login(email: string, password: string) {
    // Wait for login form to be visible
    await this.page.waitForSelector('form', { state: 'visible' });

    // Fill email (ACTUAL FIELD from login form)
    await this.page.locator('input#email').fill(email);

    // Fill password (ACTUAL FIELD from login form)
    await this.page.locator('input#password').fill(password);

    // Submit form - button text is "Sign In"
    const submitButton = this.page.locator('button[type="submit"]:has-text("Sign In")');
    await submitButton.click();
  }

  /**
   * Perform logout from dashboard
   * ACTUAL LOCATION: app/dashboard/layout.tsx lines 114-117
   * - DropdownMenu triggered by Avatar button in sidebar
   * - Menu item text: "Log out"
   * WARNING: Current implementation has NO onClick handler - this is an app bug
   * For testing, we'll click the menu item and expect proper logout implementation
   */
  async logout() {
    // Open the user dropdown menu (Avatar button in sidebar)
    const userMenuTrigger = this.page.locator('button:has(div:has-text("Owner"))').first();
    await userMenuTrigger.click();

    // Click "Log out" menu item
    const logoutMenuItem = this.page.locator('role=menuitem[name="Log out"]');
    await logoutMenuItem.click();

    // Verify redirected to login or home
    await this.page.waitForURL(/\/(login|$)/, { timeout: 5000 });
  }

  /**
   * Wait for authentication to complete and redirect
   */
  async waitForAuthRedirect(timeout: number = 10000) {
    // Wait for URL to change from auth pages
    await this.page.waitForURL((url) => {
      return !url.pathname.includes('/login') && !url.pathname.includes('/signup');
    }, { timeout });
  }

  /**
   * Check if user is authenticated (has auth cookies/session)
   */
  async isAuthenticated(): Promise<boolean> {
    // Check for common auth indicators
    const cookies = await this.page.context().cookies();
    const hasAuthCookie = cookies.some(cookie =>
      cookie.name.includes('auth') ||
      cookie.name.includes('session') ||
      cookie.name.includes('supabase')
    );

    return hasAuthCookie;
  }
}

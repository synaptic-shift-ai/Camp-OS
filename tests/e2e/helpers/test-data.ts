/**
 * E2E Test Data Helpers
 *
 * CRITICAL: These helpers generate dynamic test data following time-invariant testing practices.
 * NEVER use hardcoded dates, times, or IDs that will break over time.
 *
 * See: .claude/testing-guidelines.md for comprehensive guidance
 */

import type { Page } from '@playwright/test';

/**
 * Generate a unique test email address
 * Uses timestamp to ensure uniqueness across test runs
 */
export function generateTestEmail(prefix: string = 'test'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}-${timestamp}-${random}@example.com`;
}

/**
 * Generate a unique test user
 */
export function generateTestUser() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return {
    email: generateTestEmail('e2e-user'),
    password: `TestPassword${timestamp}!`,
    firstName: `Test${random}`,
    lastName: `User${timestamp}`,
  };
}

/**
 * Generate a unique campground/company name
 */
export function generateCampgroundName(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `Test Campground ${random}-${timestamp}`;
}

/**
 * Generate test property details for wizard
 */
export function generatePropertyDetails() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return {
    name: `Test Property ${random}`,
    address: `${timestamp} Test Street`,
    city: 'Test City',
    state: 'CA',
    zip: '90210',
    phone: '555-0100',
  };
}

/**
 * Wait for a specific time (use sparingly, prefer waitFor conditions)
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create an incomplete property for testing wizard flow
 *
 * CRITICAL: This bypasses the Stripe payment flow to create test properties
 * that trigger the onboarding wizard. Only works in non-production environments.
 *
 * @param page - Playwright page with authenticated session
 * @returns Property ID of the created incomplete property
 * @throws Error if API call fails or returns non-201 status
 */
export async function createIncompleteProperty(page: Page): Promise<string> {
  // Get base URL from page's current origin
  const baseURL = new URL(page.url()).origin;

  // Make authenticated API call using page context
  const response = await page.request.post(`${baseURL}/api/test/create-incomplete-property`);

  if (!response.ok()) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create incomplete property: ${response.status()} - ${errorText}`
    );
  }

  const data = await response.json();

  if (!data.propertyId) {
    throw new Error('API response missing propertyId');
  }

  return data.propertyId;
}

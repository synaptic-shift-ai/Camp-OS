/**
 * Test Utilities for Dynamic ID Generation
 *
 * CRITICAL: Never use hardcoded IDs in tests!
 * See .claude/testing-guidelines.md for comprehensive guidance.
 */

import { randomUUID } from 'crypto'

/**
 * Generate a unique test ID with optional prefix
 * @param prefix - Optional prefix for the ID (e.g., 'site', 'property', 'guest')
 * @returns Unique ID string
 */
export function testId(prefix?: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 7)
  const id = `${timestamp}-${random}`
  return prefix ? `${prefix}-${id}` : id
}

/**
 * Generate a UUID for test data
 * @returns UUID string
 */
export function testUUID(): string {
  return randomUUID()
}

/**
 * Generate multiple unique test IDs
 * @param count - Number of IDs to generate
 * @param prefix - Optional prefix for the IDs
 * @returns Array of unique ID strings
 */
export function testIds(count: number, prefix?: string): string[] {
  return Array.from({ length: count }, () => testId(prefix))
}

/**
 * Generate multiple UUIDs for test data
 * @param count - Number of UUIDs to generate
 * @returns Array of UUID strings
 */
export function testUUIDs(count: number): string[] {
  return Array.from({ length: count }, () => testUUID())
}

/**
 * Generate a test property ID
 */
export function testPropertyId(): string {
  return testUUID()
}

/**
 * Generate a test site ID
 */
export function testSiteId(): string {
  return testUUID()
}

/**
 * Generate a test guest ID
 */
export function testGuestId(): string {
  return testUUID()
}

/**
 * Generate a test reservation ID
 */
export function testReservationId(): string {
  return testUUID()
}

/**
 * Generate a test confirmation number
 * Format: TEST-YYYY-XXXXXX
 */
export function testConfirmationNumber(): string {
  const year = new Date().getFullYear()
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `TEST-${year}-${random}`
}

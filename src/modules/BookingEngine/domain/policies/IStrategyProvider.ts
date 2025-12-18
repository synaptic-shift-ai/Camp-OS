/**
 * Strategy Provider Interface
 *
 * Resolves which pricing strategies, confirmation policies,
 * and price adjustments to use for a given property.
 *
 * The provider abstracts away the configuration lookup,
 * allowing the application layer to simply request the
 * appropriate strategy without knowing how it's resolved.
 *
 * Implementations might:
 * - Read from property settings in the database
 * - Use a registry of available strategies
 * - Apply default strategies with property overrides
 * - Support A/B testing different strategies
 */

import type { IConfirmationPolicy } from './IConfirmationPolicy'
import type { IPricingStrategy } from './IPricingStrategy'
import type { IPriceAdjustment } from './IPriceAdjustment'

/**
 * Property-level configuration for strategies
 * Stored in property settings, resolved by provider
 */
export interface PropertyStrategyConfig {
  propertyId: string

  // Confirmation policy configuration
  confirmationPolicy: {
    type: 'full_payment' | 'minimum_deposit' | 'no_payment' | 'custom'
    minimumDepositPercent?: number
    customPolicyId?: string
  }

  // Pricing strategy configuration
  pricingStrategy: {
    type: 'standard' | 'seasonal' | 'demand_based' | 'custom'
    customStrategyId?: string
  }

  // Enabled adjustments (applied in priority order)
  enabledAdjustments: Array<{
    type: string
    enabled: boolean
    config?: Record<string, unknown>
  }>
}

/**
 * Strategy provider interface
 */
export interface IStrategyProvider {
  /**
   * Get the confirmation policy for a property
   *
   * @param propertyId - The property to get policy for
   * @returns The configured confirmation policy
   */
  getConfirmationPolicy(propertyId: string): Promise<IConfirmationPolicy>

  /**
   * Get the pricing strategy for a property
   *
   * @param propertyId - The property to get strategy for
   * @returns The configured pricing strategy
   */
  getPricingStrategy(propertyId: string): Promise<IPricingStrategy>

  /**
   * Get all applicable price adjustments for a property
   * Returns adjustments in priority order
   *
   * @param propertyId - The property to get adjustments for
   * @returns Array of enabled adjustments
   */
  getPriceAdjustments(propertyId: string): Promise<IPriceAdjustment[]>

  /**
   * Get the full strategy configuration for a property
   * Useful for admin interfaces
   *
   * @param propertyId - The property to get config for
   * @returns The complete configuration
   */
  getPropertyConfig(propertyId: string): Promise<PropertyStrategyConfig>
}

/**
 * Strategy registry interface
 *
 * Manages available strategy implementations.
 * Used by the provider to instantiate strategies by type.
 */
export interface IStrategyRegistry {
  /**
   * Register a confirmation policy implementation
   */
  registerConfirmationPolicy(
    type: string,
    factory: () => IConfirmationPolicy
  ): void

  /**
   * Register a pricing strategy implementation
   */
  registerPricingStrategy(
    type: string,
    factory: () => IPricingStrategy
  ): void

  /**
   * Register a price adjustment implementation
   */
  registerPriceAdjustment(
    type: string,
    factory: (config?: Record<string, unknown>) => IPriceAdjustment
  ): void

  /**
   * Get a registered confirmation policy by type
   */
  getConfirmationPolicy(type: string): IConfirmationPolicy | undefined

  /**
   * Get a registered pricing strategy by type
   */
  getPricingStrategy(type: string): IPricingStrategy | undefined

  /**
   * Get a registered price adjustment by type
   */
  getPriceAdjustment(
    type: string,
    config?: Record<string, unknown>
  ): IPriceAdjustment | undefined

  /**
   * List all registered policy/strategy types
   */
  listAvailableTypes(): {
    confirmationPolicies: string[]
    pricingStrategies: string[]
    priceAdjustments: string[]
  }
}

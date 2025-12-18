/**
 * Default Strategy Provider
 *
 * Simple implementation that uses configured defaults.
 * In production, this would read from property settings.
 *
 * For now, provides sensible defaults:
 * - Confirmation: MinimumDepositPolicy (25%)
 * - Pricing: Not implemented yet (uses existing lib/booking/pricing)
 * - Adjustments: None enabled by default
 */

import type {
  IStrategyProvider,
  PropertyStrategyConfig,
  IConfirmationPolicy,
  IPricingStrategy,
  IPriceAdjustment,
} from '../domain/policies'
import {
  FullPaymentPolicy,
  MinimumDepositPolicy,
  NoPaymentPolicy,
} from '../domain/policies/implementations'

/**
 * Policy type constants
 */
export const ConfirmationPolicyType = {
  FULL_PAYMENT: 'full_payment',
  MINIMUM_DEPOSIT: 'minimum_deposit',
  NO_PAYMENT: 'no_payment',
} as const

export type ConfirmationPolicyTypeName =
  (typeof ConfirmationPolicyType)[keyof typeof ConfirmationPolicyType]

/**
 * Default configuration for new properties
 */
export const DEFAULT_PROPERTY_CONFIG: Omit<PropertyStrategyConfig, 'propertyId'> = {
  confirmationPolicy: {
    type: 'minimum_deposit',
    minimumDepositPercent: 25,
  },
  pricingStrategy: {
    type: 'standard',
  },
  enabledAdjustments: [],
}

/**
 * Default strategy provider implementation
 *
 * Currently uses in-memory defaults. Future implementation
 * will read from property_settings table in database.
 */
export class DefaultStrategyProvider implements IStrategyProvider {
  private propertyConfigs = new Map<string, PropertyStrategyConfig>()

  /**
   * Configure a property's strategies
   * In production, this would be persisted to database
   */
  configureProperty(config: PropertyStrategyConfig): void {
    this.propertyConfigs.set(config.propertyId, config)
  }

  async getConfirmationPolicy(propertyId: string): Promise<IConfirmationPolicy> {
    const config = await this.getPropertyConfig(propertyId)

    switch (config.confirmationPolicy.type) {
      case 'full_payment':
        return new FullPaymentPolicy()

      case 'minimum_deposit':
        return new MinimumDepositPolicy({
          minimumDepositPercent: config.confirmationPolicy.minimumDepositPercent ?? 25,
        })

      case 'no_payment':
        return new NoPaymentPolicy()

      case 'custom':
        // Future: load custom policy by ID
        throw new Error('Custom policies not yet implemented')

      default:
        // Default to minimum deposit
        return new MinimumDepositPolicy({ minimumDepositPercent: 25 })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPricingStrategy(propertyId: string): Promise<IPricingStrategy> {
    // Not implemented yet - pricing still uses existing lib/booking/pricing
    throw new Error(
      'Pricing strategies not yet implemented. Use existing lib/booking/pricing module.'
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getPriceAdjustments(propertyId: string): Promise<IPriceAdjustment[]> {
    // No adjustments enabled by default
    return []
  }

  async getPropertyConfig(propertyId: string): Promise<PropertyStrategyConfig> {
    // Return configured config or defaults
    const config = this.propertyConfigs.get(propertyId)
    if (config) {
      return config
    }

    // Return default config
    return {
      propertyId,
      ...DEFAULT_PROPERTY_CONFIG,
    }
  }
}

/**
 * Singleton instance for simple use cases
 */
export const defaultStrategyProvider = new DefaultStrategyProvider()

/**
 * StripeConnectInfo Value Object
 *
 * Encapsulates Stripe Connect account information for a property.
 * Immutable value object.
 *
 * @example
 * ```typescript
 * const stripeInfo = StripeConnectInfo.create('acct_123', new Date())
 * if (stripeInfo.isConnected()) {
 *   // Accept payments
 * }
 * ```
 */
import { ValueObject } from '@/shared/domain'

type StripeConnectInfoProps = {
  accountId: string | null
  connectedAt: Date | null
}

export class StripeConnectInfo extends ValueObject<StripeConnectInfoProps> {
  private constructor(props: StripeConnectInfoProps) {
    super(props)
  }

  /**
   * Create StripeConnectInfo with account details
   */
  static create(accountId: string, connectedAt: Date): StripeConnectInfo {
    if (!accountId || accountId.trim().length === 0) {
      throw new Error('Stripe account ID is required')
    }

    return new StripeConnectInfo({
      accountId: accountId.trim(),
      connectedAt,
    })
  }

  /**
   * Create StripeConnectInfo for not-yet-connected property
   */
  static notConnected(): StripeConnectInfo {
    return new StripeConnectInfo({
      accountId: null,
      connectedAt: null,
    })
  }

  get accountId(): string | null {
    return this.props.accountId
  }

  get connectedAt(): Date | null {
    return this.props.connectedAt
  }

  /**
   * Check if Stripe Connect is set up
   */
  isConnected(): boolean {
    return this.props.accountId !== null
  }

  /**
   * Get days since connection
   */
  getDaysSinceConnection(): number | null {
    if (!this.props.connectedAt) {
      return null
    }

    const now = new Date()
    const diffMs = now.getTime() - this.props.connectedAt.getTime()
    return Math.floor(diffMs / (1000 * 60 * 60 * 24))
  }
}

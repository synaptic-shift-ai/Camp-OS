/**
 * OnboardingToken Value Object
 *
 * Represents a token used for inviting users to join a company.
 * Tokens have an expiration time and can only be used once.
 */

import { ValueObject } from '@/shared/domain/ValueObject'

interface OnboardingTokenProps {
  value: string
  expiresAt: Date
  usedAt: Date | null
}

export class OnboardingToken extends ValueObject<OnboardingTokenProps> {
  private static readonly TOKEN_EXPIRY_HOURS = 72 // 3 days
  private static readonly TOKEN_LENGTH = 32

  /**
   * Get the token value
   */
  get value(): string {
    return this.props.value
  }

  /**
   * Get the expiration date
   */
  get expiresAt(): Date {
    return this.props.expiresAt
  }

  /**
   * Get the date when the token was used (if used)
   */
  get usedAt(): Date | null {
    return this.props.usedAt
  }

  /**
   * Generate a new onboarding token with default expiry
   *
   * @returns OnboardingToken instance
   */
  public static generate(): OnboardingToken {
    const token = OnboardingToken.generateSecureToken()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + OnboardingToken.TOKEN_EXPIRY_HOURS)

    return new OnboardingToken({
      value: token,
      expiresAt,
      usedAt: null,
    })
  }

  /**
   * Generate a new token with custom expiry
   *
   * @param expiryHours - Number of hours until expiry
   * @returns OnboardingToken instance
   */
  public static generateWithExpiry(expiryHours: number): OnboardingToken {
    const token = OnboardingToken.generateSecureToken()
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiryHours)

    return new OnboardingToken({
      value: token,
      expiresAt,
      usedAt: null,
    })
  }

  /**
   * Reconstitute from persistence
   *
   * @param value - Token string
   * @param expiresAt - Expiration date
   * @param usedAt - Date when used (if used)
   * @returns OnboardingToken instance
   */
  public static fromPersistence(
    value: string,
    expiresAt: Date,
    usedAt: Date | null
  ): OnboardingToken {
    return new OnboardingToken({ value, expiresAt, usedAt })
  }

  /**
   * Check if the token is still valid (not expired and not used)
   */
  get isValid(): boolean {
    return !this.isExpired && !this.isUsed
  }

  /**
   * Check if the token has expired
   */
  get isExpired(): boolean {
    return new Date() > this.props.expiresAt
  }

  /**
   * Check if the token has been used
   */
  get isUsed(): boolean {
    return this.props.usedAt !== null
  }

  /**
   * Create a new token marked as used
   *
   * @returns New OnboardingToken instance marked as used
   */
  public markAsUsed(): OnboardingToken {
    if (this.isUsed) {
      throw new Error('Token has already been used')
    }
    if (this.isExpired) {
      throw new Error('Token has expired')
    }

    return new OnboardingToken({
      value: this.props.value,
      expiresAt: this.props.expiresAt,
      usedAt: new Date(),
    })
  }

  /**
   * Generate a cryptographically secure random token
   */
  private static generateSecureToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    const randomValues = new Uint8Array(OnboardingToken.TOKEN_LENGTH)
    crypto.getRandomValues(randomValues)

    for (let i = 0; i < OnboardingToken.TOKEN_LENGTH; i++) {
      const randomValue = randomValues[i]!
      result += chars.charAt(randomValue % chars.length)
    }

    return result
  }

  public override toString(): string {
    return this.props.value
  }
}

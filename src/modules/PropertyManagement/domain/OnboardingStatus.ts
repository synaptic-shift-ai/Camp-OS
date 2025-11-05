/**
 * OnboardingStatus Enum
 *
 * Represents the state of property onboarding. Used to track progress
 * through the multi-step onboarding wizard.
 *
 * Following ADR-001: Explicit Wizard State Management
 */

export enum OnboardingStatus {
  /**
   * Initial state - property created but onboarding not started
   */
  NOT_STARTED = 'not_started',

  /**
   * Step 1: Basic property information entered
   */
  BASIC_INFO_COMPLETE = 'basic_info_complete',

  /**
   * Step 2: Stripe Connect account setup in progress
   */
  STRIPE_CONNECTING = 'stripe_connecting',

  /**
   * Step 3: Stripe Connect completed
   */
  STRIPE_CONNECTED = 'stripe_connected',

  /**
   * Step 4: Sites configured
   */
  SITES_CONFIGURED = 'sites_configured',

  /**
   * Final state: All onboarding steps completed
   * This corresponds to onboarding_completed = true in database
   */
  COMPLETED = 'completed',
}

/**
 * Check if onboarding is complete
 */
export function isOnboardingComplete(status: OnboardingStatus): boolean {
  return status === OnboardingStatus.COMPLETED
}

/**
 * Get the next onboarding step
 */
export function getNextOnboardingStep(
  currentStatus: OnboardingStatus
): OnboardingStatus | null {
  switch (currentStatus) {
    case OnboardingStatus.NOT_STARTED:
      return OnboardingStatus.BASIC_INFO_COMPLETE
    case OnboardingStatus.BASIC_INFO_COMPLETE:
      return OnboardingStatus.STRIPE_CONNECTING
    case OnboardingStatus.STRIPE_CONNECTING:
      return OnboardingStatus.STRIPE_CONNECTED
    case OnboardingStatus.STRIPE_CONNECTED:
      return OnboardingStatus.SITES_CONFIGURED
    case OnboardingStatus.SITES_CONFIGURED:
      return OnboardingStatus.COMPLETED
    case OnboardingStatus.COMPLETED:
      return null // No next step
    default:
      return null
  }
}

/**
 * Get human-readable label for status
 */
export function getOnboardingStatusLabel(status: OnboardingStatus): string {
  switch (status) {
    case OnboardingStatus.NOT_STARTED:
      return 'Not Started'
    case OnboardingStatus.BASIC_INFO_COMPLETE:
      return 'Basic Info Complete'
    case OnboardingStatus.STRIPE_CONNECTING:
      return 'Connecting Stripe'
    case OnboardingStatus.STRIPE_CONNECTED:
      return 'Stripe Connected'
    case OnboardingStatus.SITES_CONFIGURED:
      return 'Sites Configured'
    case OnboardingStatus.COMPLETED:
      return 'Completed'
    default:
      return 'Unknown'
  }
}

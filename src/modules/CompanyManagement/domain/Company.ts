/**
 * Company Aggregate Root
 *
 * Represents a company (tenant) in the SaaS platform.
 * Encapsulates all business logic related to company and subscription management.
 */

import { AggregateRoot } from '@/shared/domain/AggregateRoot'
import { CompanyName } from './value-objects/CompanyName'
import { SubscriptionPlan } from './value-objects/SubscriptionPlan'
import { SubscriptionStatus } from './value-objects/SubscriptionStatus'
import { BillingCycle } from './value-objects/BillingCycle'
import { OnboardingToken } from './value-objects/OnboardingToken'
import { CompanyCreatedEvent } from './events/CompanyCreatedEvent'
import { CompanyUpdatedEvent } from './events/CompanyUpdatedEvent'
import { SubscriptionActivatedEvent } from './events/SubscriptionActivatedEvent'
import { SubscriptionCancelledEvent } from './events/SubscriptionCancelledEvent'
import { SubscriptionPlanChangedEvent } from './events/SubscriptionPlanChangedEvent'
import { InviteGeneratedEvent } from './events/InviteGeneratedEvent'

interface CompanyProps {
  ownerId: string
  name: CompanyName
  companyLogoUrl: string | null
  stripeCustomerId: string | null
  subscriptionId: string | null
  subscriptionStatus: SubscriptionStatus
  subscriptionPlan: SubscriptionPlan
  billingCycle: BillingCycle
  subscriptionCreatedAt: Date | null
  subscriptionCanceledAt: Date | null
  onboardingToken: OnboardingToken | null
  createdAt: Date
  updatedAt: Date
}

interface CreateCompanyProps {
  id: string
  name: string
  ownerId: string
  plan?: SubscriptionPlan
}

export class Company extends AggregateRoot<string> {
  private _ownerId: string
  private _name: CompanyName
  private _companyLogoUrl: string | null
  private _stripeCustomerId: string | null
  private _subscriptionId: string | null
  private _subscriptionStatus: SubscriptionStatus
  private _subscriptionPlan: SubscriptionPlan
  private _billingCycle: BillingCycle
  private _subscriptionCreatedAt: Date | null
  private _subscriptionCanceledAt: Date | null
  private _onboardingToken: OnboardingToken | null

  private constructor(id: string, props: CompanyProps) {
    super(id, props.createdAt, props.updatedAt)
    this._ownerId = props.ownerId
    this._name = props.name
    this._companyLogoUrl = props.companyLogoUrl
    this._stripeCustomerId = props.stripeCustomerId
    this._subscriptionId = props.subscriptionId
    this._subscriptionStatus = props.subscriptionStatus
    this._subscriptionPlan = props.subscriptionPlan
    this._billingCycle = props.billingCycle
    this._subscriptionCreatedAt = props.subscriptionCreatedAt
    this._subscriptionCanceledAt = props.subscriptionCanceledAt
    this._onboardingToken = props.onboardingToken
  }

  // Getters
  get ownerId(): string {
    return this._ownerId
  }

  get name(): CompanyName {
    return this._name
  }

  get stripeCustomerId(): string | null {
    return this._stripeCustomerId
  }

  get companyLogoUrl(): string | null {
    return this._companyLogoUrl
  }

  get subscriptionId(): string | null {
    return this._subscriptionId
  }

  get subscriptionStatus(): SubscriptionStatus {
    return this._subscriptionStatus
  }

  get subscriptionPlan(): SubscriptionPlan {
    return this._subscriptionPlan
  }

  get billingCycle(): BillingCycle {
    return this._billingCycle
  }

  get subscriptionCreatedAt(): Date | null {
    return this._subscriptionCreatedAt
  }

  get subscriptionCanceledAt(): Date | null {
    return this._subscriptionCanceledAt
  }

  get onboardingToken(): OnboardingToken | null {
    return this._onboardingToken
  }

  /**
   * Factory method to create a new Company
   *
   * @param props - Company creation properties
   * @returns Company instance
   */
  public static create(props: CreateCompanyProps): Company {
    const now = new Date()
    const name = CompanyName.create(props.name)
    const plan = props.plan || SubscriptionPlan.FREE

    const company = new Company(props.id, {
      ownerId: props.ownerId,
      name,
      companyLogoUrl: null,
      stripeCustomerId: null,
      subscriptionId: null,
      subscriptionStatus: SubscriptionStatus.TRIAL,
      subscriptionPlan: plan,
      billingCycle: BillingCycle.MONTHLY,
      subscriptionCreatedAt: null,
      subscriptionCanceledAt: null,
      onboardingToken: null,
      createdAt: now,
      updatedAt: now,
    })

    company.addDomainEvent(
      new CompanyCreatedEvent({
        companyId: props.id,
        name: name.value,
        ownerId: props.ownerId,
        subscriptionPlan: plan.value,
      })
    )

    return company
  }

  /**
   * Update the company name
   *
   * @param name - New company name
   */
  public updateName(name: string): void {
    this._name = CompanyName.create(name)
    this.touch()

    this.addDomainEvent(
      new CompanyUpdatedEvent({
        companyId: this.id,
        updatedFields: ['name'],
      })
    )
  }

  public updateCompanyLogoUrl(companyLogoUrl: string | null): void {
    this._companyLogoUrl = companyLogoUrl
    this.touch()

    this.addDomainEvent(
      new CompanyUpdatedEvent({
        companyId: this.id,
        updatedFields: ['companyLogoUrl'],
      })
    )
  }

  /**
   * Activate a subscription
   *
   * @param stripeCustomerId - Stripe customer ID
   * @param subscriptionId - Stripe subscription ID
   * @param plan - Subscription plan
   * @param billingCycle - Billing cycle
   * @throws Error if subscription is already active
   */
  public activateSubscription(
    stripeCustomerId: string,
    subscriptionId: string,
    plan: SubscriptionPlan,
    billingCycle: BillingCycle
  ): void {
    if (this._subscriptionStatus.equals(SubscriptionStatus.ACTIVE)) {
      throw new Error('Subscription is already active')
    }

    this._stripeCustomerId = stripeCustomerId
    this._subscriptionId = subscriptionId
    this._subscriptionPlan = plan
    this._billingCycle = billingCycle
    this._subscriptionStatus = SubscriptionStatus.ACTIVE
    this._subscriptionCreatedAt = new Date()
    this._subscriptionCanceledAt = null
    this.touch()

    this.addDomainEvent(
      new SubscriptionActivatedEvent({
        companyId: this.id,
        plan: plan.value,
        billingCycle: billingCycle.value,
        subscriptionId,
        stripeCustomerId,
      })
    )
  }

  /**
   * Cancel the subscription
   *
   * @param reason - Optional cancellation reason
   * @throws Error if no active subscription exists
   */
  public cancelSubscription(reason?: string): void {
    if (!this._subscriptionStatus.isUsable) {
      throw new Error('No active subscription to cancel')
    }

    const previousSubscriptionId = this._subscriptionId

    this._subscriptionStatus = SubscriptionStatus.CANCELLED
    this._subscriptionCanceledAt = new Date()
    this.touch()

    this.addDomainEvent(
      new SubscriptionCancelledEvent({
        companyId: this.id,
        subscriptionId: previousSubscriptionId || '',
        reason: reason || null,
        cancelledAt: this._subscriptionCanceledAt,
      })
    )
  }

  /**
   * Change the subscription plan
   *
   * @param newPlan - New subscription plan
   * @param billingCycle - Optional new billing cycle
   * @throws Error if subscription is not active
   */
  public changePlan(newPlan: SubscriptionPlan, billingCycle?: BillingCycle): void {
    if (!this._subscriptionStatus.equals(SubscriptionStatus.ACTIVE)) {
      throw new Error('Cannot change plan without active subscription')
    }

    if (this._subscriptionPlan.equals(newPlan)) {
      throw new Error('Already on this plan')
    }

    const previousPlan = this._subscriptionPlan
    const isUpgrade = previousPlan.canUpgradeTo(newPlan)

    this._subscriptionPlan = newPlan
    if (billingCycle) {
      this._billingCycle = billingCycle
    }
    this.touch()

    this.addDomainEvent(
      new SubscriptionPlanChangedEvent({
        companyId: this.id,
        previousPlan: previousPlan.value,
        newPlan: newPlan.value,
        billingCycle: this._billingCycle.value,
        isUpgrade,
      })
    )
  }

  /**
   * Generate an invite token for onboarding
   *
   * @returns Generated token
   */
  public generateInviteToken(): OnboardingToken {
    this._onboardingToken = OnboardingToken.generate()
    this.touch()

    this.addDomainEvent(
      new InviteGeneratedEvent({
        companyId: this.id,
        token: this._onboardingToken.value,
        expiresAt: this._onboardingToken.expiresAt,
      })
    )

    return this._onboardingToken
  }

  /**
   * Use (consume) an onboarding token
   *
   * @throws Error if token is invalid or already used
   */
  public useInviteToken(): void {
    if (!this._onboardingToken) {
      throw new Error('No invite token exists')
    }

    if (!this._onboardingToken.isValid) {
      throw new Error(
        this._onboardingToken.isExpired
          ? 'Invite token has expired'
          : 'Invite token has already been used'
      )
    }

    this._onboardingToken = this._onboardingToken.markAsUsed()
    this.touch()
  }

  /**
   * Update subscription status (e.g., from webhook)
   *
   * @param status - New subscription status
   */
  public updateSubscriptionStatus(status: SubscriptionStatus): void {
    this._subscriptionStatus = status
    this.touch()

    this.addDomainEvent(
      new CompanyUpdatedEvent({
        companyId: this.id,
        updatedFields: ['subscriptionStatus'],
      })
    )
  }

  /**
   * Check if company can add a new property
   *
   * @param currentPropertyCount - Current number of properties
   * @returns True if property can be added
   */
  public canAddProperty(currentPropertyCount: number): boolean {
    return currentPropertyCount < this._subscriptionPlan.propertyLimit
  }

  /**
   * Check if the company has an active subscription
   */
  get hasActiveSubscription(): boolean {
    return this._subscriptionStatus.isUsable
  }

  /**
   * Check if the company is on a paid plan
   */
  get isPaid(): boolean {
    return this._subscriptionPlan.isPaid && this._subscriptionStatus.equals(SubscriptionStatus.ACTIVE)
  }

  /**
   * Reconstitute Company from persistence
   *
   * @param id - Company ID
   * @param props - All company properties from database
   * @returns Company instance
   */
  public static fromPersistence(
    id: string,
    ownerId: string,
    name: CompanyName,
    companyLogoUrl: string | null,
    stripeCustomerId: string | null,
    subscriptionId: string | null,
    subscriptionStatus: SubscriptionStatus,
    subscriptionPlan: SubscriptionPlan,
    billingCycle: BillingCycle,
    subscriptionCreatedAt: Date | null,
    subscriptionCanceledAt: Date | null,
    onboardingToken: OnboardingToken | null,
    createdAt: Date,
    updatedAt: Date
  ): Company {
    return new Company(id, {
      ownerId,
      name,
      companyLogoUrl,
      stripeCustomerId,
      subscriptionId,
      subscriptionStatus,
      subscriptionPlan,
      billingCycle,
      subscriptionCreatedAt,
      subscriptionCanceledAt,
      onboardingToken,
      createdAt,
      updatedAt,
    })
  }

  /**
   * Convert Company to persistence format
   *
   * @returns Database row format matching companies table schema
   */
  public toPersistence(): {
    id: string
    name: string
    company_logo_url: string | null
    owner_id: string
    stripe_customer_id: string | null
    subscription_id: string | null
    subscription_status: string | null
    subscription_plan: string | null
    billing_cycle: string | null
    subscription_created_at: string | null
    subscription_canceled_at: string | null
    onboarding_token: string | null
    onboarding_token_expires_at: string | null
    onboarding_token_used_at: string | null
    created_at: string
    updated_at: string
  } {
    return {
      id: this.id,
      name: this._name.value,
      company_logo_url: this._companyLogoUrl,
      owner_id: this._ownerId,
      stripe_customer_id: this._stripeCustomerId,
      subscription_id: this._subscriptionId,
      subscription_status: this._subscriptionStatus.value,
      subscription_plan: this._subscriptionPlan.value,
      billing_cycle: this._billingCycle.value,
      subscription_created_at: this._subscriptionCreatedAt?.toISOString() || null,
      subscription_canceled_at: this._subscriptionCanceledAt?.toISOString() || null,
      onboarding_token: this._onboardingToken?.value || null,
      onboarding_token_expires_at: this._onboardingToken?.expiresAt.toISOString() || null,
      onboarding_token_used_at: this._onboardingToken?.usedAt?.toISOString() || null,
      created_at: this.createdAt.toISOString(),
      updated_at: this.updatedAt.toISOString(),
    }
  }
}

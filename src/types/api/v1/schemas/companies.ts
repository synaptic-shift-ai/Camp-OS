/**
 * Companies API v1 - Zod Schemas
 *
 * Phase 4A: API Consolidation - Companies API
 *
 * Validation schemas for company management API requests and responses.
 */

import { z } from 'zod'

// ============================================================================
// Enum Schemas
// ============================================================================

export const SubscriptionPlanSchema = z.enum(['free', 'starter', 'professional', 'enterprise'])

export const SubscriptionStatusSchema = z.enum(['inactive', 'active', 'past_due', 'canceled'])

export const BillingCycleSchema = z.enum(['monthly', 'yearly'])

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create Company Request
 * POST /api/v1/companies
 */
export const CreateCompanyRequestSchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255),
})

export type CreateCompanyRequest = z.infer<typeof CreateCompanyRequestSchema>

/**
 * Update Company Request
 * PATCH /api/v1/companies/[id]
 */
export const UpdateCompanyRequestSchema = z.object({
  name: z.string().min(1, 'Company name cannot be empty').max(255).optional(),
})

export type UpdateCompanyRequest = z.infer<typeof UpdateCompanyRequestSchema>

/**
 * Activate Subscription Request
 * POST /api/v1/companies/[id]/subscription
 */
export const ActivateSubscriptionRequestSchema = z.object({
  stripeCustomerId: z.string().min(1, 'Stripe customer ID is required'),
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  plan: SubscriptionPlanSchema,
  billingCycle: BillingCycleSchema,
})

export type ActivateSubscriptionRequest = z.infer<typeof ActivateSubscriptionRequestSchema>

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Subscription Response (embedded in Company)
 */
export const SubscriptionResponseSchema = z.object({
  plan: SubscriptionPlanSchema,
  status: SubscriptionStatusSchema,
  billingCycle: BillingCycleSchema,
  isActive: z.boolean(),
  isPaid: z.boolean(),
  stripeCustomerId: z.string().nullable(),
  subscriptionId: z.string().nullable(),
  createdAt: z.string().datetime().nullable(),
  canceledAt: z.string().datetime().nullable(),
})

export type SubscriptionResponse = z.infer<typeof SubscriptionResponseSchema>

/**
 * Onboarding Token Response (embedded in Company)
 */
export const OnboardingTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  isValid: z.boolean(),
  isUsed: z.boolean(),
})

export type OnboardingTokenResponse = z.infer<typeof OnboardingTokenResponseSchema>

/**
 * Company Response
 */
export const CompanyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  ownerId: z.string().uuid(),
  subscription: SubscriptionResponseSchema,
  onboardingToken: OnboardingTokenResponseSchema.nullable(),
  propertyLimit: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type CompanyResponse = z.infer<typeof CompanyResponseSchema>

/**
 * Invite Token Response
 * POST /api/v1/companies/[id]/invite
 */
export const InviteTokenResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.string().datetime(),
  inviteUrl: z.string().url(),
})

export type InviteTokenResponse = z.infer<typeof InviteTokenResponseSchema>

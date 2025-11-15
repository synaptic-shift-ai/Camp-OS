/**
 * Financial API v1 - Zod Validation Schemas
 *
 * Request/response validation for Financial module endpoints.
 */

import { z } from 'zod'

// ============================================================================
// Transaction Schemas
// ============================================================================

export const RecordPaymentRequestSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
  invoiceId: z.string().uuid('Invalid invoice ID').optional().nullable(),
  amountCents: z.number().int().positive('Amount must be positive'),
  paymentMethod: z.enum([
    'credit_card',
    'debit_card',
    'cash',
    'check',
    'bank_transfer',
    'stripe',
    'store_credit',
  ]),
  stripePaymentIntentId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type RecordPaymentRequest = z.infer<typeof RecordPaymentRequestSchema>

export const ProcessRefundRequestSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
  amountCents: z.number().int().positive('Refund amount must be positive'),
  paymentMethod: z.enum(['stripe', 'cash', 'check', 'bank_transfer']),
  originalTransactionId: z.string().uuid('Invalid transaction ID').optional().nullable(),
  stripeRefundId: z.string().optional().nullable(),
  reason: z.string().optional().nullable(),
})

export type ProcessRefundRequest = z.infer<typeof ProcessRefundRequestSchema>

// ============================================================================
// Invoice Schemas
// ============================================================================

export const InvoiceLineItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().int().positive('Quantity must be positive'),
  unitPriceCents: z.number().int().nonnegative('Unit price cannot be negative'),
})

export const GenerateInvoiceRequestSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
  lineItems: z.array(InvoiceLineItemSchema).min(1, 'At least one line item required'),
  taxRate: z.number().nonnegative('Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  dueDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
  isInstallment: z.boolean().optional().default(false),
  installmentNumber: z.number().int().positive().optional().nullable(),
  installmentTotal: z.number().int().positive().optional().nullable(),
})

export type GenerateInvoiceRequest = z.infer<typeof GenerateInvoiceRequestSchema>

export const IssueInvoiceRequestSchema = z.object({
  // No body needed - just marks invoice as issued
})

export type IssueInvoiceRequest = z.infer<typeof IssueInvoiceRequestSchema>

export const CancelInvoiceRequestSchema = z.object({
  // No body needed
})

export type CancelInvoiceRequest = z.infer<typeof CancelInvoiceRequestSchema>

// ============================================================================
// Payment Plan Schemas
// ============================================================================

export const CreatePaymentPlanRequestSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
  totalAmountCents: z.number().int().positive('Total amount must be positive'),
  numberOfInstallments: z.number().int().min(2, 'Must have at least 2 installments'),
  installmentIntervalDays: z.number().int().positive('Interval must be at least 1 day'),
  startDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: 'Invalid date format',
  }),
})

export type CreatePaymentPlanRequest = z.infer<typeof CreatePaymentPlanRequestSchema>

// ============================================================================
// Security Deposit Schemas
// ============================================================================

export const HoldSecurityDepositRequestSchema = z.object({
  reservationId: z.string().uuid('Invalid reservation ID'),
  amountCents: z.number().int().positive('Deposit amount must be positive'),
  stripePaymentIntentId: z.string().optional().nullable(),
})

export type HoldSecurityDepositRequest = z.infer<typeof HoldSecurityDepositRequestSchema>

export const DeductFromDepositRequestSchema = z.object({
  amountCents: z.number().int().positive('Deduction amount must be positive'),
  reason: z.string().min(1, 'Deduction reason is required'),
})

export type DeductFromDepositRequest = z.infer<typeof DeductFromDepositRequestSchema>

export const ReleaseDepositRequestSchema = z.object({
  // No body needed - calculates release amount automatically
})

export type ReleaseDepositRequest = z.infer<typeof ReleaseDepositRequestSchema>

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const TransactionFiltersSchema = z.object({
  type: z.enum([
    'payment',
    'refund',
    'deposit',
    'deposit_release',
    'deposit_deduction',
    'expense',
    'platform_fee',
    'payout',
  ]).optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
})

export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>

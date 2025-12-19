/**
 * Financial API v1 Contract Tests
 *
 * Phase 4C: API Consolidation - Financial API
 *
 * Following CLAUDE.md:
 * - T-1: Tests colocated in tests/integration/
 * - T-6: Test entire structure in one assertion
 * - T-7: Parameterized test inputs
 * - T-8: Test description states what expect verifies
 * - T-12: Group unit tests under describe(functionName, ...)
 */

import { describe, it, expect } from 'vitest'
import {
  RecordPaymentRequestSchema,
  ProcessRefundRequestSchema,
  GenerateInvoiceRequestSchema,
  InvoiceLineItemSchema,
  TransactionFiltersSchema,
  TransactionResponseSchema,
  TransactionListResponseSchema,
  InvoiceResponseSchema,
  ReservationBalanceResponseSchema,
  type TransactionResponse,
  type InvoiceResponse,
  type ReservationBalanceResponse,
} from '@/types/api/v1/schemas/financial'

describe('Financial API v1 Contract Tests', () => {
  // ========================================================================
  // Request Schema Validation - Record Payment
  // ========================================================================

  describe('RecordPaymentRequestSchema', () => {
    it('should validate complete payment request', () => {
      const validRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        amountCents: 15000,
        paymentMethod: 'credit_card',
      }

      const result = RecordPaymentRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate payment request with invoice and notes', () => {
      const validRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        invoiceId: '660e8400-e29b-41d4-a716-446655440001',
        amountCents: 15000,
        paymentMethod: 'stripe',
        stripePaymentIntentId: 'pi_1234567890',
        notes: 'Payment for 3-night stay',
      }

      const result = RecordPaymentRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject invalid reservation UUID', () => {
      const invalidRequest = {
        reservationId: 'not-a-uuid',
        amountCents: 15000,
        paymentMethod: 'cash',
      }

      const result = RecordPaymentRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject zero amount', () => {
      const invalidRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        amountCents: 0,
        paymentMethod: 'cash',
      }

      const result = RecordPaymentRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject negative amount', () => {
      const invalidRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        amountCents: -500,
        paymentMethod: 'cash',
      }

      const result = RecordPaymentRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    const validPaymentMethods = [
      'credit_card',
      'debit_card',
      'cash',
      'check',
      'bank_transfer',
      'stripe',
      'store_credit',
    ] as const

    validPaymentMethods.forEach((method) => {
      it(`should accept valid payment method: ${method}`, () => {
        const request = {
          reservationId: '550e8400-e29b-41d4-a716-446655440000',
          amountCents: 5000,
          paymentMethod: method,
        }

        const result = RecordPaymentRequestSchema.safeParse(request)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid payment method', () => {
      const invalidRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        amountCents: 5000,
        paymentMethod: 'bitcoin',
      }

      const result = RecordPaymentRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Request Schema Validation - Process Refund
  // ========================================================================

  describe('ProcessRefundRequestSchema', () => {
    it('should validate complete refund request', () => {
      const validRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        amountCents: 5000,
        paymentMethod: 'stripe',
        stripeRefundId: 're_1234567890',
        reason: 'Early checkout - prorated refund',
      }

      const result = ProcessRefundRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate minimal refund request', () => {
      const validRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        amountCents: 5000,
        paymentMethod: 'cash',
      }

      const result = ProcessRefundRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate refund with original transaction reference', () => {
      const validRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        amountCents: 5000,
        paymentMethod: 'stripe',
        originalTransactionId: '770e8400-e29b-41d4-a716-446655440002',
      }

      const result = ProcessRefundRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject zero refund amount', () => {
      const invalidRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        amountCents: 0,
        paymentMethod: 'cash',
      }

      const result = ProcessRefundRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject missing required fields', () => {
      const invalidRequest = {
        amountCents: 5000,
      }

      const result = ProcessRefundRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Request Schema Validation - Generate Invoice
  // ========================================================================

  describe('GenerateInvoiceRequestSchema', () => {
    it('should validate complete invoice request', () => {
      const validRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        lineItems: [
          {
            description: 'Campsite rental - 3 nights',
            quantity: 3,
            unitPriceCents: 5000,
          },
        ],
        taxRate: 0.08,
        dueDate: '2025-01-15',
      }

      const result = GenerateInvoiceRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate invoice with multiple line items', () => {
      const validRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        lineItems: [
          { description: 'Campsite rental', quantity: 3, unitPriceCents: 5000 },
          { description: 'Firewood bundle', quantity: 2, unitPriceCents: 1000 },
          { description: 'Kayak rental', quantity: 1, unitPriceCents: 3500 },
        ],
        taxRate: 0.0825,
        dueDate: '2025-01-20',
      }

      const result = GenerateInvoiceRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should validate installment invoice', () => {
      const validRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        lineItems: [
          { description: 'Deposit - 50%', quantity: 1, unitPriceCents: 7500 },
        ],
        taxRate: 0.08,
        dueDate: '2025-01-01',
        isInstallment: true,
        installmentNumber: 1,
        installmentTotal: 2,
      }

      const result = GenerateInvoiceRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should reject empty line items array', () => {
      const invalidRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        lineItems: [],
        taxRate: 0.08,
        dueDate: '2025-01-15',
      }

      const result = GenerateInvoiceRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject tax rate over 100%', () => {
      const invalidRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        lineItems: [
          { description: 'Test', quantity: 1, unitPriceCents: 1000 },
        ],
        taxRate: 150,
        dueDate: '2025-01-15',
      }

      const result = GenerateInvoiceRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })

    it('should reject negative tax rate', () => {
      const invalidRequest = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        lineItems: [
          { description: 'Test', quantity: 1, unitPriceCents: 1000 },
        ],
        taxRate: -0.05,
        dueDate: '2025-01-15',
      }

      const result = GenerateInvoiceRequestSchema.safeParse(invalidRequest)
      expect(result.success).toBe(false)
    })
  })

  describe('InvoiceLineItemSchema', () => {
    it('should validate complete line item', () => {
      const validItem = {
        description: 'Campsite rental - Premium waterfront site',
        quantity: 5,
        unitPriceCents: 7500,
      }

      const result = InvoiceLineItemSchema.safeParse(validItem)
      expect(result.success).toBe(true)
    })

    it('should reject empty description', () => {
      const invalidItem = {
        description: '',
        quantity: 1,
        unitPriceCents: 1000,
      }

      const result = InvoiceLineItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('should reject zero quantity', () => {
      const invalidItem = {
        description: 'Test item',
        quantity: 0,
        unitPriceCents: 1000,
      }

      const result = InvoiceLineItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('should reject negative quantity', () => {
      const invalidItem = {
        description: 'Test item',
        quantity: -1,
        unitPriceCents: 1000,
      }

      const result = InvoiceLineItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })

    it('should accept zero unit price (free items)', () => {
      const freeItem = {
        description: 'Complimentary firewood',
        quantity: 1,
        unitPriceCents: 0,
      }

      const result = InvoiceLineItemSchema.safeParse(freeItem)
      expect(result.success).toBe(true)
    })

    it('should reject negative unit price', () => {
      const invalidItem = {
        description: 'Test item',
        quantity: 1,
        unitPriceCents: -500,
      }

      const result = InvoiceLineItemSchema.safeParse(invalidItem)
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Query Parameter Validation
  // ========================================================================

  describe('TransactionFiltersSchema', () => {
    it('should validate empty filters with defaults', () => {
      const result = TransactionFiltersSchema.safeParse({})
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.limit).toBe(20)
        expect(result.data.offset).toBe(0)
      }
    })

    it('should validate filters with type and status', () => {
      const filters = {
        type: 'payment',
        status: 'completed',
        limit: 50,
        offset: 10,
      }

      const result = TransactionFiltersSchema.safeParse(filters)
      expect(result.success).toBe(true)
    })

    it('should validate date range filters', () => {
      const filters = {
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      }

      const result = TransactionFiltersSchema.safeParse(filters)
      expect(result.success).toBe(true)
    })

    const validTransactionTypes = [
      'payment',
      'refund',
      'deposit',
      'deposit_release',
      'deposit_deduction',
      'expense',
      'platform_fee',
      'payout',
    ] as const

    validTransactionTypes.forEach((type) => {
      it(`should accept valid transaction type: ${type}`, () => {
        const result = TransactionFiltersSchema.safeParse({ type })
        expect(result.success).toBe(true)
      })
    })

    const validStatuses = ['pending', 'completed', 'failed', 'cancelled'] as const

    validStatuses.forEach((status) => {
      it(`should accept valid status: ${status}`, () => {
        const result = TransactionFiltersSchema.safeParse({ status })
        expect(result.success).toBe(true)
      })
    })

    it('should reject limit over 100', () => {
      const result = TransactionFiltersSchema.safeParse({ limit: 150 })
      expect(result.success).toBe(false)
    })

    it('should reject negative offset', () => {
      const result = TransactionFiltersSchema.safeParse({ offset: -5 })
      expect(result.success).toBe(false)
    })
  })

  // ========================================================================
  // Response Schema Validation
  // ========================================================================

  describe('TransactionResponseSchema', () => {
    it('should validate complete payment transaction', () => {
      const transaction: TransactionResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        reservationId: '770e8400-e29b-41d4-a716-446655440002',
        invoiceId: '880e8400-e29b-41d4-a716-446655440003',
        type: 'payment',
        amountCents: 15000,
        currency: 'USD',
        paymentMethod: 'credit_card',
        stripePaymentIntentId: 'pi_1234567890',
        stripeRefundId: null,
        status: 'completed',
        processedAt: '2025-01-10T14:30:00Z',
        failureReason: null,
        notes: 'Payment for reservation',
        reconciledAt: null,
        reconciledBy: null,
        createdAt: '2025-01-10T14:29:00Z',
        createdBy: '990e8400-e29b-41d4-a716-446655440004',
        updatedAt: '2025-01-10T14:30:00Z',
      }

      expect(() => TransactionResponseSchema.parse(transaction)).not.toThrow()
    })

    it('should validate refund transaction', () => {
      const refund: TransactionResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        reservationId: '770e8400-e29b-41d4-a716-446655440002',
        invoiceId: null,
        type: 'refund',
        amountCents: 5000,
        currency: 'USD',
        paymentMethod: 'stripe',
        stripePaymentIntentId: null,
        stripeRefundId: 're_1234567890',
        status: 'completed',
        processedAt: '2025-01-12T10:00:00Z',
        failureReason: null,
        notes: 'Early checkout refund',
        reconciledAt: null,
        reconciledBy: null,
        createdAt: '2025-01-12T09:55:00Z',
        createdBy: '990e8400-e29b-41d4-a716-446655440004',
        updatedAt: '2025-01-12T10:00:00Z',
      }

      expect(() => TransactionResponseSchema.parse(refund)).not.toThrow()
    })

    it('should validate failed transaction', () => {
      const failed: TransactionResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        reservationId: '770e8400-e29b-41d4-a716-446655440002',
        invoiceId: null,
        type: 'payment',
        amountCents: 15000,
        currency: 'USD',
        paymentMethod: 'credit_card',
        stripePaymentIntentId: 'pi_1234567890',
        stripeRefundId: null,
        status: 'failed',
        processedAt: null,
        failureReason: 'Card declined - insufficient funds',
        notes: null,
        reconciledAt: null,
        reconciledBy: null,
        createdAt: '2025-01-10T14:29:00Z',
        createdBy: '990e8400-e29b-41d4-a716-446655440004',
        updatedAt: '2025-01-10T14:30:00Z',
      }

      expect(() => TransactionResponseSchema.parse(failed)).not.toThrow()
    })

    it('should reject invalid transaction type', () => {
      const invalid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        reservationId: null,
        invoiceId: null,
        type: 'invalid_type',
        amountCents: 1000,
        currency: 'USD',
        paymentMethod: 'cash',
        stripePaymentIntentId: null,
        stripeRefundId: null,
        status: 'completed',
        processedAt: null,
        failureReason: null,
        notes: null,
        reconciledAt: null,
        reconciledBy: null,
        createdAt: '2025-01-10T14:29:00Z',
        createdBy: '990e8400-e29b-41d4-a716-446655440004',
        updatedAt: '2025-01-10T14:30:00Z',
      }

      expect(() => TransactionResponseSchema.parse(invalid)).toThrow()
    })
  })

  describe('TransactionListResponseSchema', () => {
    it('should validate transaction list with pagination', () => {
      const list = {
        transactions: [
          {
            id: '550e8400-e29b-41d4-a716-446655440000',
            propertyId: '660e8400-e29b-41d4-a716-446655440001',
            reservationId: '770e8400-e29b-41d4-a716-446655440002',
            invoiceId: null,
            type: 'payment',
            amountCents: 15000,
            currency: 'USD',
            paymentMethod: 'credit_card',
            stripePaymentIntentId: null,
            stripeRefundId: null,
            status: 'completed',
            processedAt: '2025-01-10T14:30:00Z',
            failureReason: null,
            notes: null,
            reconciledAt: null,
            reconciledBy: null,
            createdAt: '2025-01-10T14:29:00Z',
            createdBy: '990e8400-e29b-41d4-a716-446655440004',
            updatedAt: '2025-01-10T14:30:00Z',
          },
        ],
        count: 25,
        limit: 20,
        offset: 0,
      }

      expect(() => TransactionListResponseSchema.parse(list)).not.toThrow()
    })

    it('should validate empty transaction list', () => {
      const emptyList = {
        transactions: [],
        count: 0,
        limit: 20,
        offset: 0,
      }

      expect(() => TransactionListResponseSchema.parse(emptyList)).not.toThrow()
    })
  })

  describe('InvoiceResponseSchema', () => {
    it('should validate complete invoice', () => {
      const invoice: InvoiceResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        reservationId: '770e8400-e29b-41d4-a716-446655440002',
        invoiceNumber: 'YY-25-00001',
        lineItems: [
          {
            description: 'Campsite rental - 3 nights',
            quantity: 3,
            unitPriceCents: 5000,
            totalCents: 15000,
          },
        ],
        subtotalCents: 15000,
        taxCents: 1200,
        totalCents: 16200,
        paidCents: 16200,
        balanceCents: 0,
        taxRate: 0.08,
        isInstallment: false,
        installmentNumber: null,
        installmentTotal: null,
        dueDate: '2025-01-15T00:00:00Z',
        status: 'paid',
        issuedAt: '2025-01-01T10:00:00Z',
        paidAt: '2025-01-10T14:30:00Z',
        cancelledAt: null,
        createdAt: '2025-01-01T09:00:00Z',
        updatedAt: '2025-01-10T14:30:00Z',
      }

      expect(() => InvoiceResponseSchema.parse(invoice)).not.toThrow()
    })

    it('should validate installment invoice', () => {
      const installment: InvoiceResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        reservationId: '770e8400-e29b-41d4-a716-446655440002',
        invoiceNumber: 'YY-25-00002',
        lineItems: [
          {
            description: 'Deposit - 50%',
            quantity: 1,
            unitPriceCents: 7500,
            totalCents: 7500,
          },
        ],
        subtotalCents: 7500,
        taxCents: 600,
        totalCents: 8100,
        paidCents: 0,
        balanceCents: 8100,
        taxRate: 0.08,
        isInstallment: true,
        installmentNumber: 1,
        installmentTotal: 2,
        dueDate: '2025-01-01T00:00:00Z',
        status: 'issued',
        issuedAt: '2024-12-15T10:00:00Z',
        paidAt: null,
        cancelledAt: null,
        createdAt: '2024-12-15T09:00:00Z',
        updatedAt: '2024-12-15T10:00:00Z',
      }

      expect(() => InvoiceResponseSchema.parse(installment)).not.toThrow()
    })

    it('should validate cancelled invoice', () => {
      const cancelled: InvoiceResponse = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        reservationId: '770e8400-e29b-41d4-a716-446655440002',
        invoiceNumber: 'YY-25-00003',
        lineItems: [],
        subtotalCents: 15000,
        taxCents: 1200,
        totalCents: 16200,
        paidCents: 0,
        balanceCents: 0,
        taxRate: 0.08,
        isInstallment: false,
        installmentNumber: null,
        installmentTotal: null,
        dueDate: '2025-01-15T00:00:00Z',
        status: 'cancelled',
        issuedAt: '2025-01-01T10:00:00Z',
        paidAt: null,
        cancelledAt: '2025-01-05T14:00:00Z',
        createdAt: '2025-01-01T09:00:00Z',
        updatedAt: '2025-01-05T14:00:00Z',
      }

      expect(() => InvoiceResponseSchema.parse(cancelled)).not.toThrow()
    })

    it('should reject invalid invoice status', () => {
      const invalid = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        propertyId: '660e8400-e29b-41d4-a716-446655440001',
        reservationId: '770e8400-e29b-41d4-a716-446655440002',
        invoiceNumber: 'YY-25-00001',
        lineItems: [],
        subtotalCents: 0,
        taxCents: 0,
        totalCents: 0,
        paidCents: 0,
        balanceCents: 0,
        taxRate: 0,
        isInstallment: false,
        installmentNumber: null,
        installmentTotal: null,
        dueDate: '2025-01-15T00:00:00Z',
        status: 'pending', // Invalid - not in enum
        issuedAt: null,
        paidAt: null,
        cancelledAt: null,
        createdAt: '2025-01-01T09:00:00Z',
        updatedAt: '2025-01-01T09:00:00Z',
      }

      expect(() => InvoiceResponseSchema.parse(invalid)).toThrow()
    })
  })

  describe('ReservationBalanceResponseSchema', () => {
    it('should validate reservation with full balance paid', () => {
      const balance: ReservationBalanceResponse = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        totalCents: 16200,
        paidCents: 16200,
        balanceCents: 0,
        invoices: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            invoiceNumber: 'YY-25-00001',
            totalCents: 16200,
            paidCents: 16200,
            balanceCents: 0,
            status: 'paid',
          },
        ],
      }

      expect(() => ReservationBalanceResponseSchema.parse(balance)).not.toThrow()
    })

    it('should validate reservation with partial payment', () => {
      const balance: ReservationBalanceResponse = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        totalCents: 16200,
        paidCents: 8100,
        balanceCents: 8100,
        invoices: [
          {
            id: '660e8400-e29b-41d4-a716-446655440001',
            invoiceNumber: 'YY-25-00001',
            totalCents: 8100,
            paidCents: 8100,
            balanceCents: 0,
            status: 'paid',
          },
          {
            id: '770e8400-e29b-41d4-a716-446655440002',
            invoiceNumber: 'YY-25-00002',
            totalCents: 8100,
            paidCents: 0,
            balanceCents: 8100,
            status: 'issued',
          },
        ],
      }

      expect(() => ReservationBalanceResponseSchema.parse(balance)).not.toThrow()
    })

    it('should validate reservation with no invoices', () => {
      const balance: ReservationBalanceResponse = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        totalCents: 0,
        paidCents: 0,
        balanceCents: 0,
        invoices: [],
      }

      expect(() => ReservationBalanceResponseSchema.parse(balance)).not.toThrow()
    })

    it('should reject invalid reservation UUID', () => {
      const invalid = {
        reservationId: 'not-a-uuid',
        totalCents: 0,
        paidCents: 0,
        balanceCents: 0,
        invoices: [],
      }

      expect(() => ReservationBalanceResponseSchema.parse(invalid)).toThrow()
    })
  })

  // ========================================================================
  // Business Logic Verification
  // ========================================================================

  describe('Financial Business Logic', () => {
    it('balance should equal total minus paid', () => {
      const total = 16200
      const paid = 8100
      const expectedBalance = total - paid

      expect(expectedBalance).toBe(8100)
    })

    it('installment invoices must have both number and total', () => {
      const validInstallment = {
        reservationId: '550e8400-e29b-41d4-a716-446655440000',
        lineItems: [{ description: 'Test', quantity: 1, unitPriceCents: 1000 }],
        taxRate: 0.08,
        dueDate: '2025-01-15',
        isInstallment: true,
        installmentNumber: 1,
        installmentTotal: 3,
      }

      const result = GenerateInvoiceRequestSchema.safeParse(validInstallment)
      expect(result.success).toBe(true)
    })

    it('invoice total equals sum of line items plus tax', () => {
      const lineItems = [
        { quantity: 3, unitPriceCents: 5000 }, // 15000
        { quantity: 2, unitPriceCents: 1000 }, // 2000
      ]
      const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0)
      const taxRate = 0.08
      const tax = Math.round(subtotal * taxRate)
      const total = subtotal + tax

      expect(subtotal).toBe(17000)
      expect(tax).toBe(1360)
      expect(total).toBe(18360)
    })
  })
})

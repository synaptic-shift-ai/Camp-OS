/**
 * FinancialReportingService Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FinancialReportingService } from '../FinancialReportingService'
import { TransactionType } from '../../value-objects/TransactionType'
import { TransactionStatus } from '../../value-objects/TransactionStatus'
import type { ITransactionRepository } from '../../ITransactionRepository'
import type { IInvoiceRepository } from '../../IInvoiceRepository'
import type { ISecurityDepositRepository } from '../../ISecurityDepositRepository'

describe('FinancialReportingService', () => {
  let mockTransactionRepo: ITransactionRepository
  let mockInvoiceRepo: IInvoiceRepository
  let mockDepositRepo: ISecurityDepositRepository
  let service: FinancialReportingService

  beforeEach(() => {
    mockTransactionRepo = {
      findById: vi.fn(),
      findByReservation: vi.fn(),
      findByProperty: vi.fn().mockResolvedValue([]),
      findByInvoice: vi.fn(),
      save: vi.fn(),
      nextTransactionNumber: vi.fn(),
      findByProcessorEventId: vi.fn().mockResolvedValue(null),
      findByGuestId: vi.fn().mockResolvedValue([]),
    }

    mockInvoiceRepo = {
      findById: vi.fn(),
      findByInvoiceNumber: vi.fn(),
      findByReservation: vi.fn(),
      findOverdueInvoices: vi.fn().mockResolvedValue([]),
      findByStatus: vi.fn(),
      save: vi.fn(),
      nextInvoiceSequence: vi.fn(),
    }

    mockDepositRepo = {
      findById: vi.fn(),
      findByReservation: vi.fn(),
      findHeldByProperty: vi.fn().mockResolvedValue([]),
      save: vi.fn(),
    }

    service = new FinancialReportingService(
      mockTransactionRepo,
      mockInvoiceRepo,
      mockDepositRepo
    )
  })

  describe('getFinancialSummary', () => {
    const propertyId = 'property-123'
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    }

    it('should calculate revenue from completed transactions', async () => {
      vi.mocked(mockTransactionRepo.findByProperty).mockResolvedValue([
        createMockTransaction(TransactionType.PAYMENT, 10000, TransactionStatus.COMPLETED),
        createMockTransaction(TransactionType.PAYMENT, 15000, TransactionStatus.COMPLETED),
        createMockTransaction(TransactionType.PLATFORM_FEE, 500, TransactionStatus.COMPLETED),
      ] as never)

      const summary = await service.getFinancialSummary(propertyId, dateRange)

      expect(summary.revenue.totalCents).toBe(25500)
      expect(summary.revenue.reservationsCents).toBe(25000)
      expect(summary.revenue.feesCents).toBe(500)
    })

    it('should count refunds separately', async () => {
      vi.mocked(mockTransactionRepo.findByProperty).mockResolvedValue([
        createMockTransaction(TransactionType.PAYMENT, 10000, TransactionStatus.COMPLETED),
        createMockTransaction(TransactionType.REFUND, -2000, TransactionStatus.COMPLETED),
        createMockTransaction(TransactionType.REFUND, -1000, TransactionStatus.COMPLETED),
      ] as never)

      const summary = await service.getFinancialSummary(propertyId, dateRange)

      expect(summary.refunds.totalCents).toBe(3000)
      expect(summary.refunds.count).toBe(2)
    })

    it('should track transaction statuses', async () => {
      vi.mocked(mockTransactionRepo.findByProperty).mockResolvedValue([
        createMockTransaction(TransactionType.PAYMENT, 10000, TransactionStatus.COMPLETED),
        createMockTransaction(TransactionType.PAYMENT, 5000, TransactionStatus.PENDING),
        createMockTransaction(TransactionType.PAYMENT, 3000, TransactionStatus.FAILED),
      ] as never)

      const summary = await service.getFinancialSummary(propertyId, dateRange)

      expect(summary.transactions.totalCount).toBe(3)
      expect(summary.transactions.completedCount).toBe(1)
      expect(summary.transactions.pendingCount).toBe(1)
      expect(summary.transactions.failedCount).toBe(1)
    })

    it('should calculate overdue invoices', async () => {
      vi.mocked(mockInvoiceRepo.findOverdueInvoices).mockResolvedValue([
        createMockInvoice('OVERDUE', 3000, new Date('2024-01-01')),
        createMockInvoice('OVERDUE', 5000, new Date('2024-01-10')),
      ] as never)

      const summary = await service.getFinancialSummary(propertyId, dateRange)

      expect(summary.outstanding.overdueCount).toBe(2)
      expect(summary.outstanding.overdueCents).toBe(8000)
    })

    it('should track held security deposits', async () => {
      vi.mocked(mockDepositRepo.findHeldByProperty).mockResolvedValue([
        createMockDeposit('HELD', 20000),
        createMockDeposit('HELD', 15000),
      ] as never)

      const summary = await service.getFinancialSummary(propertyId, dateRange)

      expect(summary.deposits.heldCents).toBe(35000)
      expect(summary.deposits.pendingCount).toBe(2)
    })
  })

  describe('getRevenueByPeriod', () => {
    const propertyId = 'property-123'
    const dateRange = {
      startDate: new Date('2024-01-01'),
      endDate: new Date('2024-01-31'),
    }

    it('should group revenue by day', async () => {
      vi.mocked(mockTransactionRepo.findByProperty).mockResolvedValue([
        createMockTransactionWithDate(TransactionType.PAYMENT, 10000, TransactionStatus.COMPLETED, new Date('2024-01-05')),
        createMockTransactionWithDate(TransactionType.PAYMENT, 5000, TransactionStatus.COMPLETED, new Date('2024-01-05')),
        createMockTransactionWithDate(TransactionType.PAYMENT, 8000, TransactionStatus.COMPLETED, new Date('2024-01-10')),
      ] as never)

      const result = await service.getRevenueByPeriod(propertyId, dateRange, 'daily')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        period: '2024-01-05',
        revenueCents: 15000,
        reservationCount: 2,
      })
      expect(result[1]).toEqual({
        period: '2024-01-10',
        revenueCents: 8000,
        reservationCount: 1,
      })
    })

    it('should group revenue by month', async () => {
      vi.mocked(mockTransactionRepo.findByProperty).mockResolvedValue([
        createMockTransactionWithDate(TransactionType.PAYMENT, 10000, TransactionStatus.COMPLETED, new Date('2024-01-15')),
        createMockTransactionWithDate(TransactionType.PAYMENT, 5000, TransactionStatus.COMPLETED, new Date('2024-01-20')),
      ] as never)

      const result = await service.getRevenueByPeriod(propertyId, dateRange, 'monthly')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        period: '2024-01',
        revenueCents: 15000,
        reservationCount: 2,
      })
    })

    it('should exclude refunds from revenue', async () => {
      vi.mocked(mockTransactionRepo.findByProperty).mockResolvedValue([
        createMockTransactionWithDate(TransactionType.PAYMENT, 10000, TransactionStatus.COMPLETED, new Date('2024-01-05')),
        createMockTransactionWithDate(TransactionType.REFUND, -2000, TransactionStatus.COMPLETED, new Date('2024-01-05')),
      ] as never)

      const result = await service.getRevenueByPeriod(propertyId, dateRange, 'daily')

      expect(result).toHaveLength(1)
      expect(result[0]!.revenueCents).toBe(10000)
    })

    it('should exclude pending transactions', async () => {
      vi.mocked(mockTransactionRepo.findByProperty).mockResolvedValue([
        createMockTransactionWithDate(TransactionType.PAYMENT, 10000, TransactionStatus.COMPLETED, new Date('2024-01-05')),
        createMockTransactionWithDate(TransactionType.PAYMENT, 5000, TransactionStatus.PENDING, new Date('2024-01-05')),
      ] as never)

      const result = await service.getRevenueByPeriod(propertyId, dateRange, 'daily')

      expect(result).toHaveLength(1)
      expect(result[0]!.revenueCents).toBe(10000)
    })
  })

  describe('calculateNetRevenue', () => {
    it('should calculate revenue minus refunds', async () => {
      vi.mocked(mockTransactionRepo.findByProperty).mockResolvedValue([
        createMockTransaction(TransactionType.PAYMENT, 10000, TransactionStatus.COMPLETED),
        createMockTransaction(TransactionType.REFUND, -2000, TransactionStatus.COMPLETED),
      ] as never)

      const netRevenue = await service.calculateNetRevenue('property-123', {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      })

      expect(netRevenue).toBe(8000)
    })
  })

  describe('getYearToDateSummary', () => {
    it('should call getFinancialSummary with year start', async () => {
      const summary = await service.getYearToDateSummary('property-123')

      expect(summary.propertyId).toBe('property-123')
      expect(summary.dateRange.startDate.getMonth()).toBe(0)
      expect(summary.dateRange.startDate.getDate()).toBe(1)
    })
  })

  describe('getMonthToDateSummary', () => {
    it('should call getFinancialSummary with month start', async () => {
      const summary = await service.getMonthToDateSummary('property-123')

      expect(summary.propertyId).toBe('property-123')
      expect(summary.dateRange.startDate.getDate()).toBe(1)
    })
  })
})

// Helper functions - create mock objects that match Transaction entity structure
function createMockTransaction(type: TransactionType, amountCents: number, status: TransactionStatus) {
  return {
    type,
    status,
    amount: { amountInCents: amountCents },
    createdAt: new Date(),
  }
}

function createMockTransactionWithDate(
  type: TransactionType,
  amountCents: number,
  status: TransactionStatus,
  createdAt: Date
) {
  return {
    type,
    status,
    amount: { amountInCents: amountCents },
    createdAt,
  }
}

// Invoice mock with MoneyAmount-like balance getter
function createMockInvoice(status: string, balanceDueCents: number, dueDate: Date) {
  return {
    status,
    balance: { amountInCents: balanceDueCents },
    dueDate,
  }
}

// SecurityDeposit mock with MoneyAmount-like depositAmount getter
function createMockDeposit(status: string, amountCents: number) {
  return {
    status,
    depositAmount: { amountInCents: amountCents },
  }
}

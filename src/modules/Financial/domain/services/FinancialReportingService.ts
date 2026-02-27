/**
 * Financial Reporting Service Implementation
 *
 * Provides financial summaries by aggregating data from repositories.
 */

import type { ITransactionRepository } from '../ITransactionRepository'
import type { IInvoiceRepository } from '../IInvoiceRepository'
import type { ISecurityDepositRepository } from '../ISecurityDepositRepository'
import { TransactionType } from '../value-objects/TransactionType'
import { TransactionStatus } from '../value-objects/TransactionStatus'
import type {
  IFinancialReportingService,
  DateRange,
  FinancialSummary,
  RevenueByPeriod,
  TopRevenueSource,
} from './IFinancialReportingService'

export class FinancialReportingService implements IFinancialReportingService {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly invoiceRepository: IInvoiceRepository,
    private readonly depositRepository: ISecurityDepositRepository
  ) {}

  async getFinancialSummary(
    propertyId: string,
    dateRange: DateRange
  ): Promise<FinancialSummary> {
    // Fetch all relevant transactions for the period
    const transactions = await this.transactionRepository.findByProperty(propertyId, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    })

    // Calculate revenue from completed transactions
    let reservationRevenue = 0
    let feeRevenue = 0
    let otherRevenue = 0
    let refundTotal = 0
    let refundCount = 0
    let completedCount = 0
    let failedCount = 0
    let pendingCount = 0

    for (const tx of transactions) {
      if (tx.status === TransactionStatus.COMPLETED) {
        completedCount++
        switch (tx.type) {
          case TransactionType.PAYMENT:
          case TransactionType.DEPOSIT:
            reservationRevenue += tx.amount.amountInCents
            break
          case TransactionType.PLATFORM_FEE:
            feeRevenue += tx.amount.amountInCents
            break
          case TransactionType.REFUND:
            refundTotal += Math.abs(tx.amount.amountInCents)
            refundCount++
            break
          default:
            otherRevenue += tx.amount.amountInCents
        }
      } else if (tx.status === TransactionStatus.FAILED) {
        failedCount++
      } else if (tx.status === TransactionStatus.PENDING) {
        pendingCount++
      }
    }

    // Get overdue invoices
    const overdueInvoices = await this.invoiceRepository.findOverdueInvoices(propertyId)
    const overdueCount = overdueInvoices.length
    let overdueCents = 0

    for (const invoice of overdueInvoices) {
      overdueCents += invoice.balance.amountInCents
    }

    // Note: findByProperty is not available, so outstanding totals are limited to overdue invoices
    // For a complete picture, the repository interface would need to be extended
    const outstandingTotal = overdueCents
    const invoiceCount = overdueCount

    // Get held security deposits
    const heldDeposits = await this.depositRepository.findHeldByProperty(propertyId)
    let heldCents = 0
    const pendingDepositCount = heldDeposits.length

    for (const deposit of heldDeposits) {
      heldCents += deposit.depositAmount.amountInCents
    }

    // Note: Released/deducted totals require findByProperty which is not available
    const releasedCents = 0
    const deductedCents = 0

    return {
      propertyId,
      dateRange,
      revenue: {
        totalCents: reservationRevenue + feeRevenue + otherRevenue,
        reservationsCents: reservationRevenue,
        feesCents: feeRevenue,
        otherCents: otherRevenue,
      },
      refunds: {
        totalCents: refundTotal,
        count: refundCount,
      },
      outstanding: {
        totalCents: outstandingTotal,
        invoiceCount,
        overdueCount,
        overdueCents,
      },
      deposits: {
        heldCents,
        releasedCents,
        deductedCents,
        pendingCount: pendingDepositCount,
      },
      transactions: {
        totalCount: transactions.length,
        completedCount,
        failedCount,
        pendingCount,
      },
    }
  }

  async getRevenueByPeriod(
    propertyId: string,
    dateRange: DateRange,
    granularity: 'daily' | 'weekly' | 'monthly'
  ): Promise<RevenueByPeriod[]> {
    const transactions = await this.transactionRepository.findByProperty(propertyId, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    })

    // Group transactions by period
    const periodMap = new Map<string, { revenue: number; count: number }>()

    for (const tx of transactions) {
      if (tx.status !== TransactionStatus.COMPLETED) continue
      if (tx.type === TransactionType.REFUND) continue // Don't count refunds as revenue

      const period = this.getPeriodKey(tx.createdAt, granularity)
      const existing = periodMap.get(period) ?? { revenue: 0, count: 0 }
      existing.revenue += tx.amount.amountInCents
      existing.count++
      periodMap.set(period, existing)
    }

    // Convert to sorted array
    return Array.from(periodMap.entries())
      .map(([period, data]) => ({
        period,
        revenueCents: data.revenue,
        reservationCount: data.count,
      }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }

  private getPeriodKey(date: Date, granularity: 'daily' | 'weekly' | 'monthly'): string {
    // Use UTC methods for consistent behavior across timezones
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')

    switch (granularity) {
      case 'daily':
        return `${year}-${month}-${day}`
      case 'weekly': {
        // Get ISO week number using UTC
        const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
        const dayNum = d.getUTCDay() || 7
        d.setUTCDate(d.getUTCDate() + 4 - dayNum)
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
        const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
        return `${year}-W${String(weekNum).padStart(2, '0')}`
      }
      case 'monthly':
        return `${year}-${month}`
    }
  }

  async getTopRevenueSources(
    propertyId: string,
    dateRange: DateRange,
    limit: number
  ): Promise<TopRevenueSource[]> {
    const transactions = await this.transactionRepository.findByProperty(propertyId, {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    })

    // Group by site (using reservationId to look up site)
    // Note: In a real implementation, we'd join with reservations to get site info
    // For now, we'll return an empty array as this requires cross-module integration
    const siteMap = new Map<string, { revenue: number; count: number; name: string }>()

    for (const tx of transactions) {
      if (tx.status !== TransactionStatus.COMPLETED) continue
      if (tx.type === TransactionType.REFUND) continue
      // Note: Transaction entity doesn't have metadata property exposed
      // This would require extending the Transaction entity or using notes field
      // For now, skip site-based grouping as it requires additional design
    }

    return Array.from(siteMap.entries())
      .map(([siteId, data]) => ({
        siteId,
        siteName: data.name,
        revenueCents: data.revenue,
        reservationCount: data.count,
      }))
      .sort((a, b) => b.revenueCents - a.revenueCents)
      .slice(0, limit)
  }

  async calculateNetRevenue(
    propertyId: string,
    dateRange: DateRange
  ): Promise<number> {
    const summary = await this.getFinancialSummary(propertyId, dateRange)
    return summary.revenue.totalCents - summary.refunds.totalCents
  }

  async getYearToDateSummary(propertyId: string): Promise<FinancialSummary> {
    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)

    return this.getFinancialSummary(propertyId, {
      startDate: startOfYear,
      endDate: now,
    })
  }

  async getMonthToDateSummary(propertyId: string): Promise<FinancialSummary> {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    return this.getFinancialSummary(propertyId, {
      startDate: startOfMonth,
      endDate: now,
    })
  }
}

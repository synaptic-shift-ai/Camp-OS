/**
 * Financial Reporting Service Interface
 *
 * Provides financial summaries and reporting capabilities.
 */

export interface DateRange {
  startDate: Date
  endDate: Date
}

export interface FinancialSummary {
  propertyId: string
  dateRange: DateRange
  revenue: {
    totalCents: number
    reservationsCents: number
    feesCents: number
    otherCents: number
  }
  refunds: {
    totalCents: number
    count: number
  }
  outstanding: {
    totalCents: number
    invoiceCount: number
    overdueCount: number
    overdueCents: number
  }
  deposits: {
    heldCents: number
    releasedCents: number
    deductedCents: number
    pendingCount: number
  }
  transactions: {
    totalCount: number
    completedCount: number
    failedCount: number
    pendingCount: number
  }
}

export interface RevenueByPeriod {
  period: string // YYYY-MM or YYYY-MM-DD depending on granularity
  revenueCents: number
  reservationCount: number
}

export interface TopRevenueSource {
  siteId: string
  siteName: string
  revenueCents: number
  reservationCount: number
}

export interface IFinancialReportingService {
  /**
   * Get a financial summary for a property within a date range
   */
  getFinancialSummary(propertyId: string, dateRange: DateRange): Promise<FinancialSummary>

  /**
   * Get revenue breakdown by time period
   */
  getRevenueByPeriod(
    propertyId: string,
    dateRange: DateRange,
    granularity: 'daily' | 'weekly' | 'monthly'
  ): Promise<RevenueByPeriod[]>

  /**
   * Get top revenue-generating sites
   */
  getTopRevenueSources(
    propertyId: string,
    dateRange: DateRange,
    limit: number
  ): Promise<TopRevenueSource[]>

  /**
   * Calculate net revenue (revenue - refunds)
   */
  calculateNetRevenue(propertyId: string, dateRange: DateRange): Promise<number>

  /**
   * Get year-to-date summary
   */
  getYearToDateSummary(propertyId: string): Promise<FinancialSummary>

  /**
   * Get month-to-date summary
   */
  getMonthToDateSummary(propertyId: string): Promise<FinancialSummary>
}

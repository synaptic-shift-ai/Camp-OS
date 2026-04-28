// Financial Module Barrel Export

// Domain - Aggregates
export { Invoice } from './domain/Invoice'
export { PaymentPlan } from './domain/PaymentPlan'
export { SecurityDeposit } from './domain/SecurityDeposit'
export type { DepositDeduction } from './domain/SecurityDeposit'
export { Transaction } from './domain/Transaction'

// Domain - Repository Interfaces
export type { IInvoiceRepository } from './domain/IInvoiceRepository'
export type { IPaymentPlanRepository } from './domain/IPaymentPlanRepository'
export type { ISecurityDepositRepository } from './domain/ISecurityDepositRepository'
export type { ITransactionRepository, TransactionFilters } from './domain/ITransactionRepository'

// Domain - Value Objects
export { DepositStatus } from './domain/value-objects/DepositStatus'
export { InvoiceLineItem } from './domain/value-objects/InvoiceLineItem'
export { InvoiceNumber } from './domain/value-objects/InvoiceNumber'
export { InvoiceStatus } from './domain/value-objects/InvoiceStatus'
export { PaymentMethod } from './domain/value-objects/PaymentMethod'
export { PaymentPlanStatus } from './domain/value-objects/PaymentPlanStatus'
export { RecognitionStatus } from './domain/value-objects/RecognitionStatus'
export { RefundHandling } from './domain/value-objects/RefundHandling'
export { TransactionSource } from './domain/value-objects/TransactionSource'
export { TransactionStatus } from './domain/value-objects/TransactionStatus'
export { TransactionType } from './domain/value-objects/TransactionType'

// Domain - Events
export * from './domain/events'

// Domain - Services
export * from './domain/services'

// Application - Commands
export { CreatePaymentPlanCommandHandler } from './application/commands/CreatePaymentPlanCommand'
export { GenerateInvoiceCommandHandler } from './application/commands/GenerateInvoiceCommand'
export { HoldSecurityDepositCommandHandler } from './application/commands/HoldSecurityDepositCommand'
export { ProcessRefundCommandHandler } from './application/commands/ProcessRefundCommand'
export { RecordPaymentCommandHandler } from './application/commands/RecordPaymentCommand'
export { ReleaseSecurityDepositCommandHandler } from './application/commands/ReleaseSecurityDepositCommand'

// Application - Queries
export { GetInvoiceQueryHandler } from './application/queries/GetInvoiceQuery'
export { GetPropertyTransactionsQueryHandler } from './application/queries/GetPropertyTransactionsQuery'
export { GetReservationBalanceQueryHandler } from './application/queries/GetReservationBalanceQuery'
export { GetTransactionQueryHandler } from './application/queries/GetTransactionQuery'

// Application - DTOs
export { toInvoiceDTO } from './application/DTOs/InvoiceDTO'
export { toPaymentPlanDTO } from './application/DTOs/PaymentPlanDTO'
export { toSecurityDepositDTO } from './application/DTOs/SecurityDepositDTO'
export { toTransactionDTO } from './application/DTOs/TransactionDTO'

// Infrastructure
export { SupabaseInvoiceRepository } from './infrastructure/SupabaseInvoiceRepository'
export { SupabasePaymentPlanRepository } from './infrastructure/SupabasePaymentPlanRepository'
export { SupabaseSecurityDepositRepository } from './infrastructure/SupabaseSecurityDepositRepository'
export { SupabaseTransactionRepository } from './infrastructure/SupabaseTransactionRepository'

// Infrastructure - Stripe
export * from './infrastructure/stripe'

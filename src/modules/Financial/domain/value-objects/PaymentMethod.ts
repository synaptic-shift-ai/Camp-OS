/**
 * PaymentMethod Enum
 *
 * Defines all accepted payment methods in the system.
 */

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  CASH = 'cash',
  CHECK = 'check',
  BANK_TRANSFER = 'bank_transfer',
  STRIPE = 'stripe',
  STORE_CREDIT = 'store_credit',
}

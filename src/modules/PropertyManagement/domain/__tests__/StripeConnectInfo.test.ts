/**
 * StripeConnectInfo Value Object Tests
 */
import { describe, it, expect } from 'vitest'
import { StripeConnectInfo } from '../StripeConnectInfo'

describe('StripeConnectInfo', () => {
  describe('create', () => {
    it('should create with valid account ID and connected date', () => {
      const accountId = 'acct_123456'
      const connectedAt = new Date('2025-01-01T12:00:00Z')

      const stripeInfo = StripeConnectInfo.create(accountId, connectedAt)

      expect(stripeInfo.accountId).toBe(accountId)
      expect(stripeInfo.connectedAt).toBe(connectedAt)
      expect(stripeInfo.isConnected()).toBe(true)
    })

    it('should trim account ID', () => {
      const accountId = '  acct_123456  '
      const connectedAt = new Date()

      const stripeInfo = StripeConnectInfo.create(accountId, connectedAt)

      expect(stripeInfo.accountId).toBe('acct_123456')
    })

    it('should throw if account ID is empty', () => {
      const connectedAt = new Date()

      expect(() => StripeConnectInfo.create('', connectedAt)).toThrow(
        'Stripe account ID is required'
      )
    })

    it('should throw if account ID is whitespace only', () => {
      const connectedAt = new Date()

      expect(() => StripeConnectInfo.create('   ', connectedAt)).toThrow(
        'Stripe account ID is required'
      )
    })
  })

  describe('notConnected', () => {
    it('should create not-connected state', () => {
      const stripeInfo = StripeConnectInfo.notConnected()

      expect(stripeInfo.accountId).toBeNull()
      expect(stripeInfo.connectedAt).toBeNull()
      expect(stripeInfo.isConnected()).toBe(false)
    })
  })

  describe('isConnected', () => {
    it('should return true when account ID exists', () => {
      const stripeInfo = StripeConnectInfo.create('acct_123', new Date())

      expect(stripeInfo.isConnected()).toBe(true)
    })

    it('should return false when not connected', () => {
      const stripeInfo = StripeConnectInfo.notConnected()

      expect(stripeInfo.isConnected()).toBe(false)
    })
  })

  describe('getDaysSinceConnection', () => {
    it('should calculate days since connection', () => {
      const daysAgo = 30
      const connectedAt = new Date()
      connectedAt.setDate(connectedAt.getDate() - daysAgo)

      const stripeInfo = StripeConnectInfo.create('acct_123', connectedAt)

      expect(stripeInfo.getDaysSinceConnection()).toBe(daysAgo)
    })

    it('should return null when not connected', () => {
      const stripeInfo = StripeConnectInfo.notConnected()

      expect(stripeInfo.getDaysSinceConnection()).toBeNull()
    })

    it('should return 0 for same-day connection', () => {
      const connectedAt = new Date()

      const stripeInfo = StripeConnectInfo.create('acct_123', connectedAt)

      expect(stripeInfo.getDaysSinceConnection()).toBe(0)
    })
  })
})

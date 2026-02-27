/**
 * SupabaseGuestRepository Tests
 *
 * Tests the Supabase implementation of IGuestRepository with mocked client.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupabaseGuestRepository } from '../SupabaseGuestRepository'
import { Guest } from '../../domain/Guest'
import { PersonName } from '../../domain/value-objects/PersonName'
import { ContactInfo } from '../../domain/value-objects/ContactInfo'

type GuestRow = {
  id: string
  property_id: string
  user_id: string | null
  first_name: string
  last_name: string
  email: string
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  country: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  stripe_customer_id: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// Mock Supabase client
function createMockSupabaseClient() {
  const queryBuilder: any = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  }

  // Make all methods return queryBuilder for chaining
  queryBuilder.select.mockReturnValue(queryBuilder)
  queryBuilder.eq.mockReturnValue(queryBuilder)
  queryBuilder.order.mockReturnValue(queryBuilder)
  queryBuilder.update.mockReturnValue(queryBuilder)
  queryBuilder.insert.mockReturnValue(queryBuilder)
  queryBuilder.delete.mockReturnValue(queryBuilder)

  const from = vi.fn(() => queryBuilder)

  const client = {
    from,
  }

  return {
    client: client as any,
    queryBuilder,
  }
}

describe('SupabaseGuestRepository', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>
  let repository: SupabaseGuestRepository

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new SupabaseGuestRepository(mockSupabase.client)
    // Reset all mocks including return values
    vi.clearAllMocks()
    // Re-setup the chainable behavior after clearAllMocks
    mockSupabase.queryBuilder.select.mockReturnValue(mockSupabase.queryBuilder)
    mockSupabase.queryBuilder.eq.mockReturnValue(mockSupabase.queryBuilder)
    mockSupabase.queryBuilder.order.mockReturnValue(mockSupabase.queryBuilder)
    mockSupabase.queryBuilder.update.mockReturnValue(mockSupabase.queryBuilder)
    mockSupabase.queryBuilder.insert.mockReturnValue(mockSupabase.queryBuilder)
    mockSupabase.queryBuilder.delete.mockReturnValue(mockSupabase.queryBuilder)
  })

  describe('findById', () => {
    it('should return guest when found', async () => {
      const mockRow: GuestRow = {
        id: 'guest-123',
        property_id: 'prop-456',
        user_id: 'user-789',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip_code: '97201',
        country: 'USA',
        emergency_contact_name: null,
        emergency_contact_phone: null,
        stripe_customer_id: 'cus_123456',
        notes: 'VIP guest',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findById('guest-123')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('guest-123')
      expect(result?.propertyId).toBe('prop-456')
      expect(result?.name.firstName).toBe('John')
      expect(result?.name.lastName).toBe('Doe')
      expect(result?.contact.email).toBe('john@example.com')
      expect(mockSupabase.client.from).toHaveBeenCalledWith('guests')
      expect(mockSupabase.queryBuilder.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('id', 'guest-123')
    })

    it('should return null when guest not found', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const result = await repository.findById('non-existent')

      expect(result).toBeNull()
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const result = await repository.findById('guest-123')

      expect(result).toBeNull()
    })

    it('should always use select("*") for complete entity', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      await repository.findById('guest-123')

      // CRITICAL: Verify we're selecting ALL fields
      expect(mockSupabase.queryBuilder.select).toHaveBeenCalledWith('*')
    })
  })

  describe('findByEmail', () => {
    it('should return guest when found by property and email', async () => {
      const mockRow: GuestRow = {
        id: 'guest-123',
        property_id: 'prop-456',
        user_id: null,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        stripe_customer_id: null,
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findByEmail('prop-456', 'john@example.com')

      expect(result).not.toBeNull()
      expect(result?.contact.email).toBe('john@example.com')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('property_id', 'prop-456')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('email', 'john@example.com')
    })

    it('should return null when email not found for property', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const result = await repository.findByEmail('prop-456', 'nonexistent@example.com')

      expect(result).toBeNull()
    })

    it('should enforce tenant isolation with property_id', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      await repository.findByEmail('prop-123', 'test@example.com')

      // CRITICAL: Must filter by property_id (tenant isolation)
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('property_id', 'prop-123')
    })
  })

  describe('findByPropertyId', () => {
    it('should return all guests for a property', async () => {
      const mockRows: GuestRow[] = [
        {
          id: 'guest-1',
          property_id: 'prop-456',
          user_id: null,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '555-0100',
          address: null,
          city: null,
          state: null,
          zip_code: null,
          country: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          stripe_customer_id: null,
          notes: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'guest-2',
          property_id: 'prop-456',
          user_id: null,
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          phone: '555-0200',
          address: null,
          city: null,
          state: null,
          zip_code: null,
          country: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          stripe_customer_id: null,
          notes: null,
          created_at: '2025-01-02T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      ]

      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: mockRows,
        error: null,
      })

      const result = await repository.findByPropertyId('prop-456')

      expect(result).toHaveLength(2)
      expect(result[0]!.id).toBe('guest-1')
      expect(result[1]!.id).toBe('guest-2')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('property_id', 'prop-456')
      expect(mockSupabase.queryBuilder.order).toHaveBeenCalledWith('created_at', {
        ascending: true,
      })
    })

    it('should return empty array when no guests found', async () => {
      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: [],
        error: null,
      })

      const result = await repository.findByPropertyId('prop-999')

      expect(result).toEqual([])
    })

    it('should handle database errors', async () => {
      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      })

      const result = await repository.findByPropertyId('prop-456')

      expect(result).toEqual([])
    })
  })

  describe('findByStripeCustomerId', () => {
    it('should return guest when found by Stripe customer ID', async () => {
      const mockRow: GuestRow = {
        id: 'guest-123',
        property_id: 'prop-456',
        user_id: null,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        stripe_customer_id: 'cus_123456',
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findByStripeCustomerId('cus_123456')

      expect(result).not.toBeNull()
      expect(result?.stripeCustomerId).toBe('cus_123456')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith(
        'stripe_customer_id',
        'cus_123456'
      )
    })

    it('should return null when Stripe customer ID not found', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const result = await repository.findByStripeCustomerId('cus_nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('exists', () => {
    it('should return true if guest exists by email for property', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: { id: 'guest-123' },
        error: null,
      })

      const result = await repository.exists('prop-456', 'john@example.com')

      expect(result).toBe(true)
      expect(mockSupabase.queryBuilder.select).toHaveBeenCalledWith('id')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('property_id', 'prop-456')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('email', 'john@example.com')
    })

    it('should return false if guest does not exist', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const result = await repository.exists('prop-456', 'nonexistent@example.com')

      expect(result).toBe(false)
    })
  })

  describe('save', () => {
    it('should insert new guest', async () => {
      // Mock findById to return null (guest doesn't exist)
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      // Mock insert
      mockSupabase.queryBuilder.insert.mockResolvedValue({
        data: null,
        error: null,
      })

      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const contact = ContactInfo.create({ email: 'john@example.com', phone: '555-0100' })
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'prop-456',
        userId: null,
        name,
        contact,
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      await repository.save(guest)

      expect(mockSupabase.queryBuilder.insert).toHaveBeenCalled()
    })

    it('should update existing guest', async () => {
      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const contact = ContactInfo.create({ email: 'john@example.com', phone: '555-0100' })

      const mockRow: GuestRow = {
        id: 'guest-123',
        property_id: 'prop-456',
        user_id: null,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        stripe_customer_id: null,
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      // Mock findById to return existing guest (uses .single())
      mockSupabase.queryBuilder.single.mockResolvedValueOnce({
        data: mockRow,
        error: null,
      })

      // Create a separate mock for the update chain
      const updateEqBuilder: any = {
        then: vi.fn((resolve) => {
          resolve({ data: null, error: null })
          return Promise.resolve({ data: null, error: null })
        }),
      }
      // Mock update().eq() - update returns queryBuilder, which has eq that returns the promise
      mockSupabase.queryBuilder.update.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue(updateEqBuilder),
      } as any)

      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'prop-456',
        userId: null,
        name,
        contact,
        address: null,
        stripeCustomerId: null,
        notes: 'Updated notes',
      })

      await repository.save(guest)

      expect(mockSupabase.queryBuilder.update).toHaveBeenCalled()
    })

    it('should throw error on insert failure', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockSupabase.queryBuilder.insert.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      })

      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const contact = ContactInfo.create({ email: 'john@example.com', phone: '555-0100' })
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'prop-456',
        userId: null,
        name,
        contact,
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      await expect(repository.save(guest)).rejects.toThrow('Failed to create guest: Insert failed')
    })

    it('should throw error on update failure', async () => {
      const mockRow: GuestRow = {
        id: 'guest-123',
        property_id: 'prop-456',
        user_id: null,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        stripe_customer_id: null,
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      // Mock findById to return existing guest (uses .single())
      mockSupabase.queryBuilder.single.mockResolvedValueOnce({
        data: mockRow,
        error: null,
      })

      // Create a separate mock for the update chain with error
      const updateEqBuilder: any = {
        then: vi.fn((resolve) => {
          resolve({ data: null, error: { message: 'Update failed' } })
          return Promise.resolve({ data: null, error: { message: 'Update failed' } })
        }),
      }
      // Mock update().eq() - update returns queryBuilder, which has eq that returns error promise
      mockSupabase.queryBuilder.update.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue(updateEqBuilder),
      } as any)

      const name = PersonName.create({ firstName: 'John', lastName: 'Doe' })
      const contact = ContactInfo.create({ email: 'john@example.com', phone: '555-0100' })
      const guest = Guest.create({
        id: 'guest-123',
        propertyId: 'prop-456',
        userId: null,
        name,
        contact,
        address: null,
        stripeCustomerId: null,
        notes: null,
      })

      await expect(repository.save(guest)).rejects.toThrow('Failed to update guest: Update failed')
    })
  })

  describe('data mapping', () => {
    it('should map complete guest with all fields', async () => {
      const mockRow: GuestRow = {
        id: 'guest-123',
        property_id: 'prop-456',
        user_id: 'user-789',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip_code: '97201',
        country: 'USA',
        emergency_contact_name: 'Jane Doe',
        emergency_contact_phone: '555-0200',
        stripe_customer_id: 'cus_123456',
        notes: 'VIP guest',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findById('guest-123')

      expect(result?.id).toBe('guest-123')
      expect(result?.propertyId).toBe('prop-456')
      expect(result?.userId).toBe('user-789')
      expect(result?.name.firstName).toBe('John')
      expect(result?.name.lastName).toBe('Doe')
      expect(result?.name.getFullName()).toBe('John Doe')
      expect(result?.contact.email).toBe('john@example.com')
      expect(result?.contact.phone).toBe('555-0100')
      expect(result?.contact.emergencyContactName).toBe('Jane Doe')
      expect(result?.contact.emergencyContactPhone).toBe('555-0200')
      expect(result?.address?.street).toBe('123 Main St')
      expect(result?.address?.city).toBe('Portland')
      expect(result?.address?.state).toBe('OR')
      expect(result?.address?.zipCode).toBe('97201')
      expect(result?.address?.country).toBe('USA')
      expect(result?.stripeCustomerId).toBe('cus_123456')
      expect(result?.notes).toBe('VIP guest')
    })

    it('should map guest with minimal fields (nulls)', async () => {
      const mockRow: GuestRow = {
        id: 'guest-123',
        property_id: 'prop-456',
        user_id: null,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: null,
        city: null,
        state: null,
        zip_code: null,
        country: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        stripe_customer_id: null,
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findById('guest-123')

      expect(result?.userId).toBeNull()
      expect(result?.address).toBeNull()
      expect(result?.stripeCustomerId).toBeNull()
      expect(result?.notes).toBeNull()
      expect(result?.hasAddress()).toBe(false)
      expect(result?.hasEmergencyContact()).toBe(false)
      expect(result?.hasStripeCustomer()).toBe(false)
    })

    it('should handle partial address (should map to null in domain)', async () => {
      const mockRow: GuestRow = {
        id: 'guest-123',
        property_id: 'prop-456',
        user_id: null,
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0100',
        address: '123 Main St',
        city: 'Portland',
        state: null, // Partial address - missing required field
        zip_code: null,
        country: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        stripe_customer_id: null,
        notes: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findById('guest-123')

      // Address value object requires all fields, so partial = null
      expect(result?.address).toBeNull()
    })
  })
})

/**
 * SupabaseSiteRepository Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SupabaseSiteRepository } from '../SupabaseSiteRepository'
import { Site } from '../../domain/Site'
import { SiteType } from '../../domain/SiteType'
import { SiteStatus } from '../../domain/SiteStatus'
import { Pricing } from '../../domain/Pricing'
import type { Database } from '@/contracts/db'

type SiteRow = Database['public']['Tables']['sites']['Row']

// Mock Supabase client
function createMockSupabaseClient() {
  const mockData: SiteRow[] = []

  const queryBuilder: any = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  }

  // Make all methods return queryBuilder for chaining
  queryBuilder.select.mockReturnValue(queryBuilder)
  queryBuilder.eq.mockReturnValue(queryBuilder)
  queryBuilder.order.mockReturnValue(queryBuilder)
  queryBuilder.range.mockReturnValue(queryBuilder)
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
    mockData,
  }
}

describe('SupabaseSiteRepository', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>
  let repository: SupabaseSiteRepository

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient()
    repository = new SupabaseSiteRepository(mockSupabase.client)
    // Reset all mocks
    vi.clearAllMocks()
  })

  describe('findById', () => {
    it('should return site when found', async () => {
      const mockRow: SiteRow = {
        id: 'site-123',
        property_id: 'prop-456',
        site_number: '42',
        site_name: 'Test Site',
        site_type: SiteType.RV,
        status: SiteStatus.AVAILABLE,
        base_price: 7500,
        weekend_price: 9000,
        max_occupancy: 6,
        max_vehicles: 2,
        size_sqft: 1000,
        description: 'Test description',
        amenities: ['picnic_table'],
        hookups: ['water', 'electric'],
        images: ['img1.jpg'],
        location_map: { lat: 40.7, lng: -74.0 },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findById('site-123')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('site-123')
      expect(result?.propertyId).toBe('prop-456')
      expect(result?.siteNumber).toBe('42')
      expect(mockSupabase.client.from).toHaveBeenCalledWith('sites')
      expect(mockSupabase.queryBuilder.select).toHaveBeenCalledWith('*')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('id', 'site-123')
    })

    it('should return null when site not found', async () => {
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

      const result = await repository.findById('site-123')

      expect(result).toBeNull()
    })

    it('should always use select("*") for complete entity', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      await repository.findById('site-123')

      // CRITICAL: Verify we're selecting ALL fields
      expect(mockSupabase.queryBuilder.select).toHaveBeenCalledWith('*')
    })
  })

  describe('findBySiteNumber', () => {
    it('should return site when found by property and site number', async () => {
      const mockRow: SiteRow = {
        id: 'site-123',
        property_id: 'prop-456',
        site_number: '42',
        site_name: 'Test Site',
        site_type: SiteType.TENT,
        status: SiteStatus.AVAILABLE,
        base_price: 5000,
        weekend_price: 6000,
        max_occupancy: null,
        max_vehicles: null,
        size_sqft: null,
        description: null,
        amenities: null,
        hookups: null,
        images: null,
        location_map: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findBySiteNumber('prop-456', '42')

      expect(result).not.toBeNull()
      expect(result?.siteNumber).toBe('42')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('property_id', 'prop-456')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('site_number', '42')
    })

    it('should return null when site number not found', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const result = await repository.findBySiteNumber('prop-456', '999')

      expect(result).toBeNull()
    })
  })

  describe('findByPropertyId', () => {
    it('should return all sites for a property', async () => {
      const mockRows: SiteRow[] = [
        {
          id: 'site-1',
          property_id: 'prop-456',
          site_number: '1',
          site_name: 'Site 1',
          site_type: SiteType.TENT,
          status: SiteStatus.AVAILABLE,
          base_price: 5000,
          weekend_price: 6000,
          max_occupancy: null,
          max_vehicles: null,
          size_sqft: null,
          description: null,
          amenities: null,
          hookups: null,
          images: null,
          location_map: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
        {
          id: 'site-2',
          property_id: 'prop-456',
          site_number: '2',
          site_name: 'Site 2',
          site_type: SiteType.RV,
          status: SiteStatus.OCCUPIED,
          base_price: 7500,
          weekend_price: 9000,
          max_occupancy: null,
          max_vehicles: null,
          size_sqft: null,
          description: null,
          amenities: null,
          hookups: null,
          images: null,
          location_map: null,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      ]

      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: mockRows,
        error: null,
      })

      const result = await repository.findByPropertyId('prop-456')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('site-1')
      expect(result[1].id).toBe('site-2')
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('property_id', 'prop-456')
      expect(mockSupabase.queryBuilder.order).toHaveBeenCalledWith('site_number', { ascending: true })
    })

    it('should return empty array when no sites found', async () => {
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

  describe('findByPropertyIdWithFilters', () => {
    const createMockRow = (overrides: Partial<SiteRow> = {}): SiteRow => ({
      id: 'site-123',
      property_id: 'prop-456',
      site_number: '42',
      site_name: 'Test Site',
      site_type: SiteType.TENT,
      status: SiteStatus.AVAILABLE,
      base_price: 5000,
      weekend_price: 6000,
      max_occupancy: null,
      max_vehicles: null,
      size_sqft: null,
      description: null,
      amenities: null,
      hookups: null,
      images: null,
      location_map: null,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      ...overrides,
    })

    it('should filter by status', async () => {
      const mockRows = [createMockRow({ status: SiteStatus.AVAILABLE })]

      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: mockRows,
        error: null,
        count: 1,
      })

      const result = await repository.findByPropertyIdWithFilters('prop-456', {
        status: SiteStatus.AVAILABLE,
      })

      expect(result.sites).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(mockSupabase.queryBuilder.select).toHaveBeenCalledWith('*', { count: 'exact' })
    })

    it('should filter by site type', async () => {
      const mockRows = [createMockRow({ site_type: SiteType.TENT })]

      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: mockRows,
        error: null,
        count: 1,
      })

      const result = await repository.findByPropertyIdWithFilters('prop-456', {
        siteType: SiteType.TENT,
      })

      expect(result.sites).toHaveLength(1)
    })

    it('should filter by availableOnly', async () => {
      const mockRows = [createMockRow({ status: SiteStatus.AVAILABLE })]

      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: mockRows,
        error: null,
        count: 1,
      })

      await repository.findByPropertyIdWithFilters('prop-456', {
        availableOnly: true,
      })

      // Should add status filter
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('status', SiteStatus.AVAILABLE)
    })

    it('should apply pagination with limit', async () => {
      const mockRows = [createMockRow()]

      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: mockRows,
        error: null,
        count: 10,
      })

      const result = await repository.findByPropertyIdWithFilters('prop-456', {
        limit: 5,
      })

      expect(mockSupabase.queryBuilder.range).toHaveBeenCalledWith(0, 4)
      expect(result.total).toBe(10) // Total count, not filtered
    })

    it('should apply pagination with limit and offset', async () => {
      const mockRows = [createMockRow()]

      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: mockRows,
        error: null,
        count: 20,
      })

      await repository.findByPropertyIdWithFilters('prop-456', {
        limit: 5,
        offset: 10,
      })

      expect(mockSupabase.queryBuilder.range).toHaveBeenCalledWith(10, 14)
    })

    it('should return empty result on error', async () => {
      mockSupabase.queryBuilder.order.mockResolvedValue({
        data: null,
        error: { message: 'Error' },
        count: null,
      })

      const result = await repository.findByPropertyIdWithFilters('prop-456', {})

      expect(result.sites).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('save', () => {
    it('should insert new site', async () => {
      // Mock findById to return null (site doesn't exist)
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      // Mock insert
      mockSupabase.queryBuilder.insert.mockResolvedValue({
        data: null,
        error: null,
      })

      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test Site', SiteType.TENT, pricing)

      await repository.save(site)

      expect(mockSupabase.queryBuilder.insert).toHaveBeenCalled()
    })

    it('should update existing site', async () => {
      // Mock findById to return existing site
      const mockRow: SiteRow = {
        id: 'site-123',
        property_id: 'prop-456',
        site_number: '42',
        site_name: 'Existing Site',
        site_type: SiteType.TENT,
        status: SiteStatus.AVAILABLE,
        base_price: 5000,
        weekend_price: 6000,
        max_occupancy: null,
        max_vehicles: null,
        size_sqft: null,
        description: null,
        amenities: null,
        hookups: null,
        images: null,
        location_map: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      // Mock the chain for findById: from().select().eq().single()
      // Create a mock single that returns the data
      const mockSingleForSelect = vi.fn().mockResolvedValueOnce({
        data: mockRow,
        error: null,
      })

      // Mock eq() for the select chain to return an object with single()
      const mockEqForSelect = vi.fn().mockReturnValueOnce({
        single: mockSingleForSelect,
      })

      // Mock select() to return an object with eq()
      mockSupabase.queryBuilder.select.mockReturnValueOnce({
        eq: mockEqForSelect,
      } as any)

      // Mock the update chain: from().update().eq()
      const mockEqForUpdate = vi.fn().mockResolvedValueOnce({
        data: null,
        error: null,
      })

      mockSupabase.queryBuilder.update.mockReturnValueOnce({
        eq: mockEqForUpdate,
      } as any)

      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Updated Site', SiteType.TENT, pricing)

      await repository.save(site)

      expect(mockSupabase.queryBuilder.update).toHaveBeenCalled()
      expect(mockEqForUpdate).toHaveBeenCalledWith('id', 'site-123')
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

      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Test Site', SiteType.TENT, pricing)

      await expect(repository.save(site)).rejects.toThrow('Failed to create site: Insert failed')
    })

    it('should throw error on update failure', async () => {
      const mockRow: SiteRow = {
        id: 'site-123',
        property_id: 'prop-456',
        site_number: '42',
        site_name: 'Test Site',
        site_type: SiteType.TENT,
        status: SiteStatus.AVAILABLE,
        base_price: 5000,
        weekend_price: 6000,
        max_occupancy: null,
        max_vehicles: null,
        size_sqft: null,
        description: null,
        amenities: null,
        hookups: null,
        images: null,
        location_map: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      // Mock the chain for findById: from().select().eq().single()
      const mockSingleForSelect = vi.fn().mockResolvedValueOnce({
        data: mockRow,
        error: null,
      })

      const mockEqForSelect = vi.fn().mockReturnValueOnce({
        single: mockSingleForSelect,
      })

      mockSupabase.queryBuilder.select.mockReturnValueOnce({
        eq: mockEqForSelect,
      } as any)

      // Mock the update chain to return error
      const mockEqForUpdate = vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      })

      mockSupabase.queryBuilder.update.mockReturnValueOnce({
        eq: mockEqForUpdate,
      } as any)

      const pricing = Pricing.create(7500, 9000, 'USD')
      const site = Site.create('site-123', 'prop-456', '42', 'Updated Site', SiteType.TENT, pricing)

      await expect(repository.save(site)).rejects.toThrow('Failed to update site: Update failed')
    })
  })

  describe('delete', () => {
    it('should delete site', async () => {
      // Mock the final .eq() in the chain to return success
      mockSupabase.queryBuilder.eq.mockResolvedValue({
        data: null,
        error: null,
      })

      await repository.delete('site-123')

      expect(mockSupabase.queryBuilder.delete).toHaveBeenCalled()
      expect(mockSupabase.queryBuilder.eq).toHaveBeenCalledWith('id', 'site-123')
    })

    it('should throw error on delete failure', async () => {
      // Mock the final .eq() to return error
      mockSupabase.queryBuilder.eq.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      })

      await expect(repository.delete('site-123')).rejects.toThrow('Failed to delete site: Delete failed')
    })
  })

  describe('existsBySiteNumber', () => {
    it('should return true if site number exists', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: { id: 'site-123' },
        error: null,
      })

      const result = await repository.existsBySiteNumber('prop-456', '42')

      expect(result).toBe(true)
      expect(mockSupabase.queryBuilder.select).toHaveBeenCalledWith('id')
    })

    it('should return false if site number does not exist', async () => {
      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      const result = await repository.existsBySiteNumber('prop-456', '999')

      expect(result).toBe(false)
    })
  })

  describe('data mapping', () => {
    it('should parse JSON arrays correctly', async () => {
      const mockRow: SiteRow = {
        id: 'site-123',
        property_id: 'prop-456',
        site_number: '42',
        site_name: 'Test Site',
        site_type: SiteType.RV,
        status: SiteStatus.AVAILABLE,
        base_price: 7500,
        weekend_price: 9000,
        max_occupancy: null,
        max_vehicles: null,
        size_sqft: null,
        description: null,
        amenities: ['picnic_table', 'fire_ring'],
        hookups: ['water', 'electric'],
        images: ['img1.jpg', 'img2.jpg'],
        location_map: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findById('site-123')

      expect(result?.amenities).toEqual(['picnic_table', 'fire_ring'])
      expect(result?.hookups).toEqual(['water', 'electric'])
      expect(result?.images).toEqual(['img1.jpg', 'img2.jpg'])
    })

    it('should parse JSON objects correctly', async () => {
      const mockRow: SiteRow = {
        id: 'site-123',
        property_id: 'prop-456',
        site_number: '42',
        site_name: 'Test Site',
        site_type: SiteType.TENT,
        status: SiteStatus.AVAILABLE,
        base_price: 5000,
        weekend_price: 6000,
        max_occupancy: null,
        max_vehicles: null,
        size_sqft: null,
        description: null,
        amenities: null,
        hookups: null,
        images: null,
        location_map: { lat: 40.7128, lng: -74.006 },
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findById('site-123')

      expect(result?.locationMap).toEqual({ lat: 40.7128, lng: -74.006 })
    })

    it('should handle null JSON fields', async () => {
      const mockRow: SiteRow = {
        id: 'site-123',
        property_id: 'prop-456',
        site_number: '42',
        site_name: 'Test Site',
        site_type: SiteType.TENT,
        status: SiteStatus.AVAILABLE,
        base_price: 5000,
        weekend_price: 6000,
        max_occupancy: null,
        max_vehicles: null,
        size_sqft: null,
        description: null,
        amenities: null,
        hookups: null,
        images: null,
        location_map: null,
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      }

      mockSupabase.queryBuilder.single.mockResolvedValue({
        data: mockRow,
        error: null,
      })

      const result = await repository.findById('site-123')

      expect(result?.amenities).toBeNull()
      expect(result?.hookups).toBeNull()
      expect(result?.images).toBeNull()
      expect(result?.locationMap).toBeNull()
    })
  })
})

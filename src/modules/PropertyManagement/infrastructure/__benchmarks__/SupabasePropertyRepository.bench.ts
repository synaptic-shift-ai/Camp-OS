/**
 * Performance Benchmarks for SupabasePropertyRepository
 *
 * Week 6 Deliverable: Unit-level performance benchmarks
 *
 * These benchmarks measure the mapping overhead introduced by the repository pattern:
 * - toDomain(): Database row → Domain entity conversion
 * - toPersistence(): Domain entity → Database row conversion
 * - Bulk operations with multiple entities
 *
 * Baseline targets:
 * - Single entity mapping: < 1ms (sub-millisecond preferred)
 * - Batch of 10 entities: < 10ms
 * - Batch of 100 entities: < 100ms
 *
 * Run with: npm run bench
 * Or: vitest bench --run src/modules/PropertyManagement/infrastructure/__benchmarks__
 */
import { bench, describe } from 'vitest'
import { SupabasePropertyRepository } from '../SupabasePropertyRepository'
import { Property } from '../../domain/Property'
import { PropertyType } from '../../domain/PropertyType'
import { PropertyStatus } from '../../domain/PropertyStatus'
import { PropertySettings } from '../../domain/PropertySettings'
import type { Database } from '@/contracts/db'

type PropertyRow = Database['public']['Tables']['properties']['Row']

/**
 * Mock Supabase client that doesn't hit the database
 * Allows us to benchmark pure mapping performance
 */
function createMockSupabaseClient() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  } as any
}

/**
 * Generate a minimal property row (simple property)
 */
function createMinimalPropertyRow(): PropertyRow {
  return {
    id: 'prop-bench-001',
    company_id: 'company-001',
    owner_id: 'user-001',
    name: 'Benchmark Property',
    slug: 'benchmark-property',
    description: null,
    property_type: null,
    status: 'draft',
    address: null,
    city: null,
    state: null,
    zip_code: null,
    country: null,
    phone: null,
    email: null,
    subdomain: null,
    booking_page_slug: null,
    settings: null,
    amenities: null,
    onboarding_completed: false,
    onboarding_completed_at: null,
    stripe_account_id: null,
    stripe_connected_at: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    wizard_step_completed: 'not_started',
    wizard_progress: null,
    stripe_pending_verification: null,
    total_sites: null,
  }
}

/**
 * Generate a complex property row (all fields populated)
 */
function createComplexPropertyRow(): PropertyRow {
  return {
    id: 'prop-bench-complex-001',
    company_id: 'company-001',
    owner_id: 'user-001',
    name: 'Mountain View Campground',
    slug: 'mountain-view',
    description: 'A beautiful campground nestled in the mountains with stunning views.',
    property_type: 'campground',
    status: 'active',
    address: '123 Mountain Road',
    city: 'Boulder',
    state: 'CO',
    zip_code: '80301',
    country: 'US',
    phone: '+1-303-555-0100',
    email: 'info@mountainview.example.com',
    subdomain: 'mountainview',
    booking_page_slug: 'book-now',
    settings: {
      check_in_time: '14:00',
      check_out_time: '11:00',
      timezone: 'America/Denver',
      currency: 'USD',
      cancellation_policy: 'flexible',
      max_advance_booking_days: 365,
      min_advance_booking_hours: 24,
    },
    amenities: ['WiFi', 'Hot Showers', 'Fire Pits', 'Picnic Tables', 'Pet Friendly'],
    onboarding_completed: true,
    onboarding_completed_at: '2025-01-15T10:30:00Z',
    stripe_account_id: 'acct_1234567890',
    stripe_connected_at: '2025-01-10T09:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-15T10:30:00Z',
    wizard_step_completed: 'complete',
    wizard_progress: {
      property_details: true,
      sites_setup: true,
      stripe_connect: true,
      dashboard_tour: true,
      complete: true,
    },
    stripe_pending_verification: false,
    total_sites: 50,
  }
}

/**
 * Create a domain Property entity for benchmarking toPersistence()
 */
function createDomainProperty(): Property {
  return Property.create(
    'prop-bench-domain-001',
    'company-001',
    'user-001',
    'Benchmark Campground',
    'benchmark-campground'
  )
}

/**
 * Create a complex domain Property entity
 */
function createComplexDomainProperty(): Property {
  const property = Property.fromPersistence(
    'prop-bench-complex-domain-001',
    'company-001',
    'user-001',
    'Mountain View Complex',
    'mountain-view-complex',
    'A comprehensive property with all features',
    PropertyType.CAMPGROUND,
    PropertyStatus.ACTIVE,
    '123 Mountain Road',
    'Boulder',
    'CO',
    '80301',
    'US',
    '+1-303-555-0200',
    'complex@mountainview.example.com',
    'complexview',
    'book-now',
    PropertySettings.create({
      checkInTime: '14:00',
      checkOutTime: '11:00',
      timezone: 'America/Denver',
      currency: 'USD',
    }),
    ['WiFi', 'Hot Showers', 'Fire Pits', 'RV Hookups', 'Laundry', 'Store'],
    true,
    new Date('2025-01-15T10:30:00Z'),
    'acct_9876543210',
    new Date('2025-01-10T09:00:00Z'),
    new Date('2025-01-01T00:00:00Z'),
    new Date('2025-01-15T10:30:00Z')
  )
  return property
}

describe('PropertyRepository Mapping Performance', () => {
  const repository = new SupabasePropertyRepository(createMockSupabaseClient())

  describe('toDomain() - Database Row → Domain Entity', () => {
    bench('map minimal property (simple case)', () => {
      const row = createMinimalPropertyRow()
      // @ts-expect-error - accessing private method for benchmarking
      repository['toDomain'](row)
    })

    bench('map complex property (all fields)', () => {
      const row = createComplexPropertyRow()
      // @ts-expect-error - accessing private method for benchmarking
      repository['toDomain'](row)
    })

    bench('map batch of 10 minimal properties', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        ...createMinimalPropertyRow(),
        id: `prop-bench-${i}`,
      }))
      // @ts-expect-error - accessing private method for benchmarking
      rows.forEach((row) => repository['toDomain'](row))
    })

    bench('map batch of 100 minimal properties', () => {
      const rows = Array.from({ length: 100 }, (_, i) => ({
        ...createMinimalPropertyRow(),
        id: `prop-bench-${i}`,
      }))
      // @ts-expect-error - accessing private method for benchmarking
      rows.forEach((row) => repository['toDomain'](row))
    })

    bench('map batch of 10 complex properties', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        ...createComplexPropertyRow(),
        id: `prop-bench-complex-${i}`,
      }))
      // @ts-expect-error - accessing private method for benchmarking
      rows.forEach((row) => repository['toDomain'](row))
    })
  })

  describe('toPersistence() - Domain Entity → Database Row', () => {
    bench('serialize minimal property', () => {
      const property = createDomainProperty()
      property.toPersistence()
    })

    bench('serialize complex property', () => {
      const property = createComplexDomainProperty()
      property.toPersistence()
    })

    bench('serialize batch of 10 minimal properties', () => {
      const properties = Array.from({ length: 10 }, (_, i) =>
        Property.create(
          `prop-bench-${i}`,
          'company-001',
          'user-001',
          `Property ${i}`,
          `property-${i}`
        )
      )
      properties.forEach((p) => p.toPersistence())
    })

    bench('serialize batch of 100 minimal properties', () => {
      const properties = Array.from({ length: 100 }, (_, i) =>
        Property.create(
          `prop-bench-${i}`,
          'company-001',
          'user-001',
          `Property ${i}`,
          `property-${i}`
        )
      )
      properties.forEach((p) => p.toPersistence())
    })

    bench('serialize batch of 10 complex properties', () => {
      const properties = Array.from({ length: 10 }, (_, i) =>
        createComplexDomainProperty()
      )
      properties.forEach((p) => p.toPersistence())
    })
  })

  describe('Round-trip Performance - DB → Domain → DB', () => {
    bench('round-trip minimal property', () => {
      const row = createMinimalPropertyRow()
      // @ts-expect-error - accessing private method for benchmarking
      const property = repository['toDomain'](row)
      property.toPersistence()
    })

    bench('round-trip complex property', () => {
      const row = createComplexPropertyRow()
      // @ts-expect-error - accessing private method for benchmarking
      const property = repository['toDomain'](row)
      property.toPersistence()
    })

    bench('round-trip batch of 10 properties', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        ...createComplexPropertyRow(),
        id: `prop-bench-rt-${i}`,
      }))
      rows.forEach((row) => {
        // @ts-expect-error - accessing private method for benchmarking
        const property = repository['toDomain'](row)
        property.toPersistence()
      })
    })
  })
})

describe('PropertySettings Mapping Performance', () => {
  describe('fromJson() - Parse Settings JSONB', () => {
    bench('parse null settings', () => {
      PropertySettings.fromJson(null)
    })

    bench('parse simple settings', () => {
      PropertySettings.fromJson({
        check_in_time: '14:00',
        check_out_time: '11:00',
      })
    })

    bench('parse complex settings', () => {
      PropertySettings.fromJson({
        check_in_time: '14:00',
        check_out_time: '11:00',
        timezone: 'America/Denver',
        currency: 'USD',
        cancellation_policy: 'flexible',
        max_advance_booking_days: 365,
        min_advance_booking_hours: 24,
        require_approval: false,
        auto_accept_bookings: true,
      })
    })

    bench('parse batch of 100 settings', () => {
      const settingsJson = {
        check_in_time: '14:00',
        check_out_time: '11:00',
        timezone: 'America/Denver',
      }
      Array.from({ length: 100 }).forEach(() =>
        PropertySettings.fromJson(settingsJson)
      )
    })
  })

  describe('toJson() - Serialize Settings to JSONB', () => {
    bench('serialize simple settings', () => {
      const settings = PropertySettings.create({
        checkInTime: '14:00',
        checkOutTime: '11:00',
      })
      settings.toJson()
    })

    bench('serialize complex settings', () => {
      const settings = PropertySettings.create({
        checkInTime: '14:00',
        checkOutTime: '11:00',
        timezone: 'America/Denver',
        currency: 'USD',
      })
      settings.toJson()
    })

    bench('serialize batch of 100 settings', () => {
      const settings = PropertySettings.create({
        checkInTime: '14:00',
        checkOutTime: '11:00',
      })
      Array.from({ length: 100 }).forEach(() => settings.toJson())
    })
  })
})

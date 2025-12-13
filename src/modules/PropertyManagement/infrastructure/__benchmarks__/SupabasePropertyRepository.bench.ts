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
    billing_cycle: null,
    booking_page_description: null,
    booking_page_tagline: null,
    booking_rules_config: null,
    brand_color_primary: null,
    brand_color_secondary: null,
    cancellation_policy: null,
    check_in_instructions: null,
    check_in_time: null,
    check_out_instructions: null,
    check_out_time: null,
    confirmation_number_config: null,
    confirmation_number_sequence: null,
    custom_domain: null,
    deposit_config: null,
    directions: null,
    gallery_images: null,
    hero_image_url: null,
    house_rules: null,
    logo_url: null,
    minimum_stay_nights: null,
    monthly_booking_quota: null,
    office_hours: null,
    pricing_config: null,
    rate_discounts_config: null,
    renewal_settings: null,
    site_count: null,
    special_instructions: null,
    stripe_customer_id: null,
    subscription_canceled_at: null,
    subscription_created_at: null,
    subscription_id: null,
    subscription_plan: null,
    subscription_status: null,
    timezone: null,
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
    billing_cycle: 'monthly',
    booking_page_description: 'Book your stay at Mountain View',
    booking_page_tagline: 'Your mountain getaway',
    booking_rules_config: null,
    brand_color_primary: '#4A7C59',
    brand_color_secondary: '#8FBC8F',
    cancellation_policy: 'flexible',
    check_in_instructions: 'Check in at the main office',
    check_in_time: '14:00',
    check_out_instructions: 'Leave keys in drop box',
    check_out_time: '11:00',
    confirmation_number_config: null,
    confirmation_number_sequence: 100,
    custom_domain: null,
    deposit_config: null,
    directions: 'Take Highway 36 to Boulder',
    gallery_images: ['img1.jpg', 'img2.jpg'],
    hero_image_url: 'hero.jpg',
    house_rules: 'No loud noise after 10pm',
    logo_url: 'logo.png',
    minimum_stay_nights: 1,
    monthly_booking_quota: 50,
    office_hours: '8am-8pm',
    pricing_config: null,
    rate_discounts_config: null,
    renewal_settings: null,
    site_count: 50,
    special_instructions: null,
    stripe_customer_id: 'cus_123456',
    subscription_canceled_at: null,
    subscription_created_at: '2025-01-01T00:00:00Z',
    subscription_id: 'sub_123456',
    subscription_plan: 'pro',
    subscription_status: 'active',
    timezone: 'America/Denver',
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
    'https://example.com/hero.jpg', // heroImageUrl
    PropertySettings.create({
      checkInTime: '14:00',
      checkOutTime: '11:00',
      timezone: 'America/Denver',
    }),
    ['WiFi', 'Hot Showers', 'Fire Pits', 'RV Hookups', 'Laundry', 'Store'],
    'Check in at the main office between 2-6pm', // checkInInstructions
    'Please leave your site clean and keys in the drop box', // checkOutInstructions
    'Quiet hours 10pm-7am, no fireworks', // houseRules
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
      repository['toDomain'](row)
    })

    bench('map complex property (all fields)', () => {
      const row = createComplexPropertyRow()
      repository['toDomain'](row)
    })

    bench('map batch of 10 minimal properties', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        ...createMinimalPropertyRow(),
        id: `prop-bench-${i}`,
      }))
      rows.forEach((row) => repository['toDomain'](row))
    })

    bench('map batch of 100 minimal properties', () => {
      const rows = Array.from({ length: 100 }, (_, i) => ({
        ...createMinimalPropertyRow(),
        id: `prop-bench-${i}`,
      }))
      rows.forEach((row) => repository['toDomain'](row))
    })

    bench('map batch of 10 complex properties', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        ...createComplexPropertyRow(),
        id: `prop-bench-complex-${i}`,
      }))
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
      const property = repository['toDomain'](row)
      property.toPersistence()
    })

    bench('round-trip complex property', () => {
      const row = createComplexPropertyRow()
      const property = repository['toDomain'](row)
      property.toPersistence()
    })

    bench('round-trip batch of 10 properties', () => {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        ...createComplexPropertyRow(),
        id: `prop-bench-rt-${i}`,
      }))
      rows.forEach((row) => {
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
        cancellationPolicy: 'flexible',
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

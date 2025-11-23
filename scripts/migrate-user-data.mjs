#!/usr/bin/env node
/**
 * User Data Migration Script
 *
 * This script migrates user data from the original Camp-OS database
 * to the refactor database branch.
 *
 * PREREQUISITES:
 * 1. Sign up in the refactor app with the SAME EMAIL as your original account
 * 2. Set environment variables for both databases
 * 3. Run: node scripts/migrate-user-data.mjs
 */

import { createClient } from '@supabase/supabase-js'

// ============================================================================
// CONFIGURATION
// ============================================================================

const ORIGINAL_EMAIL = process.env.MIGRATION_EMAIL || 'YOUR_EMAIL_HERE'

// Original database credentials
const ORIGINAL_SUPABASE_URL =
  process.env.ORIGINAL_SUPABASE_URL || 'https://kpbyhhxxdhblblxvbrbr.supabase.co'
const ORIGINAL_SUPABASE_KEY =
  process.env.ORIGINAL_SUPABASE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtwYnloaHh4ZGhibGJseHZicmJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDgzODAxNSwiZXhwIjoyMDc2NDE0MDE1fQ.R4bZRXzve-177uClMhmEG8o2scfUUGfTg_8S4y8-rn0'

// Refactor database credentials (from .env.local)
const REFACTOR_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ydzpxvhfuviciqqslhuj.supabase.co'
const REFACTOR_SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkenB4dmhmdXZpY2lxcXNsaHVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzMxMTk3MCwiZXhwIjoyMDc4ODg3OTcwfQ.pX144ZDsI-3ay8TAFIRgqw7EF0cb4okXtRb3oMirDGw'

// ============================================================================
// MAIN MIGRATION LOGIC
// ============================================================================

async function migrate() {
  console.log('🚀 Starting user data migration...\n')

  // Create Supabase clients
  const originalDb = createClient(ORIGINAL_SUPABASE_URL, ORIGINAL_SUPABASE_KEY)
  const refactorDb = createClient(REFACTOR_SUPABASE_URL, REFACTOR_SUPABASE_KEY)

  try {
    // Step 1: Get user IDs from both databases
    console.log('📧 Looking up user by email:', ORIGINAL_EMAIL)

    // Try to get user from companies table (most reliable method)
    const { data: originalCompanies, error: originalCompanyError } = await originalDb
      .from('companies')
      .select('owner_id, name')
      .limit(1)

    if (originalCompanyError || !originalCompanies || originalCompanies.length === 0) {
      console.error('❌ Could not find user in original database')
      console.error('Please make sure you have companies in the original database')
      console.error('Or update MIGRATION_EMAIL to match your account email')
      process.exit(1)
    }

    const originalUserId = originalCompanies[0].owner_id
    console.log('✅ Original user ID:', originalUserId)
    console.log('   Company:', originalCompanies[0].name)

    // Get user from refactor database
    const { data: refactorCompanies, error: refactorCompanyError } = await refactorDb
      .from('companies')
      .select('owner_id, name')
      .limit(1)

    if (refactorCompanyError || !refactorCompanies || refactorCompanies.length === 0) {
      console.error('❌ User not found in refactor database')
      console.error('Please sign up in the refactor app first with email:', ORIGINAL_EMAIL)
      console.error('Then create at least one company/property to establish your user record')
      process.exit(1)
    }

    const refactorUserId = refactorCompanies[0].owner_id
    console.log('✅ Refactor user ID:', refactorUserId)
    console.log('   Company:', refactorCompanies[0].name)
    console.log('')

    // Step 2: Fetch data from original database
    console.log('📦 Fetching data from original database...')

    const { data: companies, error: companiesError } = await originalDb
      .from('companies')
      .select('*')
      .eq('owner_id', originalUserId)

    if (companiesError) throw companiesError
    console.log(`  ✓ Found ${companies?.length || 0} companies`)

    const companyIds = companies?.map((c) => c.id) || []

    const { data: properties, error: propertiesError } = await originalDb
      .from('properties')
      .select('*')
      .or(`owner_id.eq.${originalUserId},company_id.in.(${companyIds.join(',')})`)

    if (propertiesError) throw propertiesError
    console.log(`  ✓ Found ${properties?.length || 0} properties`)

    const propertyIds = properties?.map((p) => p.id) || []

    if (propertyIds.length === 0) {
      console.log('⚠️  No properties found, skipping dependent data')
      return
    }

    const { data: sites, error: sitesError } = await originalDb
      .from('sites')
      .select('*')
      .in('property_id', propertyIds)

    if (sitesError) throw sitesError
    console.log(`  ✓ Found ${sites?.length || 0} sites`)

    const { data: guests, error: guestsError } = await originalDb
      .from('guests')
      .select('*')
      .in('property_id', propertyIds)

    if (guestsError) throw guestsError
    console.log(`  ✓ Found ${guests?.length || 0} guests`)

    const { data: reservations, error: reservationsError } = await originalDb
      .from('reservations')
      .select('*')
      .in('property_id', propertyIds)

    if (reservationsError) throw reservationsError
    console.log(`  ✓ Found ${reservations?.length || 0} reservations`)

    const { data: payments, error: paymentsError } = await originalDb
      .from('payments')
      .select('*')
      .in('property_id', propertyIds)

    if (paymentsError) throw paymentsError
    console.log(`  ✓ Found ${payments?.length || 0} payments`)
    console.log('')

    // Step 3: Insert data into refactor database
    console.log('💾 Inserting data into refactor database...')

    // Update owner_id to new user ID
    if (companies && companies.length > 0) {
      const companiesWithNewOwner = companies.map((c) => ({
        ...c,
        owner_id: refactorUserId,
      }))

      const { error: insertCompaniesError } = await refactorDb
        .from('companies')
        .upsert(companiesWithNewOwner)

      if (insertCompaniesError) throw insertCompaniesError
      console.log(`  ✓ Inserted ${companies.length} companies`)
    }

    if (properties && properties.length > 0) {
      const propertiesWithNewOwner = properties.map((p) => ({
        ...p,
        owner_id: refactorUserId,
      }))

      const { error: insertPropertiesError } = await refactorDb
        .from('properties')
        .upsert(propertiesWithNewOwner)

      if (insertPropertiesError) throw insertPropertiesError
      console.log(`  ✓ Inserted ${properties.length} properties`)
    }

    if (sites && sites.length > 0) {
      const { error: insertSitesError } = await refactorDb.from('sites').upsert(sites)

      if (insertSitesError) throw insertSitesError
      console.log(`  ✓ Inserted ${sites.length} sites`)
    }

    if (guests && guests.length > 0) {
      const { error: insertGuestsError } = await refactorDb
        .from('guests')
        .upsert(guests)

      if (insertGuestsError) throw insertGuestsError
      console.log(`  ✓ Inserted ${guests.length} guests`)
    }

    if (reservations && reservations.length > 0) {
      const { error: insertReservationsError } = await refactorDb
        .from('reservations')
        .upsert(reservations)

      if (insertReservationsError) throw insertReservationsError
      console.log(`  ✓ Inserted ${reservations.length} reservations`)
    }

    if (payments && payments.length > 0) {
      const { error: insertPaymentsError } = await refactorDb
        .from('payments')
        .upsert(payments)

      if (insertPaymentsError) throw insertPaymentsError
      console.log(`  ✓ Inserted ${payments.length} payments`)
    }

    console.log('')
    console.log('✅ Migration complete!')
    console.log('')
    console.log('Summary:')
    console.log(`  - Companies: ${companies?.length || 0}`)
    console.log(`  - Properties: ${properties?.length || 0}`)
    console.log(`  - Sites: ${sites?.length || 0}`)
    console.log(`  - Guests: ${guests?.length || 0}`)
    console.log(`  - Reservations: ${reservations?.length || 0}`)
    console.log(`  - Payments: ${payments?.length || 0}`)
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run migration
migrate()

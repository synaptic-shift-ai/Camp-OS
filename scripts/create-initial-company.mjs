#!/usr/bin/env node
/**
 * Create an initial company for a new user in the refactor database
 * This is needed before running the migration script
 */

import { createClient } from '@supabase/supabase-js'

const REFACTOR_URL = 'https://ydzpxvhfuviciqqslhuj.supabase.co'
const REFACTOR_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkenB4dmhmdXZpY2lxcXNsaHVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzMxMTk3MCwiZXhwIjoyMDc4ODg3OTcwfQ.pX144ZDsI-3ay8TAFIRgqw7EF0cb4okXtRb3oMirDGw'

const USER_ID = '8e07fd89-3e78-4d01-9096-b7e9b950a691'
const COMPANY_NAME = 'My Company (Temp)'

const client = createClient(REFACTOR_URL, REFACTOR_KEY)

console.log('🏢 Creating initial company...\n')

const { data, error } = await client
  .from('companies')
  .insert({
    owner_id: USER_ID,
    name: COMPANY_NAME,
  })
  .select()
  .single()

if (error) {
  console.error('❌ Error creating company:', error)
  process.exit(1)
}

console.log('✅ Company created successfully!')
console.log('   ID:', data.id)
console.log('   Name:', data.name)
console.log('   Owner:', data.owner_id)
console.log('\n✅ Ready to run migration script!')

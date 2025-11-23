#!/usr/bin/env node
/**
 * Apply all migrations to the refactor database
 * This runs the SQL migrations in order without needing Supabase CLI
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const REFACTOR_URL = 'https://ydzpxvhfuviciqqslhuj.supabase.co'
const REFACTOR_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkenB4dmhmdXZpY2lxcXNsaHVqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzMxMTk3MCwiZXhwIjoyMDc4ODg3OTcwfQ.pX144ZDsI-3ay8TAFIRgqw7EF0cb4okXtRb3oMirDGw'

const client = createClient(REFACTOR_URL, REFACTOR_KEY)
const migrationsDir = './supabase/migrations'

console.log('🔄 Running migrations on refactor database...\n')

// Get all migration files sorted by name (which includes timestamp)
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

console.log(`Found ${files.length} migration files:\n`)

for (const file of files) {
  console.log(`⏳ Running: ${file}`)

  try {
    const sql = readFileSync(join(migrationsDir, file), 'utf-8')

    // Execute the SQL using the REST API
    const response = await fetch(`${REFACTOR_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: REFACTOR_KEY,
        Authorization: `Bearer ${REFACTOR_KEY}`,
      },
      body: JSON.stringify({ query: sql }),
    })

    if (!response.ok) {
      // Try alternative approach - use supabase-js query
      const { error } = await client.rpc('exec', { sql })

      if (error) {
        console.error(`   ❌ Failed: ${error.message}`)
        console.error(`   Trying direct SQL execution...`)

        // Last resort - split and execute statements one by one
        const statements = sql
          .split(';')
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'))

        for (const stmt of statements) {
          const { error: stmtError } = await client.rpc('exec', { sql: stmt })
          if (stmtError) {
            console.error(`   ❌ Statement failed: ${stmtError.message}`)
            console.error(`   Statement: ${stmt.substring(0, 100)}...`)
            // Continue with other statements
          }
        }
      }
    }

    console.log(`   ✅ Complete`)
  } catch (err) {
    console.error(`   ❌ Error: ${err.message}`)
    console.error(`   You may need to run this migration manually in the Supabase SQL editor`)
  }

  console.log('')
}

console.log('✅ Migration process complete!')
console.log('\nNote: Some migrations may have failed. Please check the output above.')
console.log('If migrations failed, you can run them manually via the Supabase dashboard:')
console.log(`https://supabase.com/dashboard/project/ydzpxvhfuviciqqslhuj/sql`)

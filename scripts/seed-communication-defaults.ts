#!/usr/bin/env npx tsx
/**
 * Seed Communication Branding Defaults
 *
 * Creates a communication_branding row for every property that doesn't have one.
 * Uses the property name as sender_name and property email as sender_email.
 * Safe to re-run (idempotent — skips properties that already have a row).
 *
 * Usage:
 *   npx tsx scripts/seed-communication-defaults.ts
 *
 * Environment:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — required (.env.local)
 */

import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

const cwd = process.cwd()
for (const [name, path] of [
  ['.env', resolve(cwd, '.env')],
  ['.env.local', resolve(cwd, '.env.local')],
] as const) {
  if (existsSync(path)) {
    config({ path, override: name === '.env.local' })
  }
}

import { createServiceRoleClient } from '@/lib/supabase/service-role'

async function main() {
  const supabase = createServiceRoleClient()
  const db = supabase as any

  // 1. Fetch all properties
  const { data: properties, error: propErr } = await db
    .from('properties')
    .select('id, company_id, name, email')
    .is('deleted_at', null)

  if (propErr) {
    console.error('Failed to fetch properties:', propErr.message)
    process.exit(1)
  }

  if (!properties || properties.length === 0) {
    console.log('No properties found. Nothing to seed.')
    return
  }

  console.log(`Found ${properties.length} properties.\n`)

  // 2. Fetch existing branding rows
  const { data: existingBranding, error: brandErr } = await db
    .from('communication_branding')
    .select('property_id')

  if (brandErr) {
    console.error('Failed to fetch existing branding rows:', brandErr.message)
    process.exit(1)
  }

  const brandedPropertyIds = new Set(
    (existingBranding ?? []).map((r: { property_id: string }) => r.property_id),
  )

  // 3. Insert branding for properties that don't have one
  let created = 0
  let skipped = 0
  let failed = 0

  const rows = properties
    .filter((p: { id: string }) => !brandedPropertyIds.has(p.id))
    .map((p: { id: string; company_id: string; name: string; email: string | null }) => ({
      company_id: p.company_id,
      property_id: p.id,
      sender_name: p.name || 'CampOS',
      sender_email: p.email ?? null,
    }))

  if (rows.length === 0) {
    console.log('All properties already have branding rows. Nothing to do.')
    return
  }

  // Insert in batches of 100
  const BATCH_SIZE = 100
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error: insertErr } = await db
      .from('communication_branding')
      .upsert(batch, { onConflict: 'property_id' })

    if (insertErr) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, insertErr.message)
      failed += batch.length
    } else {
      created += batch.length
    }
  }

  skipped = properties.length - rows.length

  console.log(`Done.`)
  console.log(`  Created: ${created}`)
  console.log(`  Skipped (already existed): ${skipped}`)
  if (failed > 0) console.log(`  Failed: ${failed}`)
}

main()

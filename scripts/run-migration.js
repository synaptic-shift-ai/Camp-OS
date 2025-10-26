/**
 * Migration Runner
 * Executes Phase 2a migration on Supabase database
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('📄 Reading migration file...');
    const migrationPath = join(__dirname, '003_migrate_money_to_cents.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    console.log('🔄 Executing migration on Supabase...');
    console.log('⚠️  This will add *_cents columns to sites, reservations, and payments tables');
    console.log('');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct query if exec_sql function doesn't exist
      console.log('ℹ️  exec_sql function not found, trying direct query...');

      // Split by statements and execute individually
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--') && s !== 'BEGIN' && s !== 'COMMIT');

      for (const statement of statements) {
        if (!statement) continue;

        console.log(`Executing: ${statement.substring(0, 60)}...`);
        const { error: stmtError } = await supabase.rpc('exec_sql', { sql: statement });

        if (stmtError) {
          throw new Error(`Statement failed: ${stmtError.message}\nStatement: ${statement}`);
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Run: npm run gen:db (regenerate database types)');
    console.log('2. Update booking routes to use dual-read/dual-write pattern');
    console.log('3. Run verification queries');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    console.error('');
    console.error('You may need to run this migration manually using the Supabase SQL Editor:');
    console.error('1. Go to https://supabase.com/dashboard/project/kpbyhhxxdhblblxvbrbr/sql');
    console.error('2. Paste the contents of scripts/003_migrate_money_to_cents.sql');
    console.error('3. Click "Run"');
    process.exit(1);
  }
}

runMigration();

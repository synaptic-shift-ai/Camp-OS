#!/bin/bash
# Complete database copy from original to refactor

# You need to get your database passwords from:
# Original: https://supabase.com/dashboard/project/kpbyhhxxdhblblxvbrbr/settings/database
# Refactor: https://supabase.com/dashboard/project/ydzpxvhfuviciqqslhuj/settings/database

# Set these variables with your actual passwords
ORIGINAL_PASSWORD="Pewprof4224"
REFACTOR_PASSWORD="Pewprof4224"

# Direct database connection (port 5432)
ORIGINAL_DB="postgresql://postgres:${ORIGINAL_PASSWORD}@db.kpbyhhxxdhblblxvbrbr.supabase.co:5432/postgres"
REFACTOR_DB="postgresql://postgres:${REFACTOR_PASSWORD}@db.ydzpxvhfuviciqqslhuj.supabase.co:5432/postgres"

echo "📦 Creating backup from original database..."
/opt/homebrew/opt/postgresql@16/bin/pg_dump "$ORIGINAL_DB" --clean --if-exists --no-owner --no-acl > /tmp/camp-os-backup.sql

if [ $? -ne 0 ]; then
  echo "❌ Backup failed!"
  exit 1
fi

echo "✅ Backup complete! ($(wc -l < /tmp/camp-os-backup.sql) lines)"
echo ""
echo "💾 Restoring to refactor database..."

/opt/homebrew/opt/postgresql@16/bin/psql "$REFACTOR_DB" -f /tmp/camp-os-backup.sql

if [ $? -ne 0 ]; then
  echo "❌ Restore failed!"
  exit 1
fi

echo "✅ Database copy complete!"
echo ""
echo "🎉 Your refactor database now has all the data from the original!"

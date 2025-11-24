#!/bin/bash
# Phase 1: Fix TypeScript Path Mapping
# This script implements Phase 1 of TYPE_ERROR_REMEDIATION_PLAN.md
#
# What it does:
# 1. Updates tsconfig.json to map @/* to ./* instead of ./src/*
# 2. Finds and lists all files using @/src/ imports (requires manual fix)
# 3. Runs type-check to verify improvement

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TSCONFIG="$PROJECT_ROOT/tsconfig.json"
BACKUP="$TSCONFIG.backup.$(date +%s)"

echo "🔧 Phase 1: Fix TypeScript Path Mapping"
echo "========================================"
echo ""
echo "This will:"
echo "  1. Backup tsconfig.json"
echo "  2. Update @/* path mapping from ./src/* to ./*"
echo "  3. Find files with @/src/ imports (you'll need to fix these)"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Aborted"
    exit 1
fi

cd "$PROJECT_ROOT"

# Step 1: Backup tsconfig.json
echo "📦 Backing up tsconfig.json..."
cp "$TSCONFIG" "$BACKUP"
echo "   Backup saved: $BACKUP"
echo ""

# Step 2: Update tsconfig.json
echo "✏️  Updating tsconfig.json..."

# Use Node.js to properly update JSON
node -e "
const fs = require('fs');
const tsconfig = JSON.parse(fs.readFileSync('$TSCONFIG', 'utf8'));

// Update paths
if (tsconfig.compilerOptions && tsconfig.compilerOptions.paths) {
  tsconfig.compilerOptions.paths['@/*'] = ['./*'];
  console.log('   Updated @/* mapping: ./src/* → ./*');
} else {
  console.error('   ⚠️  Warning: Could not find paths in tsconfig.json');
  process.exit(1);
}

// Write back with formatting
fs.writeFileSync('$TSCONFIG', JSON.stringify(tsconfig, null, 2) + '\\n');
console.log('   ✅ tsconfig.json updated');
"

echo ""

# Step 3: Find files with @/src/ imports
echo "🔍 Finding files with @/src/ imports..."
echo "   These need manual updating:"
echo ""

FILES_WITH_SRC_IMPORTS=$(grep -r "from '@/src/" --include="*.ts" --include="*.tsx" \
  app/ lib/ components/ src/ tests/ 2>/dev/null | cut -d: -f1 | sort -u || echo "")

if [ -z "$FILES_WITH_SRC_IMPORTS" ]; then
  echo "   ✅ No @/src/ imports found!"
else
  echo "$FILES_WITH_SRC_IMPORTS" | while read -r file; do
    COUNT=$(grep -c "from '@/src/" "$file" 2>/dev/null || echo "0")
    echo "   📄 $file ($COUNT imports)"
  done

  echo ""
  echo "📝 Manual fix required:"
  echo "   Replace in the above files:"
  echo "   - @/src/contracts/db → @/contracts/db"
  echo "   - @/src/contracts/booking → @/contracts/booking"
  echo "   - @/src/modules/ → @/modules/"
  echo "   - @/src/shared/ → @/shared/"
  echo "   - @/src/types/ → @/types/"
fi

echo ""
echo "🧪 Running type-check to verify..."
echo ""

# Run type-check and count TS2307 errors
if npm run type-check 2>&1 | tee /tmp/phase1-typecheck.log; then
  echo ""
  echo "🎉 SUCCESS! Zero TypeScript errors!"
else
  TS2307_COUNT=$(grep -c "error TS2307" /tmp/phase1-typecheck.log || echo "0")
  TOTAL_ERRORS=$(grep -c "error TS" /tmp/phase1-typecheck.log || echo "0")

  echo ""
  echo "📊 Results:"
  echo "   Total errors: $TOTAL_ERRORS"
  echo "   TS2307 (Cannot find module): $TS2307_COUNT"
  echo ""

  if [ "$TS2307_COUNT" -eq "0" ]; then
    echo "✅ All 'Cannot find module' errors fixed!"
    echo "   Remaining errors are type-related (Phases 3-5)"
  else
    echo "⚠️  Still have $TS2307_COUNT 'Cannot find module' errors"
    echo "   Likely cause: @/src/ imports not yet updated"
    echo ""
    echo "Run this to find them:"
    echo "   grep -r \"from '@/src/\" --include=\"*.ts\" --include=\"*.tsx\" app/ lib/ components/ src/"
  fi
fi

echo ""
echo "✅ Phase 1 Complete!"
echo ""
echo "Next steps:"
echo "  1. Fix @/src/ imports in the files listed above"
echo "  2. Run: npm run type-check"
echo "  3. If TS2307 errors = 0, proceed to Phase 2"
echo "  4. Run: scripts/fix-phase2-nextjs-params.sh"
echo ""
echo "To rollback:"
echo "  cp $BACKUP $TSCONFIG"

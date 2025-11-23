#!/bin/bash
# Phase 2: Fix Next.js 15 Async Params
# This script implements Phase 2 of TYPE_ERROR_REMEDIATION_PLAN.md
#
# What it does:
# 1. Identifies route handlers with dynamic params that need updating
# 2. Shows the required changes
# 3. Optionally applies automatic fixes (with backup)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔧 Phase 2: Fix Next.js 15 Async Params"
echo "========================================"
echo ""
echo "Next.js 15.1+ changed route params from sync to async:"
echo ""
echo "  OLD: { params }: { params: { id: string } }"
echo "  NEW: { params }: { params: Promise<{ id: string }> }"
echo ""
echo "  OLD: const guestId = params.id"
echo "  NEW: const { id } = await params"
echo ""

cd "$PROJECT_ROOT"

# Find all route handlers with params
echo "🔍 Scanning for route handlers with params..."
echo ""

AFFECTED_FILES=$(find app/api -name "route.ts" -type f | xargs grep -l "{ params }" 2>/dev/null || echo "")

if [ -z "$AFFECTED_FILES" ]; then
  echo "✅ No route handlers with params found!"
  exit 0
fi

echo "📄 Files with params:"
echo "$AFFECTED_FILES" | while read -r file; do
  echo "   - $file"
done

echo ""
echo "🔍 Checking which need async updates..."
echo ""

# Check current type-check for TS2344 errors
npm run type-check 2>&1 > /tmp/phase2-typecheck.log || true
TS2344_ERRORS=$(grep "error TS2344" /tmp/phase2-typecheck.log | wc -l | tr -d ' ')

if [ "$TS2344_ERRORS" -eq "0" ]; then
  echo "✅ No TS2344 errors found! Params are already correct."
  exit 0
fi

echo "⚠️  Found $TS2344_ERRORS files with incorrect param types"
echo ""

# Extract affected files from errors
AFFECTED_BY_ERROR=$(grep "error TS2344" /tmp/phase2-typecheck.log | \
  grep -oE 'app/api/[^"]+' | sort -u)

echo "Files needing updates:"
echo "$AFFECTED_BY_ERROR" | while read -r file; do
  echo "   📝 $file"
done

echo ""
echo "⚠️  MANUAL FIX REQUIRED"
echo ""
echo "For each file above, apply these changes:"
echo ""
echo "1. Change function signature:"
echo "   FROM: { params }: { params: { id: string } }"
echo "   TO:   { params }: { params: Promise<{ id: string }> }"
echo ""
echo "2. Await params at start of function:"
echo "   FROM: const guestId = params.id"
echo "   TO:   const { id } = await params"
echo "   OR:   const resolvedParams = await params"
echo "         const guestId = resolvedParams.id"
echo ""
echo "Example full change:"
echo ""
cat << 'EOF'
// BEFORE:
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guestId = params.id
  // ... rest of code
}

// AFTER:
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guestId = id
  // ... rest of code
}
EOF

echo ""
echo "🔧 After making changes, verify with:"
echo "   npm run type-check 2>&1 | grep -c 'error TS2344'"
echo "   (should be 0)"
echo ""
echo "Files to update:"
echo "$AFFECTED_BY_ERROR"
echo ""
echo "✅ Phase 2 analysis complete!"
echo ""
echo "Next steps:"
echo "  1. Manually update the files listed above"
echo "  2. Run: npm run type-check"
echo "  3. If TS2344 errors = 0, proceed to Phase 3"

#!/bin/bash
# TypeScript Error Analysis Script
# Companion to TYPE_ERROR_REMEDIATION_PLAN.md

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ERROR_LOG="$PROJECT_ROOT/type-errors.log"

echo "🔍 Analyzing TypeScript Errors..."
echo "=================================="
echo ""

# Generate fresh error log
echo "📝 Running type-check..."
cd "$PROJECT_ROOT"
npm run type-check 2>&1 | tee "$ERROR_LOG" || true

echo ""
echo "📊 Error Summary"
echo "=================================="

# Total error count
TOTAL_ERRORS=$(grep -c "error TS" "$ERROR_LOG" || echo "0")
echo "Total Errors: $TOTAL_ERRORS"
echo ""

# Error breakdown by code
echo "Error Breakdown by Code:"
echo "------------------------"
grep -oE "error TS[0-9]+" "$ERROR_LOG" | sort | uniq -c | sort -rn | head -15

echo ""
echo "📁 Most Problematic Files (Top 20)"
echo "=================================="
grep "error TS" "$ERROR_LOG" | sed 's/(.*//' | sort | uniq -c | sort -rn | head -20

echo ""
echo "🔗 Most Common Missing Modules (Top 20)"
echo "=================================="
grep "error TS2307" "$ERROR_LOG" | grep -oE "'@/[^']+'" | sort | uniq -c | sort -rn | head -20

echo ""
echo "📄 Error log saved to: $ERROR_LOG"
echo ""
echo "✅ Analysis complete!"
echo ""
echo "Next steps:"
echo "1. Review TYPE_ERROR_REMEDIATION_PLAN.md"
echo "2. Run Phase 1 fix: scripts/fix-path-mapping.sh"

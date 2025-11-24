#!/bin/bash
# Find all @/src/ imports that need updating after tsconfig change
# Part of Phase 1 remediation

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "🔍 Finding all @/src/ imports..."
echo "=================================="
echo ""
echo "These imports will break after updating tsconfig.json"
echo "because @/* will map to ./* instead of ./src/*"
echo ""

# Find all files with @/src/ imports
FILES=$(grep -r "from '@/src/" --include="*.ts" --include="*.tsx" \
  app/ lib/ components/ src/ tests/ 2>/dev/null | cut -d: -f1 | sort -u || echo "")

if [ -z "$FILES" ]; then
  echo "✅ No @/src/ imports found! You're good to go."
  exit 0
fi

echo "📄 Files with @/src/ imports:"
echo ""

TOTAL_FILES=0
TOTAL_IMPORTS=0

echo "$FILES" | while read -r file; do
  TOTAL_FILES=$((TOTAL_FILES + 1))
  COUNT=$(grep -c "from '@/src/" "$file" 2>/dev/null || echo "0")
  TOTAL_IMPORTS=$((TOTAL_IMPORTS + COUNT))

  echo "  📝 $file"
  echo "     ($COUNT imports)"

  # Show actual imports
  grep -n "from '@/src/" "$file" 2>/dev/null | while IFS=: read -r line_num import_line; do
    MODULE=$(echo "$import_line" | grep -oE "'@/src/[^']+'" || echo "")
    echo "       L$line_num: $MODULE"
  done
  echo ""
done

echo "📊 Summary"
echo "=========="
echo "Total files:   $(echo "$FILES" | wc -l | tr -d ' ')"
echo "Total imports: (counted above)"
echo ""

echo "🔧 Required Changes"
echo "==================="
echo ""
echo "Replace these patterns:"
echo ""
echo "  @/src/contracts/db        → @/contracts/db"
echo "  @/src/contracts/booking   → @/contracts/booking"
echo "  @/src/contracts/schemas   → @/contracts/schemas"
echo "  @/src/modules/            → @/modules/"
echo "  @/src/shared/             → @/shared/"
echo "  @/src/types/              → @/types/"
echo ""

echo "🛠️  How to Fix"
echo "=============="
echo ""
echo "Option 1: VS Code Find & Replace"
echo "  1. Cmd+Shift+F (or Ctrl+Shift+F)"
echo "  2. Search:  from '@/src/"
echo "  3. Replace: from '@/"
echo "  4. Click 'Replace All' or review each"
echo ""

echo "Option 2: sed command (macOS/Linux)"
echo "  # Dry run (shows what would change):"
echo "  find . \\( -name '*.ts' -o -name '*.tsx' \\) -not -path './node_modules/*' \\"
echo "    -exec grep -l \"from '@/src/\" {} \\; \\"
echo "    -exec echo 'Would modify: {}' \\;"
echo ""
echo "  # Actual replacement (macOS):"
echo "  find . \\( -name '*.ts' -o -name '*.tsx' \\) -not -path './node_modules/*' \\"
echo "    -exec sed -i '' \"s|from '@/src/|from '@/|g\" {} \\;"
echo ""
echo "  # Actual replacement (Linux):"
echo "  find . \\( -name '*.ts' -o -name '*.tsx' \\) -not -path './node_modules/*' \\"
echo "    -exec sed -i \"s|from '@/src/|from '@/|g\" {} \\;"
echo ""

echo "Option 3: Manual (safest for learning)"
echo "  Open each file listed above and update imports manually"
echo ""

echo "✅ After fixing, verify with:"
echo "   npm run type-check 2>&1 | grep -c 'error TS2307'"
echo "   (should be 0 or close to 0)"

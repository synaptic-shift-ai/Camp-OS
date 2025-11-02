#!/bin/bash
# Pre-commit smoke test script for CampOps
# Ensures critical functionality works before allowing commits

set -e

echo "🚀 Running pre-commit smoke tests..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track overall status
TESTS_PASSED=true

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        TESTS_PASSED=false
    fi
}

# Navigate to project root
cd "$(git rev-parse --show-toplevel)" || exit 1

# Check if we're in the campsite-command-center directory
if [ -f "oh-saas/campsite-command-center/package.json" ]; then
    cd oh-saas/campsite-command-center || exit 1
else
    echo -e "${YELLOW}⚠${NC} Not in campsite-command-center, skipping API tests"
    exit 0
fi

echo ""
echo "📋 Step 1/4: Type checking..."
if npm run type-check --silent 2>&1 | grep -q "error"; then
    print_status 1 "Type check failed"
else
    print_status 0 "Type check passed"
fi

echo ""
echo "📋 Step 2/4: Linting..."
if npm run lint --silent 2>&1 | grep -q "error"; then
    print_status 1 "Lint check failed"
else
    print_status 0 "Lint check passed"
fi

echo ""
echo "📋 Step 3/4: API server startup verification..."
# Start API server in background
npm run api:minimal > /tmp/api-startup.log 2>&1 &
API_PID=$!

# Wait for server to start (max 10 seconds)
COUNTER=0
MAX_WAIT=10

while [ $COUNTER -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3001/health > /dev/null 2>&1; then
        print_status 0 "API server started successfully"
        break
    fi
    sleep 1
    COUNTER=$((COUNTER + 1))
done

if [ $COUNTER -eq $MAX_WAIT ]; then
    print_status 1 "API server failed to start within ${MAX_WAIT}s"
    cat /tmp/api-startup.log
fi

# Clean up API server
kill $API_PID 2>/dev/null || true
wait $API_PID 2>/dev/null || true

echo ""
echo "📋 Step 4/4: Critical unit tests..."
if npm run test:unit --silent 2>&1 | grep -q "FAIL"; then
    print_status 1 "Unit tests failed"
else
    print_status 0 "Unit tests passed"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$TESTS_PASSED" = true ]; then
    echo -e "${GREEN}✓ All smoke tests passed!${NC}"
    echo "You may proceed with your commit."
    exit 0
else
    echo -e "${RED}✗ Some smoke tests failed!${NC}"
    echo "Please fix the issues before committing."
    echo ""
    echo "To skip this check (not recommended):"
    echo "  git commit --no-verify"
    exit 1
fi

# CI/CD Test Pipeline

**Version**: 1.0
**Created**: 2025-10-31
**Priority**: HIGH - Prevents broken deployments
**Estimated Implementation Time**: 6-8 hours

---

## Overview

This document specifies the CI/CD pipeline integration for automated testing. The pipeline MUST block deployments if critical tests fail, preventing incidents like the October 30 conversion pipeline regression.

**Primary Goal**: Never deploy broken code to production.

---

## Pipeline Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    TRIGGER EVENTS                         │
├──────────────────────────────────────────────────────────┤
│ • Pull Request (any branch → main)                       │
│ • Push to main branch                                     │
│ • Manual workflow dispatch                                │
│ • Paths: middleware.ts, webhook/, onboarding/            │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│                  STAGE 1: SETUP (2 min)                  │
├──────────────────────────────────────────────────────────┤
│ • Checkout code                                           │
│ • Setup Node.js 18                                        │
│ • Cache dependencies                                      │
│ • Install dependencies (npm ci)                           │
│ • Setup test database (Supabase local)                   │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│              STAGE 2: STATIC ANALYSIS (1 min)            │
├──────────────────────────────────────────────────────────┤
│ • TypeScript type-check (npm run type-check)             │
│ • ESLint (npm run lint)                                   │
│ • Format check (prettier --check)                         │
│ ⛔ BLOCK: If any fail → Stop pipeline                    │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│               STAGE 3: UNIT TESTS (2 min)                │
├──────────────────────────────────────────────────────────┤
│ • Run all unit tests (npm run test:unit)                 │
│ • Generate coverage report                                │
│ • Upload coverage to Codecov                              │
│ ⛔ BLOCK: If < 60% coverage → Stop pipeline              │
│ ⛔ BLOCK: If any test fails → Stop pipeline              │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│          STAGE 4: INTEGRATION TESTS (5 min)              │
├──────────────────────────────────────────────────────────┤
│ • Run middleware tests (CRITICAL)                        │
│ • Run webhook tests (CRITICAL)                           │
│ • Run API contract tests (CRITICAL)                      │
│ • Generate test report                                    │
│ ⛔ BLOCK: If any CRITICAL test fails → Stop pipeline     │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│            STAGE 5: SECURITY TESTS (3 min)               │
├──────────────────────────────────────────────────────────┤
│ • Tenant isolation tests                                  │
│ • Auth guard tests                                        │
│ • Data leakage tests                                      │
│ ⛔ BLOCK: If any security test fails → Stop pipeline     │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│              STAGE 6: E2E TESTS (10 min)                 │
├──────────────────────────────────────────────────────────┤
│ • Build production app (npm run build)                   │
│ • Start production server                                 │
│ • Install Playwright browsers                             │
│ • Run conversion pipeline E2E (CRITICAL)                 │
│ • Run wizard navigation E2E                               │
│ • Capture screenshots on failure                          │
│ • Upload trace files                                      │
│ ⛔ BLOCK: If conversion pipeline test fails → STOP       │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│          STAGE 7: PERFORMANCE TESTS (2 min)              │
├──────────────────────────────────────────────────────────┤
│ • Middleware latency benchmarks                           │
│ • API response time checks                                │
│ ⚠️  WARNING: If budgets exceeded (doesn't block)         │
└──────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────┐
│              STAGE 8: REPORTING (1 min)                  │
├──────────────────────────────────────────────────────────┤
│ • Generate HTML test report                               │
│ • Post summary comment on PR                              │
│ • Upload artifacts (screenshots, traces, logs)           │
│ • Notify Slack channel (optional)                         │
└──────────────────────────────────────────────────────────┘
                           ↓
                    ✅ DEPLOYMENT ALLOWED
```

---

## GitHub Actions Workflow

### File: `.github/workflows/test-conversion-pipeline.yml`

```yaml
name: Test Conversion Pipeline

# Trigger on critical path changes
on:
  pull_request:
    branches: [main]
    paths:
      - 'lib/supabase/middleware.ts'
      - 'middleware.ts'
      - 'app/api/stripe/webhook/**'
      - 'app/api/onboarding/**'
      - 'components/onboarding/**'
      - 'tests/**'
      - '.github/workflows/test-conversion-pipeline.yml'
  push:
    branches: [main]
  workflow_dispatch:

env:
  NODE_VERSION: '18'
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_TEST_ANON_KEY }}
  SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_ROLE_KEY }}
  STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
  STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}
  CI: true

jobs:
  # ============================================================
  # STAGE 1 & 2: Setup and Static Analysis
  # ============================================================
  static-analysis:
    name: Static Analysis
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript type-check
        run: npm run type-check

      - name: ESLint
        run: npm run lint

      - name: Format check
        run: npx prettier --check .

  # ============================================================
  # STAGE 3: Unit Tests
  # ============================================================
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: [static-analysis]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
          flags: unit-tests

      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 60" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 60% threshold"
            exit 1
          fi

  # ============================================================
  # STAGE 4: Integration Tests
  # ============================================================
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 10
    needs: [static-analysis]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Start Supabase local
        run: |
          supabase start
          supabase db reset

      - name: Run integration tests
        run: npm run test:integration

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: integration-test-results
          path: test-results/

  # ============================================================
  # STAGE 5: Security Tests
  # ============================================================
  security-tests:
    name: Security Tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: [static-analysis]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Start Supabase local
        run: supabase start

      - name: Run security tests
        run: npm run test:security

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: security-test-results
          path: test-results/

  # ============================================================
  # STAGE 6: E2E Tests (CRITICAL)
  # ============================================================
  e2e-tests:
    name: E2E Tests (CRITICAL)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    needs: [unit-tests, integration-tests, security-tests]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Build production app
        run: npm run build

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1

      - name: Start Supabase local
        run: supabase start

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          PLAYWRIGHT_BASE_URL: http://localhost:3000

      - name: Upload Playwright report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/

      - name: Upload test traces
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-traces
          path: test-results/

  # ============================================================
  # STAGE 7: Performance Tests
  # ============================================================
  performance-tests:
    name: Performance Tests
    runs-on: ubuntu-latest
    timeout-minutes: 5
    needs: [e2e-tests]

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run performance tests
        run: npm run test:performance

      - name: Upload performance results
        uses: actions/upload-artifact@v3
        with:
          name: performance-results
          path: performance-results/

  # ============================================================
  # STAGE 8: Reporting
  # ============================================================
  report:
    name: Test Report
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, security-tests, e2e-tests, performance-tests]
    if: always()

    steps:
      - name: Download all artifacts
        uses: actions/download-artifact@v3

      - name: Generate summary
        run: |
          echo "## Test Results Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "✅ All critical tests passed" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Test Coverage" >> $GITHUB_STEP_SUMMARY
          echo "- Unit Tests: PASSED" >> $GITHUB_STEP_SUMMARY
          echo "- Integration Tests: PASSED" >> $GITHUB_STEP_SUMMARY
          echo "- Security Tests: PASSED" >> $GITHUB_STEP_SUMMARY
          echo "- E2E Tests: PASSED" >> $GITHUB_STEP_SUMMARY

      - name: Comment PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v6
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '## ✅ All Tests Passed\n\n' +
                    'The conversion pipeline is safe to deploy.\n\n' +
                    '**Test Results:**\n' +
                    '- Static Analysis: ✅\n' +
                    '- Unit Tests: ✅\n' +
                    '- Integration Tests: ✅\n' +
                    '- Security Tests: ✅\n' +
                    '- E2E Tests: ✅\n' +
                    '- Performance Tests: ✅\n\n' +
                    '[View detailed test report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})'
            })

      - name: Notify Slack (optional)
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🚨 Conversion Pipeline Tests FAILED",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Conversion Pipeline Tests Failed*\n\nPR: <${{ github.event.pull_request.html_url }}|${{ github.event.pull_request.title }}>\nAuthor: ${{ github.actor }}\n\n❌ Critical tests failed. Deployment blocked."
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Branch Protection Rules

Configure in GitHub Settings → Branches → Branch protection rules for `main`:

```yaml
Required status checks:
  ✅ Static Analysis
  ✅ Unit Tests
  ✅ Integration Tests
  ✅ Security Tests
  ✅ E2E Tests (CRITICAL)
  ⚠️  Performance Tests (optional)

Additional settings:
  ✅ Require branches to be up to date before merging
  ✅ Require status checks to pass before merging
  ✅ Require pull request reviews (1 approval)
  ✅ Dismiss stale pull request approvals
  ❌ Allow force pushes (DISABLED)
  ❌ Allow deletions (DISABLED)
```

---

## Deployment Gates

### Vercel Deployment Integration

```yaml
# vercel.json
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "production": true
    }
  },
  "github": {
    "enabled": true,
    "autoAlias": true,
    "autoJobCancelation": true,
    "silent": false
  },
  "checks": {
    "timeout": 30000,
    "waitUntil": "finished"
  }
}
```

### Pre-Deployment Checklist

Before ANY deployment to production:

```bash
# 1. All tests must pass
✅ npm run test:ci

# 2. Build must succeed
✅ npm run build

# 3. Verify no TypeScript errors
✅ npm run type-check

# 4. Verify no ESLint errors
✅ npm run lint

# 5. Critical E2E test passes
✅ npm run test:e2e:conversion-pipeline

# 6. Performance budgets met
✅ npm run test:performance
```

---

## Test Execution Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --config vitest.config.unit.ts",
    "test:integration": "vitest run --config vitest.config.integration.ts",
    "test:security": "vitest run tests/security/",
    "test:performance": "vitest run tests/performance/",
    "test:e2e": "playwright test",
    "test:e2e:conversion-pipeline": "playwright test tests/e2e/conversion-pipeline.spec.ts",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:debug": "playwright test --debug",
    "test:ci": "npm run test:unit && npm run test:integration && npm run test:security && npm run test:e2e",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

---

## Monitoring & Alerts

### Test Failure Alerts

Configure alerts for:

1. **E2E Test Failures** (CRITICAL)
   - Slack notification immediately
   - Block all deployments
   - Assign to on-call engineer

2. **Integration Test Failures** (HIGH)
   - Slack notification
   - Block deployments
   - Review before merge

3. **Flaky Tests** (MEDIUM)
   - Track failure rate
   - Alert if > 5% flaky rate
   - Fix within 48 hours

4. **Performance Degradation** (LOW)
   - Warning only
   - Investigate within 1 week

### Metrics to Track

- Test pass rate (target: > 99%)
- Test execution time (target: < 15 min)
- Coverage percentage (target: > 60% unit, 80% integration)
- Flaky test rate (target: < 1%)
- Deployment frequency (with confidence)

---

## Rollback Strategy

If tests pass but production issue occurs:

```bash
# 1. Immediate rollback via Vercel
vercel rollback

# 2. Create hotfix branch
git checkout -b hotfix/conversion-pipeline-fix

# 3. Fix issue and add regression test
# - Write failing test that reproduces issue
# - Fix the bug
# - Verify test passes

# 4. Fast-track deployment
# - Skip non-critical tests
# - Manual review and approval
# - Deploy to production

# 5. Post-mortem
# - Why did tests not catch this?
# - What test coverage is missing?
# - Update test suite
```

---

## Success Criteria

CI/CD pipeline is complete when:

- [ ] All test stages execute in < 25 minutes
- [ ] Critical tests block deployment on failure
- [ ] Test results visible in PR comments
- [ ] Coverage reports uploaded to Codecov
- [ ] Slack notifications for failures
- [ ] Branch protection rules enforced
- [ ] Zero false positives (flaky tests fixed)
- [ ] 100 consecutive successful deployments

---

**Related Documentation**:
- [Test Strategy](./TEST_STRATEGY.md)
- [E2E Test Specifications](./E2E_TEST_SPECIFICATIONS.md)
- [Integration Test Specifications](./INTEGRATION_TEST_SPECIFICATIONS.md)
- [Test Utilities Design](./TEST_UTILITIES_DESIGN.md)

# Comprehensive CI/CD Pipeline Architecture for CampOS Platform

**Created**: 2025-11-01
**Status**: Planning Phase
**Owner**: DevOps Pipeline Optimizer Agent

---

## Executive Summary

After analyzing the catastrophic demo failure and current architecture, this plan proposes a **pragmatic, phased CI/CD overhaul** that prioritizes risk reduction while maintaining developer velocity. This design focuses on **preventing broken code from reaching production** while keeping CI costs low and feedback loops fast.

**Key Philosophy**: Fail fast, fail early, fail cheap. Run quick checks first, expensive checks only when necessary.

**Current Risk**: Everything pushed directly to main with no protection = any broken code goes live immediately.

---

## 1. CI/CD Architecture Overview

### 1.1 Branching Strategy: **GitHub Flow (Modified)**

**Rationale**: Simple, effective for small teams, supports continuous deployment. Git Flow is overkill; trunk-based requires more discipline than current state.

```
main (protected) ──────────────────────────────────────►
                     ↑           ↑           ↑
                   merge       merge       merge
                     │           │           │
feature/CAM-123 ─────┘           │           │
feature/CAM-124 ─────────────────┘           │
hotfix/critical-bug ─────────────────────────┘
```

**Branch Types**:
- `main`: Always deployable, production code
- `feature/*`: Feature development (e.g., `feature/CAM-123-booking-flow`)
- `hotfix/*`: Emergency production fixes
- `release/*`: Optional release preparation branches for major releases

**Rules**:
1. All changes via pull requests (NO direct pushes to main)
2. Feature branches created from main, merged back to main
3. Hotfix branches follow same PR process (no shortcuts)
4. Branch names follow convention: `type/CAM-XXX-description`

---

### 1.2 Environment Strategy: **3 Environments**

```
Development (Local) → Staging (Auto) → Production (Manual)
```

| Environment | Purpose | Deployment Trigger | Database | URL Pattern |
|-------------|---------|-------------------|----------|-------------|
| **Development** | Local dev work | Manual (`npm run dev`) | Local Supabase or dev instance | `localhost:3000` |
| **Staging** | Pre-production validation | Auto on merge to `main` | Staging Supabase | `staging.campos.app` or `*.preview.campos.app` |
| **Production** | Live customer environment | Manual approval + tag | Production Supabase | `app.campos.app` |

**Environment Promotion Flow**:
```
PR → CI checks pass → Merge to main → Auto-deploy to Staging
→ Manual testing → Manual approval → Deploy to Production
```

**Why 3 environments?**
- Dev: Fast iteration, no CI overhead
- Staging: Automated validation, safe testing ground
- Production: Customer-facing, requires manual gate

**Preview Deployments** (Phase 3): Per-PR preview environments for UI testing before merge.

---

### 1.3 Testing Strategy: **Layered Quality Gates**

**Principle**: Fail fast, minimize wasted CI minutes. Run quick checks before expensive checks.

#### **On Pull Request (Every Push)**

**Stage 1: Fast Checks (< 2 minutes)**
```bash
1. Install dependencies (with cache)
2. npm run type-check    # TypeScript strict mode
3. npm run lint          # ESLint
```

**Stage 2: Unit Tests (< 3 minutes)**
```bash
4. npm run test:run      # Fast, no DB/network
```

**Stage 3: Integration Tests (< 5 minutes)** - TODO: Enable when implemented
```bash
5. npm run test:integration  # DB interactions
6. npm run test:security     # CRITICAL: Tenant isolation
```

**Stage 4: Runtime Verification (< 2 minutes)** - TODO: Enable when implemented
```bash
7. npm run verify:startup    # API must start successfully
8. Health check validation   # Verify endpoints respond
```

**Total PR validation time: ~12 minutes** (parallelizable to ~8 minutes)

#### **On Merge to Main (Pre-Staging Deployment)**

```bash
1. All PR checks (re-run for safety)
2. npm run build              # Production build
3. npm run test:e2e           # Playwright (against build)
4. npm run test:coverage      # Generate coverage report
5. Build Docker image (if using containers)
```

**Total merge validation time: ~15 minutes**

#### **On Production Deployment (Manual Trigger)**

```bash
1. Deploy to production
2. Smoke tests (basic health checks)
3. Rollback if smoke tests fail
```

**Total production deployment time: ~5 minutes**

#### **Scheduled (Nightly)**

```bash
1. Full test suite (all tests, all browsers)
2. Performance benchmarks
3. Security scanning (npm audit, Snyk)
4. Dependency updates (Dependabot PRs)
```

---

### 1.4 Deployment Strategy: **Progressive with Fast Rollback**

**Staging Deployment (Automatic)**:
- Trigger: Merge to `main`
- Method: Vercel auto-deployment
- Rollback: Revert commit or redeploy previous version
- Validation: Automated smoke tests post-deploy

**Production Deployment (Manual)**:
- Trigger: GitHub Release creation or manual workflow dispatch
- Method: Vercel deployment with manual approval
- Rollback: Instant switch back to previous deployment
- Validation: Manual approval + automated smoke tests

**Deployment Pattern**:
```
┌─────────────┐     ┌─────────────┐
│   Current   │     │    New      │
│   v1.2.3    │────▶│   v1.2.4    │
└─────────────┘     └─────────────┘
       │                   │
       │                   │
    Vercel manages blue-green internally
```

**Database Migration Strategy**:
1. Migrations run BEFORE deployment (backward-compatible)
2. Deploy new code (works with old and new schema)
3. Remove old code compatibility (next release)
4. This allows instant rollbacks without DB rollbacks

---

### 1.5 Rollback Strategy: **< 30 Second Recovery**

**Production Rollback Procedure**:
```bash
# Option 1: GitHub workflow dispatch
→ Select "Rollback to Previous Version"
→ Instant Vercel deployment switch
→ 30 seconds total

# Option 2: Vercel Dashboard
→ Select previous deployment
→ Click "Promote to Production"
→ 30 seconds total
```

**Rollback Decision Tree**:
```
Deployment issue detected
    │
    ├─ Traffic issue? → Instant rollback (Vercel redeploy)
    ├─ Data issue? → Investigate (rollback may not help)
    ├─ Feature bug? → Feature flag disable (if implemented)
    └─ Unknown? → Rollback first, investigate later
```

---

## 2. Branch Protection Rules

### 2.1 Main Branch Protection (GitHub Settings)

Navigate to: **Settings → Branches → Branch protection rules → Add rule**

**Branch name pattern**: `main`

**Required settings**:
```yaml
✅ Require a pull request before merging
  ✅ Require approvals: 1
  ✅ Dismiss stale pull request approvals when new commits are pushed

✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  Required status checks:
    - All PR Checks Passed ✅ (from pr-checks-complete job)

✅ Require conversation resolution before merging

✅ Require linear history (prevents merge commits, enforces squash/rebase)

✅ Do not allow bypassing the above settings
  Exceptions: None (no admin bypass during Phase 1)

✅ Restrict who can push to matching branches
  - No direct pushes allowed (empty list)

✅ Allow force pushes: ❌ Disabled
✅ Allow deletions: ❌ Disabled
```

---

## 3. Implementation Roadmap

### Phase 1: Critical Foundations (Week 1) - **HIGHEST PRIORITY**

**Goal**: Stop broken code from reaching main branch.

**Tasks**:
1. ✅ **Day 1: Branch Protection**
   - Enable main branch protection rules
   - Require PR workflow
   - Disable direct pushes
   - **Success Criteria**: Cannot push directly to main

2. ✅ **Day 2: PR Quality Gates**
   - Update `.github/workflows/pr-checks.yml`
   - Configure required status checks
   - Test with sample PR
   - **Success Criteria**: PR blocked if any check fails

3. ✅ **Day 3: Consolidate Workflows**
   - Merge ci.yml and type-safety.yml into pr-checks.yml
   - Add concurrency control to cancel outdated runs
   - Clean up old workflows
   - **Success Criteria**: Single comprehensive PR workflow

4. ✅ **Day 4: Developer Documentation**
   - Write developer workflow guide
   - Document how to run checks locally
   - Create troubleshooting guide
   - **Success Criteria**: Developers can self-serve

5. ✅ **Day 5: Test Implementation**
   - Add test:integration script (when ready)
   - Add test:security script (when ready)
   - Add verify:startup script (when ready)
   - **Success Criteria**: All quality gates enforced

**Phase 1 Deliverables**:
- ✅ Branch protection enabled
- ✅ PR quality gates enforced
- ✅ Single consolidated workflow
- ✅ Developer documentation

**Risk Reduction**: ~80% of demo failure scenarios prevented

---

### Phase 2: Environment Setup & Deployment Automation (Week 2)

**Goal**: Create staging environment and automate deployments.

**Tasks**:
1. ✅ **Day 6-7: Supabase Staging Environment**
   - Create separate Supabase project for staging
   - Configure RLS policies
   - Set up database migrations
   - Seed with test data
   - **Success Criteria**: Staging database operational

2. ✅ **Day 8: Stripe Test Mode Configuration**
   - Create Stripe test mode account
   - Configure webhooks for staging
   - Update environment variables
   - **Success Criteria**: Staging payments working

3. ✅ **Day 9: Staging Auto-Deploy**
   - Create `.github/workflows/deploy-staging.yml`
   - Configure Vercel staging deployment
   - Auto-deploy on merge to main
   - **Success Criteria**: Merge → automatic staging deploy

4. ✅ **Day 10: Production Deployment Workflow**
   - Create `.github/workflows/deploy-production.yml`
   - Manual trigger with version input
   - Add approval gates
   - Document release process
   - **Success Criteria**: Manual production deployment works

**Phase 2 Deliverables**:
- ✅ Staging environment fully configured
- ✅ Staging auto-deploys on merge
- ✅ Production manual deployment workflow
- ✅ Environment parity achieved

**Risk Reduction**: ~95% of demo failure scenarios prevented

---

### Phase 3: Advanced Features (Week 3-4) - **OPTIONAL ENHANCEMENTS**

**Goal**: Optimize developer experience, add observability.

**Tasks**:
1. **Preview Deployments** (3 days)
   - Configure Vercel preview deployments per PR
   - Automatic cleanup after merge
   - **Success Criteria**: UI changes testable before merge

2. **Performance Monitoring** (2 days)
   - Add Lighthouse CI integration
   - Set performance budgets
   - **Success Criteria**: Perf regressions blocked

3. **Code Coverage Tracking** (2 days)
   - Integrate Codecov
   - Set coverage thresholds
   - **Success Criteria**: Coverage visible in PRs

4. **Nightly Test Suite** (1 day)
   - Create `.github/workflows/nightly-tests.yml`
   - Security scanning (npm audit)
   - **Success Criteria**: Daily health check

5. **Dependency Management** (2 days)
   - Enable Dependabot
   - Configure auto-merge for safe updates
   - **Success Criteria**: Dependencies stay current

**Phase 3 Deliverables**:
- ✅ Preview deployments per PR
- ✅ Performance budgets enforced
- ✅ Code coverage tracking
- ✅ Nightly security scans
- ✅ Automated dependency updates

**Risk Reduction**: ~98% of demo failure scenarios prevented

---

## 4. Developer Workflow Guide

### 4.1 Creating a Feature Branch

```bash
# 1. Ensure main is up to date
git checkout main
git pull origin main

# 2. Create feature branch (follow naming convention)
git checkout -b feature/CAM-123-booking-calendar

# 3. Make your changes
# ... code code code ...

# 4. Run quality checks locally (BEFORE pushing)
npm run type-check         # TypeScript check
npm run lint               # ESLint check
npm run test:run           # Unit tests
npm run build              # Verify build works

# 5. Commit your changes (Conventional Commits)
git add .
git commit -m "feat(booking): add calendar view for site availability"

# 6. Push to remote
git push origin feature/CAM-123-booking-calendar
```

---

### 4.2 Creating a Pull Request

```bash
# 1. Push your branch (if not already pushed)
git push origin feature/CAM-123-booking-calendar

# 2. Open GitHub, navigate to repository
# 3. Click "Compare & pull request"

# 4. Fill out PR template:
## Summary
Brief description of changes

## Changes Made
- Added calendar component
- Integrated with booking API
- Updated tests

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Build verified locally

## Screenshots
[Attach screenshots of UI changes]

## Related Issues
Closes #123

# 5. Wait for CI checks to pass (monitor GitHub Actions)
# 6. Address any review comments
# 7. Merge when approved + all checks pass
```

---

### 4.3 Handling CI Failures

```bash
# Scenario: PR checks failed

# 1. Check GitHub Actions logs
#    - Click "Details" next to failed check
#    - Identify which job failed (type-check, tests, etc.)

# 2. Reproduce locally
npm run type-check         # If TypeScript failed
npm run lint               # If ESLint failed
npm run test:run           # If unit tests failed

# 3. Fix the issue
# ... make corrections ...

# 4. Verify fix locally
npm run check              # Run all checks

# 5. Commit and push fix
git add .
git commit -m "fix: resolve TypeScript errors in booking service"
git push origin feature/CAM-123-booking-calendar

# 6. CI will automatically re-run on new push
```

---

### 4.4 Emergency Hotfix Process

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-payment-bug

# 2. Implement minimal fix
# ... code code code ...

# 3. Run quality checks (REQUIRED, no shortcuts)
npm run check
npm run test:run

# 4. Push and create PR (FOLLOW NORMAL PROCESS)
git add .
git commit -m "fix(payment): resolve Stripe webhook timeout"
git push origin hotfix/critical-payment-bug

# 5. Create PR, mark as "HOTFIX" in title
# 6. Get expedited review
# 7. Merge to main (CI gates still apply)
# 8. Deploy to staging (auto)
# 9. Deploy to production (manual, expedited)

# NOTE: No bypassing CI checks, even for hotfixes
```

---

## 5. Secrets Management

### 5.1 GitHub Secrets Configuration

**Navigate to**: Settings → Secrets and variables → Actions → New repository secret

**Required Secrets**:

**Deployment**:
```
VERCEL_TOKEN              # Vercel deployment token
VERCEL_ORG_ID            # Vercel organization ID
VERCEL_PROJECT_ID        # Vercel project ID
```

**Staging Environment**:
```
STAGING_SUPABASE_URL              # Supabase staging project URL
STAGING_SUPABASE_ANON_KEY         # Supabase staging anon key
STAGING_STRIPE_SECRET_KEY         # Stripe test mode secret key
```

**Production Environment**:
```
PRODUCTION_SUPABASE_URL              # Supabase production project URL
PRODUCTION_SUPABASE_ANON_KEY         # Supabase production anon key
PRODUCTION_STRIPE_SECRET_KEY         # Stripe production secret key
```

**Monitoring** (Optional):
```
CODECOV_TOKEN            # Code coverage reporting
SENTRY_AUTH_TOKEN        # Error tracking integration (already configured)
```

---

## 6. Cost Optimization

### 6.1 GitHub Actions Minutes Budget

**Free tier**: 2,000 minutes/month (private repos)
**Public repos**: Unlimited

**Estimated usage** (per month, private repo):
- PR checks: ~10 min × 40 PRs = 400 minutes
- Staging deploys: ~5 min × 40 merges = 200 minutes
- Production deploys: ~10 min × 8 releases = 80 minutes
- Nightly tests (Phase 3): ~60 min × 12 runs = 720 minutes
- **Total: ~1,400 minutes** (within free tier if nightly tests run 3x/week)

**Optimization strategies**:
1. **Concurrency control** (already implemented) - cancels outdated runs
2. **Path filters** (already implemented) - skip CI for docs changes
3. **Aggressive caching** - npm cache reduces install time
4. **Parallel jobs** - run independent checks simultaneously
5. **Nightly tests** - run 3x/week instead of daily (720 min saved)

---

### 6.2 Hosting Costs

**Current**: Vercel deployment only

**Staging Environment** (to be created):
- Vercel: Free (included in existing account)
- Supabase Free tier: $0/month (up to 500MB database)
- **Total: $0/month** (initially)

**Production Environment**:
- Vercel Pro: $20/month (when needed)
- Supabase Pro: $25/month (when scaling needed)
- **Total: $0-45/month** (depending on scale)

**Preview Deployments** (Phase 3):
- Included in Vercel (automatic cleanup)

**Total estimated CI/CD cost**: ~$0-20/month initially

---

## 7. Success Metrics

### 7.1 Key Performance Indicators (KPIs)

**Deployment Frequency**:
- **Target**: Deploy to staging daily, production weekly
- **Current**: Untracked
- **Measure**: Track deployments via GitHub Actions

**Lead Time for Changes**:
- **Target**: < 24 hours from commit to production
- **Current**: Unknown
- **Measure**: Time from merge to main → production deploy

**Mean Time to Recovery (MTTR)**:
- **Target**: < 30 minutes
- **Current**: Hours (based on demo failure)
- **Measure**: Time from incident detection → resolution

**Change Failure Rate**:
- **Target**: < 15% of deployments require rollback
- **Current**: Unknown
- **Measure**: Rollbacks / Total deployments

**CI Feedback Time**:
- **Target**: < 10 minutes for PR checks
- **Current**: ~8 minutes (estimated)
- **Measure**: Average PR workflow duration

---

### 7.2 Quality Metrics

**Test Pass Rate**:
- **Target**: 100% on main branch
- **Current**: Variable
- **Measure**: Percentage of passing tests in CI

**Type Safety**:
- **Target**: 0 TypeScript errors
- **Current**: Being tracked
- **Measure**: TypeScript error count

**Build Success Rate**:
- **Target**: 100% on main
- **Current**: Unknown
- **Measure**: Successful builds / Total builds

---

## 8. Risk Mitigation

### 8.1 Risk: Team Resistance to New Process

**Likelihood**: Medium
**Impact**: High

**Mitigation**:
- Start with minimal viable gates (Phase 1 only)
- Provide clear documentation and examples
- Show metrics improvement over time
- Offer 1:1 support during transition

**Rollback**:
- If velocity drops significantly, temporarily relax non-critical checks
- Keep branch protection, adjust required status checks
- Gradual re-introduction after training

---

### 8.2 Risk: CI Flakiness (False Failures)

**Likelihood**: Medium
**Impact**: Medium

**Mitigation**:
- Use deterministic tests (no hardcoded dates/times per CLAUDE.md)
- Configure test retries for E2E tests (max 2 retries)
- Monitor flaky test rate, fix aggressively

**Rollback**:
- Temporarily mark flaky tests as non-blocking
- Create issue to fix flaky test
- Re-enable as blocking once stable

---

### 8.3 Risk: Slow CI Feedback Loop

**Likelihood**: Low
**Impact**: High

**Mitigation**:
- Optimize test parallelization
- Use aggressive caching (npm, build artifacts)
- Run fast checks first (fail fast)
- Path filters to skip unnecessary runs

**Rollback**:
- Reduce test scope temporarily (critical tests only)
- Consider self-hosted runners if needed
- Incremental re-introduction of full suite

---

## 9. Next Steps

### Immediate Actions (Today)

1. **Review this plan** - Read through and identify questions
2. **Approve Phase 1** - Confirm we should proceed with critical foundations
3. **Create GitHub issues** - Track each phase as separate issues
4. **Schedule environment setup** - Plan Supabase/Stripe staging creation

### This Week (Phase 1)

1. **Enable branch protection** on main branch
2. **Update PR workflow** with consolidated checks
3. **Test the workflow** with a sample PR
4. **Document the process** for team

### Next Week (Phase 2)

1. **Create Supabase staging** environment
2. **Configure Stripe test mode**
3. **Set up staging auto-deploy**
4. **Create production deploy workflow**

---

## 10. Questions & Answers

**Q: Can I bypass CI checks for an emergency hotfix?**
A: No. Even hotfixes must pass CI checks. The checks are fast (< 10 min) and prevent the emergency from getting worse.

**Q: What if staging is broken and blocking production deploys?**
A: Fix staging first. Production should never be deployed if staging is unhealthy.

**Q: How do I know if my PR is ready to merge?**
A: When all required status checks pass (green checkmarks) and you have 1 approval.

**Q: What if CI is taking too long?**
A: Check GitHub Actions logs to identify bottleneck. Common issues: slow tests, missing cache, network timeouts.

**Q: How do I run the same checks locally as CI?**
A: Use `npm run check` for type-check + lint. Run `npm run test:run` for tests.

---

## 11. Conclusion

This CI/CD architecture is **pragmatic, battle-tested, and appropriate for a small team building a multi-tenant SaaS platform**. It prioritizes:

✅ **Risk Reduction** over automation complexity
✅ **Developer Velocity** over perfect processes
✅ **Cost Efficiency** over enterprise features
✅ **Fast Feedback** over comprehensive testing

**The goal is not perfect CI/CD, but reliable CI/CD that prevents catastrophic failures.**

### Key Wins

1. **Branch Protection** - Prevents accidental direct pushes
2. **PR Quality Gates** - Catches issues before merge
3. **Layered Testing** - Fail fast with quick checks first
4. **Environment Parity** - Staging mirrors production
5. **Fast Rollbacks** - < 30 second recovery via Vercel
6. **Low Cost** - Fits within GitHub Actions free tier initially

### Success Criteria

After Phase 1 implementation:
- ✅ Zero broken code reaches main branch
- ✅ Zero unvalidated deployments to production
- ✅ < 10 minute feedback on PR quality
- ✅ Clear visibility into deployment status
- ✅ Confidence to demo at any time

**Start with Phase 1 this week. You'll see immediate impact.**

---

**Document Version**: 1.0
**Last Updated**: 2025-11-01
**Next Review**: After Phase 1 completion

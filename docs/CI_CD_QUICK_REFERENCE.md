# CI/CD Pipeline - Quick Reference Guide

**Keep this on your desk during implementation and daily development**

---

## 🚀 IMPLEMENTATION SEQUENCE

### Phase 1: Critical Foundations (Do First - This Week)

```
□ Day 1: Enable Branch Protection
  └─ GitHub → Settings → Branches → Add rule for "main"
     ├─ ✅ Require pull request before merging
     ├─ ✅ Require 1 approval
     ├─ ✅ Require status checks: "All PR Checks Passed ✅"
     ├─ ✅ Require linear history
     └─ ✅ No direct pushes allowed

□ Day 2: Update PR Workflow
  └─ Update .github/workflows/pr-checks.yml
     ├─ Consolidate ci.yml + type-safety.yml
     ├─ Add concurrency control
     └─ Test with sample PR

□ Day 3: Test & Validate
  └─ Create test PR to verify gates work
     ├─ Try pushing directly to main (should fail)
     ├─ Create PR with failing tests (should block)
     └─ Create PR with passing tests (should pass)

□ Day 4: Document for Team
  └─ Update team wiki/docs with new workflow

□ Day 5: Add Missing Test Scripts (as needed)
  └─ npm run test:integration (when ready)
  └─ npm run test:security (when ready)
  └─ npm run verify:startup (when ready)
```

### Phase 2: Environment Setup (Next Week)

```
□ Create Supabase Staging Project
  └─ supabase.com → New Project → "campos-staging"
     ├─ Copy connection strings
     ├─ Set up RLS policies (same as prod)
     ├─ Run migrations
     └─ Seed test data

□ Configure Stripe Test Mode
  └─ dashboard.stripe.com → Test mode
     ├─ Create test webhook endpoint
     └─ Copy test API keys

□ Add GitHub Secrets
  └─ GitHub → Settings → Secrets → Actions
     ├─ VERCEL_TOKEN
     ├─ VERCEL_ORG_ID
     ├─ VERCEL_PROJECT_ID
     ├─ STAGING_SUPABASE_URL
     ├─ STAGING_SUPABASE_ANON_KEY
     └─ STAGING_STRIPE_SECRET_KEY

□ Create Staging Deploy Workflow
  └─ .github/workflows/deploy-staging.yml
     └─ Test: merge to main → auto-deploy to staging

□ Create Production Deploy Workflow
  └─ .github/workflows/deploy-production.yml
     └─ Test: manual trigger with version tag
```

### Phase 3: Advanced Features (Optional - Later)

```
□ Preview Deployments (Vercel auto-handles)
□ Code Coverage (Codecov integration)
□ Performance Monitoring (Lighthouse CI)
□ Nightly Tests (security scanning)
```

---

## 📝 DAILY DEVELOPER WORKFLOW

### Starting New Feature

```bash
# 1. Update main
git checkout main
git pull origin main

# 2. Create feature branch (NAMING: feature/CAM-XXX-description)
git checkout -b feature/CAM-123-booking-calendar

# 3. Code your feature
# ... make changes ...

# 4. Run local checks BEFORE pushing
npm run type-check    # TypeScript
npm run lint          # ESLint
npm run test:run      # Unit tests
npm run build         # Verify build

# 5. Commit (use Conventional Commits)
git add .
git commit -m "feat(booking): add calendar view"

# 6. Push
git push origin feature/CAM-123-booking-calendar

# 7. Create PR on GitHub
# 8. Wait for CI checks ✅
# 9. Get approval → Merge
```

### Local Quality Check (Before Push)

```bash
npm run check         # type-check + lint
npm run test:run      # all tests
npm run build         # verify build
```

### When CI Fails

```
1. Click "Details" next to failed check in GitHub
2. Read the error log
3. Reproduce locally:
   npm run type-check  # if TypeScript failed
   npm run lint        # if ESLint failed
   npm run test:run    # if tests failed
4. Fix the issue
5. Commit fix → Push
6. CI automatically re-runs
```

---

## 🚨 EMERGENCY HOTFIX PROCESS

```bash
# 1. Create hotfix branch
git checkout main
git pull origin main
git checkout -b hotfix/critical-payment-bug

# 2. Fix the issue (minimal changes only)

# 3. Test locally (NO SHORTCUTS)
npm run check
npm run test:run

# 4. Push + Create PR
git push origin hotfix/critical-payment-bug
# Mark PR as "HOTFIX: [description]"

# 5. Get expedited review
# 6. Merge to main (CI still runs, no bypass)
# 7. Auto-deploy to staging
# 8. Manual deploy to production (expedited)

⚠️  NO BYPASSING CI CHECKS, EVEN FOR EMERGENCIES
```

---

## 🔄 DEPLOYMENT CHEAT SHEET

### Staging (Automatic)

```
Merge to main → Auto-deploys to staging

URL: staging.campos.app (or Vercel preview URL)

When: After every merge to main
Who: GitHub Actions (automatic)
Validates: Smoke tests run post-deploy
```

### Production (Manual)

```
Step 1: Test on staging first
  └─ Visit staging.campos.app
  └─ Test critical flows (booking, payment, onboarding)
  └─ Verify no errors in Sentry

Step 2: Create release tag
  git checkout main
  git pull origin main
  git tag -a v1.2.3 -m "Release v1.2.3: Feature X"
  git push origin v1.2.3

Step 3: Trigger production deploy
  └─ GitHub → Actions → "Deploy to Production"
  └─ Click "Run workflow"
  └─ Enter version: v1.2.3
  └─ Confirm

Step 4: Monitor deployment
  └─ Watch GitHub Actions logs
  └─ Check app.campos.app
  └─ Monitor Sentry for errors
  └─ Test critical flows

Step 5: If issues → ROLLBACK IMMEDIATELY
  └─ Vercel Dashboard → Previous deployment → Promote
  └─ OR re-run workflow with previous version tag
```

### Rollback (< 30 seconds)

```
Option 1: Vercel Dashboard
  └─ deployments.vercel.com
  └─ Find previous working deployment
  └─ Click "Promote to Production"

Option 2: GitHub Actions
  └─ Actions → "Deploy to Production"
  └─ Run workflow with previous version (e.g., v1.2.2)

Option 3: Git Revert
  └─ git revert <bad-commit>
  └─ Push to main → auto-deploys to staging
  └─ Test → manual deploy to production
```

---

## 🎯 BRANCH NAMING CONVENTIONS

```
feature/CAM-123-short-description    ✅ Correct
hotfix/critical-bug-description      ✅ Correct
release/v1.2.3                       ✅ Correct (optional)

feature/my-feature                   ❌ Missing CAM-XXX
fix-bug                              ❌ Wrong format
CAM-123                              ❌ Missing type/
```

---

## 💬 COMMIT MESSAGE FORMAT (Conventional Commits)

```
feat(scope): description             ✅ New feature
fix(scope): description              ✅ Bug fix
docs(scope): description             ✅ Documentation
refactor(scope): description         ✅ Code refactor
test(scope): description             ✅ Test changes
chore(scope): description            ✅ Maintenance

Examples:
feat(booking): add calendar view for site availability
fix(payment): resolve Stripe webhook timeout
docs(ci): update deployment guide
refactor(auth): simplify middleware logic
test(booking): add availability edge cases
chore(deps): update Next.js to v16

❌ Avoid:
- "fixed stuff"
- "updates"
- "WIP"
- References to Claude/Anthropic
```

---

## ⚙️ GITHUB SECRETS CHECKLIST

### Phase 1 (Required Now)
```
□ VERCEL_TOKEN              (for deployments)
□ VERCEL_ORG_ID             (Vercel organization)
□ VERCEL_PROJECT_ID         (Vercel project)
```

### Phase 2 (Required for Staging)
```
□ STAGING_SUPABASE_URL
□ STAGING_SUPABASE_ANON_KEY
□ STAGING_STRIPE_SECRET_KEY
```

### Phase 2 (Required for Production)
```
□ PRODUCTION_SUPABASE_URL
□ PRODUCTION_SUPABASE_ANON_KEY
□ PRODUCTION_STRIPE_SECRET_KEY
```

### Phase 3 (Optional)
```
□ CODECOV_TOKEN             (code coverage)
□ SENTRY_AUTH_TOKEN         (already have SENTRY_DSN)
```

**Where to add**: GitHub → Settings → Secrets and variables → Actions

---

## 🧪 TEST SCRIPT REFERENCE

### Current (Working)
```bash
npm run type-check          # TypeScript strict check
npm run lint                # ESLint
npm run test:run            # Vitest unit tests
npm run test:coverage       # Test coverage report
npm run test:e2e            # Playwright E2E tests
npm run build               # Production build
npm run check               # type-check + lint (quick)
```

### To Implement Later
```bash
npm run test:integration    # TODO: DB integration tests
npm run test:security       # TODO: Tenant isolation tests
npm run verify:startup      # TODO: API startup verification
```

---

## 🔍 TROUBLESHOOTING QUICK FIXES

### "CI is failing but works locally"

```
1. Check Node version (should be 20)
   node --version

2. Clean install
   rm -rf node_modules package-lock.json
   npm install

3. Check environment variables
   Missing env vars in CI? Add to GitHub Secrets

4. Check for dynamic dates/times in tests
   See .claude/testing-guidelines.md
```

### "Can't push to main"

```
✅ This is correct! Branch protection is working.

Fix:
1. Create feature branch
2. Make changes
3. Push feature branch
4. Create PR
5. Merge after approval + CI passes
```

### "PR checks taking too long"

```
Check GitHub Actions logs for bottleneck:

Common issues:
- npm install slow → Cache may be stale
- Tests slow → Parallelize or optimize
- Build slow → Check for infinite loops

Optimization:
- Path filters skip unnecessary runs (already configured)
- Concurrency cancels outdated runs (already configured)
```

### "Deployment failed"

```
Staging:
1. Check GitHub Actions logs
2. Fix the issue
3. Push fix → auto-redeploys

Production:
1. ROLLBACK IMMEDIATELY (Vercel dashboard)
2. Investigate in staging
3. Fix + test in staging
4. Retry production deploy
```

---

## 📊 SUCCESS METRICS TO TRACK

```
Weekly Review:
□ Deployments to staging this week: ___
□ Deployments to production this week: ___
□ Rollbacks required: ___
□ Average PR feedback time: ___ minutes
□ Test pass rate on main: ___%
□ TypeScript errors: ___

Goals:
✅ Deploy to staging daily
✅ Deploy to production weekly
✅ < 15% rollback rate
✅ < 10 min PR feedback
✅ 100% test pass rate on main
✅ 0 TypeScript errors
```

---

## 🚦 DECISION TREE: "Should I bypass CI?"

```
                    Is this an emergency?
                            │
                ┌───────────┴───────────┐
               No                      Yes
                │                       │
         Follow normal              Is production down?
         PR workflow                     │
                                ┌────────┴────────┐
                               No               Yes
                                │                │
                         Still follow       Create hotfix
                         PR workflow        branch + PR
                         (expedited)        (CI still runs)

⚠️ NEVER BYPASS CI CHECKS
   - Even for emergencies
   - CI takes < 10 minutes
   - Prevents making the emergency worse
```

---

## 📞 WHEN TO ASK FOR HELP

```
Ask before proceeding if:
□ CI has been failing for > 1 hour
□ You're unsure about bypassing a check
□ Deployment failed and you don't know why
□ You need to rollback production
□ Branch protection is blocking legitimate work
□ Secrets are missing and you can't find them

Don't struggle alone - CI/CD issues compound quickly!
```

---

## 🎓 LEARNING RESOURCES

- **Full Plan**: `docs/CI_CD_PIPELINE_PLAN.md`
- **Testing Guidelines**: `.claude/testing-guidelines.md`
- **CLAUDE.md**: Project best practices
- **Conventional Commits**: https://www.conventionalcommits.org
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Vercel Docs**: https://vercel.com/docs

---

**Version**: 1.0 | **Last Updated**: 2025-11-01 | **Print and keep on desk!**

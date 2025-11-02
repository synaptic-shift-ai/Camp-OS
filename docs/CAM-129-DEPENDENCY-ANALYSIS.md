# CAM-129 Middleware Hardening - Dependency Analysis & Execution Order

**Created**: 2025-11-01
**Parent Issue**: CAM-129 - CRITICAL BUG - Middleware hardening
**Purpose**: Define task dependencies and optimal execution order for the 6-week middleware refactor sprint

---

## Executive Summary

This document analyzes the 16 sub-tasks of CAM-129 and their interdependencies. The analysis reveals:

- **Phase 1 (Planning)**: COMPLETE - All 3 planning tasks delivered comprehensive documentation
- **Critical Path**: CAM-135 → CAM-136/CAM-137 → CAM-138 → CAM-139 → CAM-140 → Testing → Deployment
- **Parallel Opportunities**: Phase 2 refactors, Phase 4 testing tasks
- **Highest Risk Task**: CAM-138 (Wizard Access Logic) - This exact logic broke in Oct 30 incident

---

## Planning Deliverables (Phase 1 - COMPLETE)

All three planning tasks are **DONE** and have produced comprehensive deliverables that serve as the foundation for all implementation work:

### CAM-132: Audit Current Middleware (DONE)
- **Status**: ✅ Complete
- **Deliverable**: `docs/architecture/MIDDLEWARE_AUDIT_CAM-132.md` (1,337 lines)
- **Completion**: 2025-11-01

**Key Outputs**:
- Comprehensive analysis of current 110-line middleware function
- 10 anti-patterns identified (AP-1 through AP-10)
- 4 race conditions documented (RC-1 through RC-4)
- 15 prioritized recommendations (Critical → High → Medium)
- Visual flowcharts of current execution order (3 Mermaid diagrams)
- Performance analysis: 45-211ms per request (opportunity for 10-50ms improvement)
- Security validation: Tenant isolation SECURE ✅

**Critical Findings**:
- Current middleware is "fragile but functional"
- Wizard exception logic is implicit and easy to break (as demonstrated Oct 30)
- No error handling on async operations (middleware crashes on network failures)
- No logging or observability
- Race condition between webhook and middleware (RC-1)

---

### CAM-133: Middleware Execution Order Specification (DONE)
- **Status**: ✅ Complete
- **Deliverable**: `specs/CAM-129-middleware-spec.md` (1,504 lines)
- **Completion**: 2025-11-01

**Key Outputs**:
- Authoritative execution order specification: Auth → Email → Subscription → Onboarding
- 12 Mermaid diagrams showing decision trees and flows
- TypeScript interfaces for all state management (MiddlewareState, AuthContext, etc.)
- 5 detailed request flow examples (including the broken Oct 30 loop scenario)
- Edge case documentation (8 scenarios including race conditions)
- Critical wizard exception logic with extensive documentation
- Testing requirements integrated throughout

**Critical Sections**:
- **Section 3.4**: Check 3 - Wizard Exception Logic (MUST READ for CAM-138)
- **Section 5**: State Management Requirements (foundation for CAM-135 types)
- **Section 6.5**: Example 5 - BROKEN Flow showing exact Oct 30 infinite loop
- **Section 8**: Critical Lessons Learned (5 lessons from incident)

---

### CAM-134: Test Strategy for Middleware (DONE)
- **Status**: ✅ Complete
- **Deliverable**: `tests/middleware/TEST_PLAN.md` (1,096 lines)
- **Completion**: 2025-11-01

**Key Outputs**:
- 10 prioritized test scenarios (5 CRITICAL, 3 HIGH, 2 MEDIUM)
- 3 E2E user flow specifications
- Test pyramid distribution: 50% unit / 35% integration / 15% e2e
- Test utilities design (`tests/utils/middleware-helpers.ts`)
- 4 mock strategies (Supabase auth, database, Next.js, cookies)
- Security testing requirements (100% tenant isolation coverage)
- Delegation plan for 5 specialized test agents

**Critical Scenarios**:
- **Scenario 1**: Wizard Access Regression Test (HIGHEST PRIORITY - tests exact Oct 30 bug)
- **Scenario 5**: Tenant Isolation Security Tests (multi-tenant validation)
- **E2E Flow 1**: Complete conversion pipeline (payment → wizard → dashboard)

**Test Coverage Goals**:
- Wizard exception logic: 100% coverage (regression prevention)
- Tenant isolation: 100% coverage (security critical)
- Authentication validation: 100% coverage (security critical)

---

## Dependency Graph

### Visual Dependency Map

```
Phase 1 - Planning (COMPLETE)
┌─────────────────────────────────────────────────────────────┐
│ CAM-132: Audit          CAM-133: Spec          CAM-134: Tests│
│   (DONE)                  (DONE)                  (DONE)     │
└────────────┬──────────────────┬──────────────────┬───────────┘
             │                  │                  │
             │    All tasks reference these docs   │
             ▼                  ▼                  ▼

Phase 2 - Foundation
┌──────────────────────────────────────────────────────────────┐
│                    CAM-135: Core Types                        │
│                     (8h, Urgent)                              │
└────────────────────────┬─────────────────────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           ▼                           ▼
    ┌──────────────┐           ┌──────────────┐
    │ CAM-136: Auth│           │ CAM-137:     │  <-- Can run in parallel
    │  Middleware  │           │  Tenant MW   │
    │  (16h)       │           │  (20h)       │
    └──────┬───────┘           └──────┬───────┘
           │                          │
           └─────────────┬────────────┘
                         ▼

Phase 3 - Wizard Logic Extraction
┌──────────────────────────────────────────────────────────────┐
│              CAM-138: Extract Wizard Middleware               │
│               (18h, CRITICAL RISK)                            │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
                ┌────────────────┐
                │ CAM-139: Comp. │
                │   Pattern (16h)│
                └────────┬───────┘
                         │
                         ▼
                ┌────────────────┐
                │ CAM-140: Update│
                │  Main MW (12h) │
                └────────┬───────┘
                         │
                         ▼

Phase 4 - Testing & Validation
┌──────────────────────────────────────────────────────────────┐
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │CAM-141   │  │CAM-142   │  │CAM-143   │  │CAM-144   │     │
│  │Unit Tests│  │Int Tests │  │E2E Tests │  │Security  │     │ <-- Parallel
│  │(24h)     │  │(28h)     │  │(20h)     │  │(16h)     │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼

Phase 5 - Docs & Deployment
┌──────────────────────────────────────────────────────────────┐
│  ┌─────────────────┐         ┌─────────────────┐            │
│  │ CAM-145: Docs   │         │ CAM-146: Perf   │            │ <-- Parallel
│  │      (12h)      │         │  Testing (16h)  │            │
│  └─────────────────┘         └────────┬────────┘            │
│                                        │                     │
│                                        ▼                     │
│                              ┌─────────────────┐            │
│                              │ CAM-147: Deploy │            │
│                              │      (10h)      │            │
│                              └─────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

---

## Detailed Dependency Matrix

| Task | Blocked By | Blocks | Parallel With | Deliverable References |
|------|-----------|--------|---------------|----------------------|
| **CAM-132** | None | CAM-133, CAM-135-147 (informs all) | CAM-133, CAM-134 | MIDDLEWARE_AUDIT_CAM-132.md ✅ |
| **CAM-133** | None | CAM-135-147 (spec for all) | CAM-132, CAM-134 | CAM-129-middleware-spec.md ✅ |
| **CAM-134** | None | CAM-141-144 (test guide) | CAM-132, CAM-133 | TEST_PLAN.md ✅ |
| **CAM-135** | CAM-132, CAM-133 | CAM-136, CAM-137 | None | lib/middleware/types.ts |
| **CAM-136** | CAM-135 | CAM-138, CAM-144 | CAM-137 | lib/middleware/auth.ts |
| **CAM-137** | CAM-135 | CAM-138, CAM-144 | CAM-136 | lib/middleware/tenant.ts |
| **CAM-138** | CAM-136, CAM-137 | CAM-139 | None | lib/middleware/wizard.ts |
| **CAM-139** | CAM-138 | CAM-140 | None | lib/middleware/compose.ts |
| **CAM-140** | CAM-139 | CAM-143, CAM-146 | None | middleware.ts (updated) |
| **CAM-141** | CAM-134 (utilities) | CAM-142 | None | tests/unit/middleware/*.test.ts |
| **CAM-142** | CAM-141 (utilities) | None | CAM-143, CAM-144 | tests/integration/middleware/*.test.ts |
| **CAM-143** | CAM-140 (impl complete) | None | CAM-142, CAM-144 | tests/e2e/*middleware*.spec.ts |
| **CAM-144** | CAM-136, CAM-137 (refactors) | None | CAM-142, CAM-143 | tests/security/tenant-isolation-middleware.test.ts |
| **CAM-145** | CAM-140 (impl complete) | None | CAM-146 | docs/architecture/middleware.md |
| **CAM-146** | CAM-140 (impl complete) | CAM-147 | CAM-145 | tests/performance/middleware-queries.test.ts |
| **CAM-147** | CAM-146 (perf validated) | None | None | Production deployment artifacts |

---

## Critical Path Analysis

The **critical path** (longest dependent chain determining minimum sprint duration):

```
CAM-135 (8h)
  ↓
CAM-136 (16h) OR CAM-137 (20h) [max = 20h]
  ↓
CAM-138 (18h) ⚠️ HIGHEST RISK
  ↓
CAM-139 (16h)
  ↓
CAM-140 (12h)
  ↓
CAM-143 (20h) OR CAM-146 (16h) [max = 20h]
  ↓
CAM-147 (10h)
───────────────
TOTAL: 104 hours (13 days @ 8h/day, ~2.6 weeks)
```

**Critical Path Tasks** (must stay on schedule):
1. CAM-135 (Core Types) - Foundation for everything
2. CAM-137 (Tenant Middleware) - Longest Phase 2 task (20h)
3. CAM-138 (Wizard Middleware) - HIGHEST RISK, broke in Oct 30
4. CAM-139 (Composition Pattern) - Required for main update
5. CAM-140 (Update Main Middleware) - Enables all testing
6. CAM-143 or CAM-146 (whichever finishes last)
7. CAM-147 (Deployment) - Final gate

---

## Execution Order Recommendations

### Week 1: Foundation (CAM-135, CAM-136, CAM-137)

**Day 1-2**: CAM-135 - Core Middleware Types (8h)
- Read: CAM-133 Section 5 (State Management)
- Implement: Branded types, state interfaces, type guards
- Verify: `npm run type-check` passes

**Day 2-4**: CAM-136 (Auth Middleware) + CAM-137 (Tenant Middleware) - PARALLEL
- Engineer A: CAM-136 (16h) - Auth middleware refactor
  - Read: CAM-132 Section 2.2, CAM-133 Section 3.1
  - Implement: Single-responsibility auth validation
  - Verify: `npm run verify:startup`

- Engineer B: CAM-137 (20h) - Tenant middleware refactor
  - Read: CAM-132 Section 5.1 (RC-1 race condition)
  - Implement: Tenant isolation with retry logic
  - Verify: Tenant isolation tests

---

### Week 2: Wizard Logic Extraction (CAM-138, CAM-139, CAM-140)

**Day 5-6**: CAM-138 - Extract Wizard Middleware (18h) ⚠️ CRITICAL
- **MUST READ**:
  - CAM-133 Section 3.4 (Wizard Exception) - COMPLETE
  - CAM-133 Section 8.1 (Lesson 1: Wizard IS Onboarding)
  - CAM-133 Section 6.5 (Example 5: Broken Flow)
- **MUST IMPLEMENT**: Comprehensive inline documentation
- **MUST TEST**: Scenario 1 from CAM-134 (regression test)
- Risk: This exact logic caused Oct 30 production incident
- Mitigation: Peer review required, E2E test before merging

**Day 7-8**: CAM-139 - Middleware Composition Pattern (16h)
- Read: CAM-132 Section 7 (Anti-pattern AP-6)
- Implement: Composition utility to chain middleware
- Verify: All middleware can be composed correctly

**Day 9**: CAM-140 - Update Main Middleware (12h)
- Read: CAM-133 Complete execution order
- Implement: Replace monolithic `updateSession` with composed chain
- Verify: `npm run verify:startup`, all routes work

---

### Week 3-4: Testing (CAM-141, CAM-142, CAM-143, CAM-144)

**Week 3 Day 1-2**: CAM-141 - Unit Tests (24h)
- **First**: Implement test utilities from CAM-134
  - `tests/utils/middleware-helpers.ts`
  - Mock strategies (Supabase auth, Next.js request/response)
- **Then**: Implement CRITICAL scenarios from CAM-134:
  - Scenario 1: Wizard access (regression test) - PRIORITY 1
  - Scenario 2: Auth guards
  - Scenario 3: Email verification
  - Scenario 4: Subscription validation
  - Scenario 10: Route matching
- Target: 90%+ coverage on middleware code

**Week 3-4 Days 3-7**: Parallel Testing Tasks

**Engineer A**: CAM-142 - Integration Tests (28h)
- Use utilities from CAM-141
- Test middleware chains with real database
- Cover: Auth → Tenant → Wizard → Route flows
- Verify: No redirect loops, context propagation works

**Engineer B**: CAM-143 - E2E Tests (20h)
- Requires: Playwright setup
- Test: Complete conversion pipeline (payment → wizard → dashboard)
- Verify: NO infinite loops (critical regression prevention)

**Engineer C**: CAM-144 - Security Tests (16h)
- Test: Tenant isolation (Scenario 5 from CAM-134)
- Verify: User A cannot access Company B data
- Validate: All DB queries properly filtered by owner_id/company_id

---

### Week 5: Documentation & Performance (CAM-145, CAM-146)

**Parallel Tasks**:

**Engineer A**: CAM-145 - Architecture Documentation (12h)
- Consolidate: CAM-132, CAM-133, CAM-134 into user-facing docs
- Create: Usage examples, troubleshooting guide, migration guide
- Reference: Existing Mermaid diagrams from CAM-133

**Engineer B**: CAM-146 - Performance Testing (16h)
- Test: Database query optimization (Scenario 7 from CAM-134)
- Verify: Max 2 DB queries per request
- Measure: Middleware latency (target: <200ms p95)
- Optimize: Caching, parallel queries per CAM-132 recommendations

---

### Week 6: Deployment (CAM-147)

**Day 1**: CAM-147 - Production Deployment & Monitoring (10h)
- Verify: All test suites green (unit, integration, e2e, security)
- Setup: Monitoring per CAM-133 Appendix E
  - Redirect loop detection
  - Middleware execution time metrics
  - Database query failure alerts
- Deploy: Staged rollout with rollback plan
- Validate: Zero redirect loops in production

**Day 2-5**: Buffer for issues, stakeholder demos, retrospective

---

## Risk Assessment & Mitigation

### Highest Risk Tasks

**1. CAM-138: Extract Wizard Access Logic** ⚠️ CRITICAL
- **Risk**: This exact logic caused Oct 30 production outage
- **Impact**: HIGH - Breaks conversion pipeline, prevents new customers from onboarding
- **Probability**: MEDIUM - Complex logic, easy to break during refactor
- **Mitigation**:
  - MUST READ: CAM-133 Section 3.4, 8.1, 6.5 COMPLETELY before coding
  - MUST IMPLEMENT: Comprehensive inline documentation (see spec example)
  - MUST TEST: Scenario 1 from CAM-134 (regression test) BEFORE code review
  - MUST GET: Peer review from senior engineer familiar with incident
  - MUST HAVE: E2E test passing before merging to main

**2. CAM-137: Refactor Tenant Middleware**
- **Risk**: Tenant data leakage if isolation breaks
- **Impact**: CRITICAL - Security vulnerability, data breach
- **Probability**: LOW - Current implementation is secure, audit validated
- **Mitigation**:
  - Run CAM-144 security tests BEFORE and AFTER refactor
  - Verify: 100% test coverage on tenant isolation
  - Validate: All DB queries include owner_id or company_id filters

**3. CAM-140: Update Main Middleware**
- **Risk**: Breaking existing routes, runtime failures
- **Impact**: HIGH - All protected routes break
- **Probability**: MEDIUM - Large refactor touching critical path
- **Mitigation**:
  - MUST RUN: `npm run verify:startup` before commit (enforced by pre-commit hook)
  - MUST TEST: All integration tests passing
  - Staged rollout: Deploy to staging first, validate manually

---

### Recommended Work Sequencing

**Optimal Team Size**: 3-4 engineers

**Engineer Assignments**:
- **Engineer A (Senior)**: CAM-138 (wizard logic), CAM-139, CAM-140 - Critical path owner
- **Engineer B (Mid-Senior)**: CAM-136, CAM-137, CAM-144 - Security focus
- **Engineer C (Mid)**: CAM-141, CAM-142 - Testing specialist
- **Engineer D (Mid)**: CAM-143, CAM-145, CAM-146 - E2E & docs

**Weekly Milestones**:
- **Week 1 End**: Phase 2 complete (types + refactored auth/tenant middleware)
- **Week 2 End**: Phase 3 complete (wizard extracted, composition implemented, main updated)
- **Week 3 End**: 80% of tests implemented (unit + integration)
- **Week 4 End**: 100% of tests passing (including E2E and security)
- **Week 5 End**: Documentation complete, performance validated
- **Week 6 End**: Production deployment successful, monitoring live

---

## Parallel Work Opportunities

To reduce total sprint duration, these tasks can run in **parallel**:

### Phase 2 (Week 1):
- CAM-136 (Auth) || CAM-137 (Tenant) - 20h instead of 36h
- **Savings**: 16 hours (2 days)

### Phase 4 (Week 3-4):
- CAM-142 (Integration) || CAM-143 (E2E) || CAM-144 (Security) - 28h instead of 64h
- **Savings**: 36 hours (4.5 days)

### Phase 5 (Week 5):
- CAM-145 (Docs) || CAM-146 (Performance) - 16h instead of 28h
- **Savings**: 12 hours (1.5 days)

**Total Parallelization Savings**: 64 hours (8 days)

**Sprint Duration**:
- **Sequential**: 264 hours = 33 days (6.6 weeks)
- **With Parallelization**: 200 hours = 25 days (5 weeks)
- **Recommended with Buffer**: 6 weeks (30 days)

---

## Success Criteria

### Phase-Level Gates

**Phase 1 - Planning**: ✅ COMPLETE
- [x] CAM-132: Audit complete (1,337 lines)
- [x] CAM-133: Specification complete (1,504 lines)
- [x] CAM-134: Test plan complete (1,096 lines)

**Phase 2 - Foundation**:
- [ ] CAM-135: `npm run type-check` passes, all types exported
- [ ] CAM-136: `npm run verify:startup` passes, auth tests green
- [ ] CAM-137: Tenant isolation tests 100% passing

**Phase 3 - Wizard Logic**:
- [ ] CAM-138: Wizard access regression test passing (Scenario 1)
- [ ] CAM-139: Middleware composition working correctly
- [ ] CAM-140: `npm run verify:startup`, all routes functional

**Phase 4 - Testing**:
- [ ] CAM-141: 90%+ unit test coverage
- [ ] CAM-142: 100% integration test coverage on middleware chains
- [ ] CAM-143: E2E conversion pipeline test passing (no redirect loops)
- [ ] CAM-144: 100% security tests passing (tenant isolation validated)

**Phase 5 - Deployment**:
- [ ] CAM-145: Documentation reviewed by team
- [ ] CAM-146: Performance targets met (<200ms p95, max 2 DB queries)
- [ ] CAM-147: Production deployment successful, monitoring live

### Overall Sprint Success

The sprint is complete when:
- ✅ All 16 tasks marked DONE in Linear
- ✅ Zero infinite redirect loops (verified by E2E tests)
- ✅ 16/16 tenant isolation security tests passing (existing baseline)
- ✅ Type-check, lint, and all test suites green
- ✅ Production deployment successful with monitoring
- ✅ No regression in existing functionality
- ✅ Documentation complete and accessible to team

---

## Document Updates & Change Log

| Date | Update | Author |
|------|--------|--------|
| 2025-11-01 | Initial dependency analysis created | Scrum Master Agent |
| 2025-11-01 | Added prerequisite comments to all 16 Linear issues | Scrum Master Agent |

---

## Related Documents

- **Planning Deliverables**:
  - [Middleware Audit (CAM-132)](./architecture/MIDDLEWARE_AUDIT_CAM-132.md)
  - [Execution Order Specification (CAM-133)](../specs/CAM-129-middleware-spec.md)
  - [Test Plan (CAM-134)](../tests/middleware/TEST_PLAN.md)

- **Incident Context**:
  - [Incident Summary (Oct 30, 2025)](./reference/INCIDENT_SUMMARY_2025_10_30.md)
  - [Onboarding Crisis Handoff](./reference/ONBOARDING_CRISIS_HANDOFF.md)

- **Project Reference**:
  - [CAM-129 PRD](../specs/CAM-129-prd.md)
  - [CLAUDE.md](../CLAUDE.md) - Testing and security requirements

---

**Next Steps**:
1. Review this dependency analysis with team
2. Assign engineers to tasks based on recommended sequencing
3. Start Phase 2 (CAM-135) immediately
4. Schedule weekly check-ins on critical path tasks
5. Set up monitoring for sprint health metrics

---

**Document Owner**: Scrum Master
**Last Updated**: 2025-11-01
**Status**: ACTIVE - Sprint in progress

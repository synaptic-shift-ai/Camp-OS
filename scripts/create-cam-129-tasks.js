#!/usr/bin/env node
/**
 * Create all sprint tasks for CAM-129: Middleware Refactor
 *
 * This script creates 15 sub-issues across 5 phases for the middleware refactor sprint.
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY environment variable not set.');
  process.exit(1);
}

const PARENT_ID = 'CAM-129';

// Task definitions from sprint breakdown
const tasks = [
  // PHASE 1: Analysis & Planning (Week 1)
  {
    title: 'Audit Current Middleware Implementation',
    description: `## Description
Comprehensive analysis of all middleware files to understand current state, identify anti-patterns, and document the redirect loop mechanisms.

## Acceptance Criteria
- [ ] Document all middleware files with their purposes and current logic flow
- [ ] Identify all redirect patterns and map the circular dependencies
- [ ] Create visual flowchart showing current middleware execution order
- [ ] List all race conditions and timing issues discovered
- [ ] Document all environment-specific behaviors (dev vs prod)

## Technical Context
- Review: \`middleware.ts\`, \`lib/middleware/\`, and route-specific middleware
- Focus on: Wizard access logic, auth flows, subscription checks
- Reference: Recent fixes in commits c24735a, 184f6fd
- Tools: Mermaid diagrams for flowcharts

## Files to Review
- \`middleware.ts\`
- \`lib/middleware/auth.ts\`
- \`lib/middleware/tenant.ts\`
- \`lib/middleware/wizard.ts\``,
    labels: ['phase-1-analysis', 'backend', 'documentation'],
    estimate: 16,
    priority: 2,
  },
  {
    title: 'Define Middleware Execution Order Specification',
    description: `## Description
Create a formal specification defining the correct order of middleware execution, decision trees, and state management requirements.

## Acceptance Criteria
- [ ] Written specification document in \`specs/CAM-129-middleware-spec.md\`
- [ ] Execution order diagram showing auth → tenant → wizard → route logic
- [ ] Decision trees for each middleware showing all conditional paths
- [ ] State requirements documented (what each middleware needs/provides)
- [ ] Edge cases and error handling patterns defined

## Technical Context
- Must prevent: Infinite redirects, race conditions, circular dependencies
- Must support: Auth verification, tenant context, wizard access, protected routes
- Reference: CLAUDE.md multi-tenant security requirements (C-10, T-7)
- Follow: Middleware best practices from Next.js 15 documentation

## Deliverables
- \`specs/CAM-129-middleware-spec.md\`
- Mermaid diagrams embedded in spec
- Example request flows for common scenarios`,
    labels: ['phase-1-analysis', 'documentation', 'architecture'],
    estimate: 20,
    priority: 2,
  },
  {
    title: 'Design Test Strategy for Middleware',
    description: `## Description
Create comprehensive testing approach for middleware covering unit tests, integration tests, and e2e scenarios.

## Acceptance Criteria
- [ ] Test plan document created in \`tests/middleware/TEST_PLAN.md\`
- [ ] Unit test scenarios defined for each middleware function
- [ ] Integration test scenarios covering middleware chains
- [ ] E2E test scenarios for critical user flows (signup, wizard, dashboard)
- [ ] Test utilities and helpers identified/designed
- [ ] Mock strategies defined for auth, database, and external dependencies

## Technical Context
- Follow: CLAUDE.md Testing Best Practices (T-1 through T-11)
- Use: Vitest for unit/integration, Playwright for e2e
- Ensure: Dynamic test data generation (no hardcoded dates/IDs)
- Include: Tenant isolation security tests

## Deliverables
- \`tests/middleware/TEST_PLAN.md\`
- Test helper utilities design
- Mock strategy documentation`,
    labels: ['phase-1-analysis', 'testing', 'documentation'],
    estimate: 12,
    priority: 2,
  },

  // PHASE 2: Refactor Foundation (Week 2)
  {
    title: 'Implement Core Middleware Types',
    description: `## Description
Create TypeScript types and interfaces for middleware system ensuring type safety throughout the request/response chain.

## Acceptance Criteria
- [ ] Branded types created for middleware context (MiddlewareContext, AuthContext, TenantContext)
- [ ] Request/Response type extensions defined
- [ ] Middleware function signature types created
- [ ] Type guards implemented for runtime validation
- [ ] All types exported from \`lib/middleware/types.ts\`
- [ ] \`npm run type-check\` passes with zero errors

## Technical Context
- Follow: CLAUDE.md C-5 (branded types for domain IDs)
- Use: \`import type\` for type-only imports (C-6)
- Reference: Existing patterns in \`database/types.ts\`
- Ensure: Multi-tenant type safety (TenantResolvedRequest pattern)

## Implementation
\`\`\`typescript
// lib/middleware/types.ts
import type { NextRequest, NextResponse } from 'next/server';

export type MiddlewareContext = Brand<object, 'MiddlewareContext'>;
export type AuthContext = {
  userId: UserId;
  sessionId: SessionId;
  isAuthenticated: boolean;
};
// ... additional types
\`\`\``,
    labels: ['phase-2-foundation', 'backend', 'typescript'],
    estimate: 8,
    priority: 2,
  },
  {
    title: 'Refactor Auth Middleware with Proper Separation',
    description: `## Description
Refactor authentication middleware to have single responsibility and clear boundaries, eliminating redirect loops.

## Acceptance Criteria
- [ ] Auth middleware only handles authentication verification
- [ ] No redirect logic within auth middleware (delegated to route handlers)
- [ ] Auth context properly added to request object
- [ ] Session validation separated from route protection
- [ ] Unit tests pass for all auth scenarios (authenticated, unauthenticated, expired session)
- [ ] Integration tests pass for auth flow

## Technical Context
- Location: \`lib/middleware/auth.ts\`
- Follow: Single Responsibility Principle
- Remove: Redirect logic (move to route middleware)
- Use: Branded types from previous task
- Reference: Previous fix in commit 184f6fd

## Verification
- [ ] \`npm run verify:startup\` passes
- [ ] \`npm run test:integration\` passes for auth tests
- [ ] No circular dependencies detected`,
    labels: ['phase-2-foundation', 'backend', 'auth'],
    estimate: 16,
    priority: 2,
  },
  {
    title: 'Refactor Tenant Middleware with Isolation Guarantees',
    description: `## Description
Refactor tenant resolution middleware ensuring multi-tenant data isolation and proper context propagation.

## Acceptance Criteria
- [ ] Tenant context resolution extracted to dedicated middleware
- [ ] Tenant validation separated from tenant resolution
- [ ] TenantResolvedRequest type used consistently
- [ ] Multi-tenant security tests pass (tenant isolation verified)
- [ ] Integration tests pass for multi-tenant scenarios
- [ ] No performance degradation (tenant lookup cached appropriately)

## Technical Context
- Location: \`lib/middleware/tenant.ts\`
- Follow: CLAUDE.md multi-tenant requirements (D-2, D-3)
- Use: TenantId branded type from types task
- Ensure: RLS policy compatibility
- Test: Tenant isolation (tests/security/tenant-isolation.test.ts)

## Verification
- [ ] \`npm run test:security\` passes (16/16 tenant tests)
- [ ] \`npm run verify:startup\` passes
- [ ] No data leakage between tenants (security test validation)`,
    labels: ['phase-2-foundation', 'backend', 'multi-tenant', 'security'],
    estimate: 20,
    priority: 2,
  },

  // PHASE 3: Wizard Logic Extraction (Week 3)
  {
    title: 'Extract Wizard Access Logic to Dedicated Middleware',
    description: `## Description
Extract wizard access logic from main middleware into dedicated, composable wizard middleware eliminating redirect loops.

## Acceptance Criteria
- [ ] Wizard middleware created in \`lib/middleware/wizard.ts\`
- [ ] Wizard access logic separated from auth and tenant logic
- [ ] Redirect logic uses proper Next.js redirect primitives (no manual Response creation)
- [ ] Wizard state properly checked (property creation status)
- [ ] No infinite redirect loops (verified with integration tests)
- [ ] Unit tests pass for all wizard access scenarios

## Technical Context
- Extract from: Current \`middleware.ts\` wizard logic
- Reference: Previous fixes in commits c24735a, 184f6fd, 8cdd5ec
- Patterns: Check property fields, validate wizard completion
- Follow: Execution order from Phase 1 spec

## Edge Cases to Handle
- New user (no property) → Allow wizard access
- User with incomplete property → Allow wizard access
- User with complete property → Block wizard access, redirect to dashboard
- User accessing wizard while in onboarding flow → Allow

## Verification
- [ ] No redirect loops when accessing /wizard
- [ ] \`npm run verify:startup\` passes
- [ ] Integration tests pass`,
    labels: ['phase-3-wizard', 'backend', 'onboarding'],
    estimate: 18,
    priority: 2,
  },
  {
    title: 'Implement Middleware Composition Pattern',
    description: `## Description
Create composable middleware pattern allowing controlled execution order and preventing circular dependencies.

## Acceptance Criteria
- [ ] Middleware composition utility created (\`composeMiddleware\`)
- [ ] Execution order explicitly defined and enforced
- [ ] Short-circuit mechanism for early returns (redirects, errors)
- [ ] Context properly passed between middleware layers
- [ ] Type-safe composition (TypeScript validates middleware chain)
- [ ] Documentation added for composition pattern usage

## Technical Context
- Create: \`lib/middleware/compose.ts\`
- Pattern: Functional composition with async support
- Inspiration: Express middleware, Redux middleware patterns
- Ensure: Type safety throughout chain

## Implementation Example
\`\`\`typescript
export function composeMiddleware(...middlewares: Middleware[]): Middleware {
  return async (req, context) => {
    for (const middleware of middlewares) {
      const result = await middleware(req, context);
      if (result) return result; // Short-circuit on redirect/error
    }
    return null;
  };
}
\`\`\`

## Verification
- [ ] Type-check passes
- [ ] Unit tests validate composition behavior
- [ ] Integration tests show correct execution order`,
    labels: ['phase-3-wizard', 'backend', 'architecture'],
    estimate: 16,
    priority: 3,
  },
  {
    title: 'Update Main Middleware with Composition',
    description: `## Description
Refactor main \`middleware.ts\` to use composition pattern with proper execution order.

## Acceptance Criteria
- [ ] Main middleware uses \`composeMiddleware\` utility
- [ ] Execution order: auth → tenant → wizard → route protection
- [ ] Path matchers properly configured for each middleware
- [ ] Config export defines middleware scope
- [ ] No duplicate logic (all logic in individual middleware files)
- [ ] All existing routes continue to work

## Technical Context
- File: \`middleware.ts\`
- Use: Composition pattern from previous task
- Reference: Phase 1 specification for execution order
- Ensure: Backward compatibility with existing routes

## Implementation
\`\`\`typescript
import { composeMiddleware } from '@/lib/middleware/compose';
import { authMiddleware } from '@/lib/middleware/auth';
import { tenantMiddleware } from '@/lib/middleware/tenant';
import { wizardMiddleware } from '@/lib/middleware/wizard';

export default composeMiddleware(
  authMiddleware,
  tenantMiddleware,
  wizardMiddleware
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
\`\`\`

## Verification
- [ ] \`npm run verify:startup\` passes
- [ ] All routes accessible as expected
- [ ] No redirect loops detected`,
    labels: ['phase-3-wizard', 'backend'],
    estimate: 12,
    priority: 2,
  },

  // PHASE 4: Testing & Validation (Week 4-5)
  {
    title: 'Implement Unit Tests for Middleware Functions',
    description: `## Description
Create comprehensive unit tests for each middleware function following TDD approach and CLAUDE.md guidelines.

## Acceptance Criteria
- [ ] Unit tests created for auth middleware (lib/middleware/auth.test.ts)
- [ ] Unit tests created for tenant middleware (lib/middleware/tenant.test.ts)
- [ ] Unit tests created for wizard middleware (lib/middleware/wizard.test.ts)
- [ ] Unit tests created for composition utility (lib/middleware/compose.test.ts)
- [ ] All tests use dynamic data generation (no hardcoded IDs/dates)
- [ ] Test coverage ≥ 90% for all middleware code
- [ ] \`npm run test:unit\` passes with all tests green

## Technical Context
- Follow: CLAUDE.md Testing Best Practices (T-1, T-3, T-6, T-9, T-10, T-11)
- Use: Vitest with colocated test files
- Tools: Test utilities from \`tests/utils/\` for dynamic data
- Pattern: AAA (Arrange, Act, Assert)

## Test Scenarios (per middleware)
- Happy path (authenticated, authorized user)
- Unauthenticated user
- Invalid/expired session
- Missing tenant context
- Incomplete wizard state
- Edge cases from Phase 1 analysis

## Verification
- [ ] \`npm run test:coverage\` shows ≥90% coverage
- [ ] All assertions use strong equality (\`toEqual\`, not \`toBeGreaterThan\`)
- [ ] No brittle temporal data`,
    labels: ['phase-4-testing', 'testing', 'unit-tests'],
    estimate: 24,
    priority: 2,
  },
  {
    title: 'Implement Integration Tests for Middleware Chain',
    description: `## Description
Create integration tests validating the full middleware chain execution with realistic request/response cycles.

## Acceptance Criteria
- [ ] Integration tests created in \`tests/integration/middleware.test.ts\`
- [ ] Tests cover auth → tenant → wizard → route flow
- [ ] Tests validate context propagation between middleware
- [ ] Tests verify no redirect loops occur
- [ ] Tests cover multi-tenant scenarios with proper isolation
- [ ] Tests use test database with proper cleanup
- [ ] \`npm run test:integration\` passes with all tests green

## Technical Context
- Follow: CLAUDE.md T-2, T-4 (prefer integration tests, minimal mocking)
- Location: \`tests/integration/middleware.test.ts\`
- Use: Real Supabase test client (not mocked)
- Ensure: Test isolation (each test creates/cleans own data)

## Test Scenarios
- New user signup → wizard access allowed
- Existing user with property → wizard access denied → redirect to dashboard
- Unauthenticated user → public routes allowed, protected routes redirect to login
- Authenticated user → tenant context resolved → dashboard access granted
- Multi-tenant: Tenant A cannot access Tenant B's data
- Wizard completion → property created → wizard access revoked

## Verification
- [ ] \`npm run verify:startup\` passes before tests
- [ ] Tests pass consistently (no flakes)
- [ ] Test data cleanup verified (no test pollution)`,
    labels: ['phase-4-testing', 'testing', 'integration-tests'],
    estimate: 28,
    priority: 2,
  },
  {
    title: 'Implement E2E Tests for Critical User Flows',
    description: `## Description
Create Playwright e2e tests validating critical user flows through the middleware system in real browser environment.

## Acceptance Criteria
- [ ] E2E tests created in \`tests/e2e/middleware-flows.spec.ts\`
- [ ] Test: Complete signup → wizard → property creation → dashboard flow
- [ ] Test: Login → existing user → dashboard access (no wizard)
- [ ] Test: Wizard access attempt with completed property → redirected to dashboard
- [ ] Test: Logout → login → session restoration
- [ ] All tests run in headless browser (CI compatible)
- [ ] \`npm run test:e2e\` passes with all tests green

## Technical Context
- Tool: Playwright
- Follow: CLAUDE.md Testing Best Practices
- Use: Page Object Model for maintainability
- Ensure: Tests work in both dev and prod environments

## Test Flows
1. **New User Onboarding**
   - Navigate to signup
   - Complete registration
   - Verify wizard access granted
   - Complete wizard steps
   - Verify dashboard access granted
   - Verify wizard access now denied

2. **Existing User Login**
   - Navigate to login
   - Enter credentials
   - Verify direct dashboard access
   - Verify wizard redirect if accessing /wizard

3. **Session Persistence**
   - Login
   - Refresh page
   - Verify still authenticated
   - Verify tenant context preserved

## Verification
- [ ] Tests pass in headless mode
- [ ] No flaky tests (run 3x to verify)
- [ ] Screenshots captured on failure`,
    labels: ['phase-4-testing', 'testing', 'e2e-tests'],
    estimate: 20,
    priority: 3,
  },
  {
    title: 'Security Testing: Tenant Isolation & Auth Bypass',
    description: `## Description
Create security-focused tests ensuring no auth bypass vulnerabilities or tenant data leakage in refactored middleware.

## Acceptance Criteria
- [ ] Security tests created in \`tests/security/middleware-security.test.ts\`
- [ ] Test: Unauthenticated user cannot bypass auth to access protected routes
- [ ] Test: Tenant A cannot access Tenant B's data via middleware manipulation
- [ ] Test: Session token manipulation detected and rejected
- [ ] Test: Wizard access control cannot be bypassed
- [ ] Test: Direct URL access to protected routes properly redirects
- [ ] All existing tenant isolation tests still pass (16/16)
- [ ] \`npm run test:security\` passes with all tests green

## Technical Context
- Follow: CLAUDE.md T-7, T-12 (multi-tenant security testing)
- Location: \`tests/security/middleware-security.test.ts\`
- Reference: Existing tests in \`tests/security/tenant-isolation.test.ts\`
- Tools: Attempt malicious requests, verify proper rejection

## Attack Scenarios to Test
- **Auth Bypass**: Remove auth token, attempt protected route access
- **Session Hijacking**: Use expired/invalid session token
- **Tenant Hopping**: Authenticated as Tenant A, try to access Tenant B's /dashboard
- **Wizard Bypass**: User with completed property tries to POST to wizard endpoints
- **Direct DB Access**: Verify RLS policies block cross-tenant queries
- **Parameter Tampering**: Modify tenant_id in request, verify rejection

## Verification
- [ ] All attack scenarios properly blocked
- [ ] Error messages don't leak sensitive information
- [ ] Audit logs created for security violations (if implemented)`,
    labels: ['phase-4-testing', 'testing', 'security', 'multi-tenant'],
    estimate: 16,
    priority: 1,
  },

  // PHASE 5: Documentation & Deployment (Week 5-6)
  {
    title: 'Create Middleware Architecture Documentation',
    description: `## Description
Write comprehensive documentation explaining the refactored middleware architecture, usage patterns, and troubleshooting guides.

## Acceptance Criteria
- [ ] Architecture document created: \`docs/architecture/middleware.md\`
- [ ] Execution flow diagram (Mermaid) showing middleware chain
- [ ] Usage examples for common scenarios
- [ ] Troubleshooting guide for common issues (redirect loops, auth failures)
- [ ] Migration guide from old to new middleware patterns
- [ ] API reference for middleware functions and types
- [ ] Contributing guidelines for adding new middleware

## Technical Context
- Location: \`docs/architecture/middleware.md\`
- Include: Mermaid diagrams, code examples, decision trees
- Reference: Phase 1 specification and implementation

## Documentation Sections
1. **Overview**: Purpose, goals, principles
2. **Architecture**: Execution order, composition pattern, type system
3. **Middleware Reference**:
   - Auth middleware (purpose, inputs, outputs, behavior)
   - Tenant middleware
   - Wizard middleware
   - Composition utility
4. **Usage Patterns**: Common scenarios with code examples
5. **Troubleshooting**: Common issues and solutions
6. **Migration Guide**: How to update custom middleware
7. **Testing**: How to test middleware changes

## Verification
- [ ] Documentation reviewed by team member
- [ ] All code examples tested and verified
- [ ] Diagrams accurately reflect implementation`,
    labels: ['phase-5-docs', 'documentation'],
    estimate: 12,
    priority: 3,
  },
  {
    title: 'Performance Testing & Optimization',
    description: `## Description
Conduct performance testing of refactored middleware to ensure no regression and identify optimization opportunities.

## Acceptance Criteria
- [ ] Benchmark tests created comparing old vs new middleware performance
- [ ] Load testing performed (simulate 100 concurrent users)
- [ ] Middleware execution time measured per layer (auth, tenant, wizard)
- [ ] Memory usage profiled and compared to baseline
- [ ] No performance regression detected (≤5% degradation acceptable)
- [ ] Optimization opportunities identified and documented
- [ ] Performance report created with metrics and recommendations

## Technical Context
- Tools: Artillery for load testing, Node.js profiler for memory
- Metrics: Response time (p50, p95, p99), throughput, error rate
- Scenarios: Login flow, wizard access, dashboard access, multi-tenant operations

## Performance Tests
1. **Baseline Measurement** (before refactor)
   - Auth middleware execution time
   - Full request cycle time
   - Memory consumption

2. **Refactored Measurement** (after refactor)
   - Same metrics as baseline
   - Compare and analyze differences

3. **Load Testing**
   - 100 concurrent users
   - Mix of auth, wizard, dashboard requests
   - Measure: throughput, latency, error rate

## Deliverables
- Performance test script (\`tests/performance/middleware-perf.test.ts\`)
- Load test configuration (Artillery config)
- Performance report (\`docs/performance/middleware-refactor-results.md\`)

## Verification
- [ ] No critical performance regressions
- [ ] Results documented and reviewed`,
    labels: ['phase-5-docs', 'testing', 'performance'],
    estimate: 16,
    priority: 4,
  },
  {
    title: 'Production Deployment & Monitoring Setup',
    description: `## Description
Deploy refactored middleware to production with proper monitoring, rollback plan, and observability.

## Acceptance Criteria
- [ ] Rollback plan documented (how to revert to old middleware)
- [ ] Feature flag created for gradual rollout (if applicable)
- [ ] Monitoring alerts configured for middleware errors
- [ ] Logging enhanced for middleware execution (auth, tenant, wizard events)
- [ ] Error tracking configured (Sentry/equivalent for middleware errors)
- [ ] Production smoke tests pass after deployment
- [ ] Runbook created for on-call engineers

## Technical Context
- Environment: Production (Vercel/equivalent)
- Monitoring: Vercel Analytics, Sentry, custom logging
- Rollback: Git revert + immediate redeploy

## Deployment Checklist
1. **Pre-Deployment**
   - [ ] All tests passing (unit, integration, e2e, security)
   - [ ] \`npm run verify:full\` passes
   - [ ] Performance benchmarks reviewed
   - [ ] Rollback plan reviewed and approved
   - [ ] Team notified of deployment window

2. **Deployment**
   - [ ] Deploy to staging first
   - [ ] Run smoke tests on staging
   - [ ] Deploy to production
   - [ ] Monitor for 30 minutes post-deployment

3. **Post-Deployment**
   - [ ] Verify no error spikes in monitoring
   - [ ] Check auth flow working
   - [ ] Check wizard flow working
   - [ ] Check multi-tenant operations working
   - [ ] Verify no redirect loop incidents

## Monitoring
- Alert on: 401/403 error rate spikes
- Alert on: Redirect loop detection (>3 redirects)
- Alert on: Middleware execution time >200ms (p95)
- Log: Auth events, tenant context resolution, wizard access attempts

## Rollback Triggers
- Auth failure rate >5%
- Redirect loop incidents >2
- Critical error rate >1%
- Response time degradation >50%

## Verification
- [ ] Deployment successful
- [ ] Monitoring showing healthy metrics
- [ ] No incidents reported`,
    labels: ['phase-5-docs', 'deployment', 'monitoring'],
    estimate: 10,
    priority: 2,
  },
];

// GraphQL queries and mutations
const getParentQuery = `
  query GetParent($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      team {
        id
        name
        key
        labels {
          nodes {
            id
            name
          }
        }
      }
    }
  }
`;

const createSubIssueMutation = `
  mutation CreateSubIssue(
    $teamId: String!
    $parentId: String!
    $title: String!
    $description: String
    $priority: Int
    $labelIds: [String!]
    $estimate: Int
  ) {
    issueCreate(input: {
      teamId: $teamId
      parentId: $parentId
      title: $title
      description: $description
      priority: $priority
      labelIds: $labelIds
      estimate: $estimate
    }) {
      success
      issue {
        id
        identifier
        title
        url
      }
    }
  }
`;

const createLabelMutation = `
  mutation CreateLabel($teamId: String!, $name: String!) {
    issueLabelCreate(input: {
      teamId: $teamId
      name: $name
    }) {
      success
      issueLabel {
        id
        name
      }
    }
  }
`;

async function makeLinearRequest(query, variables) {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': LINEAR_API_KEY,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await response.json();

  if (data.errors) {
    throw new Error(data.errors[0].message);
  }

  return data.data;
}

async function createAllTasks() {
  try {
    console.log(`\n${'='.repeat(80)}`);
    console.log('Creating Sprint Tasks for CAM-129: Middleware Refactor');
    console.log(`${'='.repeat(80)}\n`);

    // Get parent issue
    console.log(`🔍 Fetching parent issue ${PARENT_ID}...`);
    const parentData = await makeLinearRequest(getParentQuery, { id: PARENT_ID });
    const parent = parentData.issue;

    if (!parent) {
      console.error(`❌ Parent issue ${PARENT_ID} not found.`);
      process.exit(1);
    }

    console.log(`✅ Found parent: ${parent.identifier} - ${parent.title}`);
    console.log(`   Team: ${parent.team.name} (${parent.team.key})\n`);

    // Get existing labels
    const existingLabels = new Map(
      parent.team.labels.nodes.map(l => [l.name, l.id])
    );

    // Helper to get or create label
    async function getOrCreateLabel(labelName) {
      if (existingLabels.has(labelName)) {
        return existingLabels.get(labelName);
      }

      console.log(`  - Creating label: "${labelName}"`);
      const createResult = await makeLinearRequest(createLabelMutation, {
        teamId: parent.team.id,
        name: labelName,
      });

      if (createResult.issueLabelCreate.success) {
        const labelId = createResult.issueLabelCreate.issueLabel.id;
        existingLabels.set(labelName, labelId);
        return labelId;
      } else {
        console.warn(`  ⚠️  Failed to create label: "${labelName}"`);
        return null;
      }
    }

    // Create all tasks
    const createdIssues = [];
    let totalEstimate = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      console.log(`\n[${ i + 1}/${tasks.length}] Creating: ${task.title}`);

      // Get or create labels for this task
      const labelIds = [];
      for (const labelName of task.labels) {
        const labelId = await getOrCreateLabel(labelName);
        if (labelId) {
          labelIds.push(labelId);
        }
      }

      // Create the issue
      const createResult = await makeLinearRequest(createSubIssueMutation, {
        teamId: parent.team.id,
        parentId: parent.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        labelIds,
        estimate: task.estimate,
      });

      if (createResult.issueCreate.success) {
        const issue = createResult.issueCreate.issue;
        console.log(`✅ Created: ${issue.identifier} - ${task.title}`);
        console.log(`   Estimate: ${task.estimate}h | Priority: ${task.priority} | Labels: ${task.labels.join(', ')}`);
        console.log(`   URL: ${issue.url}`);

        createdIssues.push({
          identifier: issue.identifier,
          title: task.title,
          estimate: task.estimate,
          url: issue.url,
        });

        totalEstimate += task.estimate;
      } else {
        console.error(`❌ Failed to create: ${task.title}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Summary
    console.log(`\n${'='.repeat(80)}`);
    console.log('SPRINT SETUP COMPLETE');
    console.log(`${'='.repeat(80)}\n`);
    console.log(`Parent Issue: ${parent.identifier} - ${parent.title}`);
    console.log(`Tasks Created: ${createdIssues.length}/${tasks.length}`);
    console.log(`Total Estimate: ${totalEstimate} hours (~${Math.ceil(totalEstimate / 8)} days)`);
    console.log(`\nCreated Issues:`);
    createdIssues.forEach((issue, idx) => {
      console.log(`  ${idx + 1}. ${issue.identifier}: ${issue.title} (${issue.estimate}h)`);
    });

    console.log(`\n✅ All tasks created successfully!`);
    console.log(`\nNext Steps:`);
    console.log(`1. Review tasks in Linear: https://linear.app/issue/${PARENT_ID}`);
    console.log(`2. Update parent CAM-129 with "in-sprint" label`);
    console.log(`3. Assign tasks to team members`);
    console.log(`4. Begin Phase 1: Analysis & Planning\n`);

  } catch (error) {
    console.error('❌ Error creating tasks:', error.message);
    process.exit(1);
  }
}

createAllTasks();

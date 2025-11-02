## Summary
<!-- Provide a concise description of the changes in this PR -->

## Related Issues
<!-- Link to related issues using "Closes #123" or "Relates to #456" -->
Closes #

## Type of Change
<!-- Check all that apply -->
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Enhancement (improvement to existing feature)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Security fix

## Changes Made
<!-- List the main changes in bullet points -->
-
-
-

## Testing Performed
<!-- Describe the testing you performed to verify your changes -->

### Manual Testing
- [ ] Tested locally in development environment
- [ ] Tested on mobile devices (if UI changes)
- [ ] Tested offline functionality (if applicable)
- [ ] Tested with multiple user roles (if auth-related)

### Automated Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] All tests passing (`npm run test:ci`)

### Pre-Deployment Checklist
- [ ] `npm run type-check` passes
- [ ] `npm run lint` passes
- [ ] `npm run verify:startup` passes (for API changes)
- [ ] No console errors in browser (for UI changes)

## Multi-Tenant Considerations
<!-- If this PR touches multi-tenant features, answer these questions -->
- [ ] N/A - Does not involve tenant data
- [ ] Verified tenant isolation (data leakage tests included)
- [ ] RLS policies updated/validated
- [ ] Tenant context properly validated in all queries

## Security Considerations
<!-- Consider security implications of your changes -->
- [ ] No sensitive data exposed in logs or error messages
- [ ] Input validation implemented
- [ ] SQL injection prevention verified (parameterized queries)
- [ ] XSS prevention verified (proper escaping)
- [ ] Authentication/authorization properly enforced

## Performance Impact
<!-- Assess performance implications -->
- [ ] No performance impact
- [ ] Performance improved
- [ ] Performance impact assessed and acceptable
- [ ] Database queries optimized
- [ ] Caching strategy considered

## Database Changes
<!-- If database schema changes are included -->
- [ ] N/A - No database changes
- [ ] Migration scripts included
- [ ] Migration tested on development database
- [ ] Rollback plan documented
- [ ] Type generation updated (`npm run db:generate-types`)

## Breaking Changes
<!-- If this is a breaking change, describe the impact and migration path -->

## Screenshots/Videos
<!-- If applicable, add screenshots or videos demonstrating the changes -->

## Deployment Notes
<!-- Any special instructions for deployment? -->
- [ ] Requires environment variable changes
- [ ] Requires database migration
- [ ] Requires third-party service configuration
- [ ] Requires cache invalidation

## Reviewer Checklist
<!-- For reviewers to verify -->
- [ ] Code follows CLAUDE.md best practices
- [ ] Tests are comprehensive and meaningful
- [ ] Documentation updated (if needed)
- [ ] No unnecessary console.log or debug code
- [ ] Error handling is appropriate
- [ ] Code is readable and well-structured

## Post-Merge Tasks
<!-- Any follow-up tasks after merging? -->
- [ ] Update project documentation
- [ ] Notify team of changes
- [ ] Schedule demo/walkthrough
- [ ] Create follow-up issues for tech debt

# Modular Monolith Refactoring Guide

This is a controlled refactoring environment for migrating Camp-OS to a modular monolith architecture.

## Environment Setup

### Two Parallel Workspaces

1. **Main Development** (Original): `/Users/willstaten/Projects/Camp-OS`
   - Branch: `develop`
   - Purpose: Ongoing feature development and bug fixes
   - Stable, production-ready code

2. **Refactoring Lab** (This workspace): `/Users/willstaten/Projects/Camp-OS-refactor`
   - Branch: `refactor/modular-monolith`
   - Purpose: Architectural refactoring and experimentation
   - Safe sandbox for structural changes

## Workflow

### Daily Development Pattern

```bash
# Work on features in main workspace
cd ~/Projects/Camp-OS
# ... normal development on develop branch ...

# Work on refactoring in parallel
cd ~/Projects/Camp-OS-refactor
# ... architectural improvements on refactor/modular-monolith branch ...
```

### Syncing with Develop

Keep your refactoring branch up to date with ongoing development:

```bash
cd ~/Projects/Camp-OS-refactor
git fetch origin
git merge origin/develop
# Resolve any conflicts
npm install  # Update dependencies if needed
```

### Merging Refactored Code Back

When a refactored module is ready and tested:

```bash
# Option 1: Small, incremental merges (recommended)
cd ~/Projects/Camp-OS
git checkout develop
git checkout refactor/modular-monolith -- path/to/refactored/module
git add path/to/refactored/module
git commit -m "refactor: migrate X to modular structure"

# Option 2: Feature-flagged merge for larger changes
# (Implement feature flags to toggle between old/new implementations)
```

## Refactoring Principles

### 1. Incremental Migration
- Refactor one module at a time
- Keep both old and new code running in parallel initially
- Use feature flags for gradual rollout

### 2. Testing First
- Ensure existing tests pass before refactoring
- Add tests for new modular structure
- Maintain backwards compatibility during transition

### 3. Documentation
- Document architectural decisions
- Update this guide as patterns emerge
- Track migration progress

### 4. Zero Regression
- All existing functionality must continue to work
- Performance should not degrade
- API contracts must remain stable

## Modular Monolith Structure

Target architecture (adapt as needed):

```
src/
├── modules/
│   ├── reservations/
│   │   ├── domain/          # Business logic
│   │   ├── application/     # Use cases
│   │   ├── infrastructure/  # DB, external services
│   │   └── presentation/    # API routes, UI
│   ├── properties/
│   ├── users/
│   └── billing/
├── shared/
│   ├── kernel/             # Shared domain
│   ├── infrastructure/     # Shared infrastructure
│   └── utils/              # Utilities
└── core/
    ├── config/
    └── types/
```

## Git Worktree Management

### List all worktrees
```bash
git worktree list
```

### Remove worktree when done
```bash
git worktree remove Camp-OS-refactor
# Or from main workspace:
cd ~/Projects/Camp-OS
git worktree remove ../Camp-OS-refactor
```

### Create additional worktrees for specific experiments
```bash
git worktree add ../Camp-OS-experiment feature/specific-experiment
```

## Tips

- **Separate terminals**: Use different terminal windows/tabs for each workspace
- **IDE instances**: Consider opening separate IDE windows for each workspace
- **Environment isolation**: Each worktree can have its own `.env.local` file
- **Database**: Consider using different database instances for testing refactored code
- **Port conflicts**: Use different ports in each workspace if running dev servers simultaneously

## Progress Tracking

Track your refactoring progress here:

### Modules to Migrate
- [ ] Reservations module
- [ ] Properties module
- [ ] Users/Auth module
- [ ] Billing module
- [ ] Configuration system
- [ ] Reporting/Analytics

### Completed Migrations
- None yet

## Notes

Add your observations and lessons learned as you refactor:

---

**Created**: 2025-11-05
**Branch**: refactor/modular-monolith
**Base**: develop (0ae98f7)

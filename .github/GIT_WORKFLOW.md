# Git Workflow & Branching Strategy

## Branch Structure

```
develop (development) → stage (staging) → main (production)
```

### Branch Purposes

- **`develop`**: Active development branch
  - All feature branches merge here first
  - Continuous integration and testing
  - May be unstable

- **`stage`**: Staging/pre-production branch
  - Reflects what will be deployed to production
  - Final testing and QA
  - Should be relatively stable

- **`main`**: Production branch
  - Production-ready code only
  - Always stable and deployable
  - Protected branch

## Workflow

### 1. Feature Development

```bash
# Create feature branch from develop
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# Work on your feature
# ... make changes ...

# Commit your changes
git add .
git commit -m "feat: add your feature description"

# Push feature branch
git push origin feature/your-feature-name
```

### 2. Merge to Develop

```bash
# Create PR: feature/your-feature-name → develop
# After approval, merge via GitHub/GitLab

# Or locally:
git checkout develop
git pull origin develop
git merge feature/your-feature-name
git push origin develop
```

### 3. Promote to Stage

```bash
# When develop is ready for staging testing
git checkout stage
git pull origin stage
git merge develop
git push origin stage

# This triggers deployment to Sevalla staging environment
```

### 4. Promote to Production

```bash
# When stage is tested and ready for production
git checkout main
git pull origin main
git merge stage
git push origin main

# This triggers deployment to Sevalla production environment
```

## Deployment Environments

| Branch   | Environment      | Sevalla URL                  | Purpose                |
|----------|------------------|------------------------------|------------------------|
| develop  | Development      | dev.campops.example.com      | Active development     |
| stage    | Staging          | stage.campops.example.com    | Pre-production testing |
| main     | Production       | campops.example.com          | Live production        |

## Rules & Best Practices

### ✅ DO

- Always create feature branches from `develop`
- Test thoroughly in `develop` before promoting to `stage`
- Keep commits atomic and well-described
- Use conventional commits format (feat, fix, chore, etc.)
- Run `npm run check` before committing
- Pull before pushing to avoid conflicts

### ❌ DON'T

- **Never** push directly to `stage` or `main` (except for critical hotfixes)
- **Never** merge `stage` → `develop` (flow is one direction only)
- **Never** force push to shared branches
- **Never** commit directly to `main`

## Hotfix Workflow

For critical production bugs:

```bash
# Create hotfix from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug-fix

# Fix the bug
# ... make changes ...

# Commit and push
git commit -m "fix: critical bug description"
git push origin hotfix/critical-bug-fix

# Merge to main (via PR)
git checkout main
git merge hotfix/critical-bug-fix
git push origin main

# Back-merge to stage and develop
git checkout stage
git merge main
git push origin stage

git checkout develop
git merge stage
git push origin develop
```

## Emergency: Branches Out of Sync?

If you accidentally pushed to the wrong branch:

```bash
# If you pushed to stage instead of develop:
git checkout develop
git pull origin develop
git merge stage
git push origin develop

# If you pushed to main instead of stage:
git checkout stage
git pull origin stage
git merge main
git push origin stage

git checkout develop
git merge stage
git push origin develop
```

## CI/CD Integration

Each branch should have its own deployment configuration in Sevalla:

1. **Develop**: Auto-deploy on push to `develop`
2. **Stage**: Auto-deploy on push to `stage`
3. **Main**: Manual approval for production deployment

## Questions?

- Check the repo's CLAUDE.md for coding standards
- Review existing PRs for examples
- Ask team lead if unsure about merging strategy

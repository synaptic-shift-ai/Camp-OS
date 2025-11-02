# Linear ↔ GitHub Sync Guide

This guide explains how to set up and maintain bidirectional sync between Linear and GitHub for the CampOps project.

---

## Quick Start

### 1. Enable GitHub Integration in Linear

1. **Go to Linear Settings**
   - Click your workspace icon (bottom left)
   - Go to **Settings** → **Integrations**
   - Find **GitHub** integration

2. **Connect Repository**
   - Click **Add repository**
   - Select `SynapticShiftAI/Camp-OS`
   - Enable **bidirectional sync**

3. **Configure Sync Settings**
   - ✅ **Sync issue status** (Linear → GitHub)
   - ✅ **Sync PR status** (GitHub → Linear)
   - ✅ **Auto-attach PRs** to Linear issues
   - ✅ **Create GitHub issues** when Linear issue is created (optional)

### 2. Import Existing GitHub Issues to Linear

**Option A: Via Linear UI (Recommended)**
1. In Linear: **Settings** → **Integrations** → **GitHub**
2. Find `Camp-OS` repository
3. Click **"Sync existing issues"** or **"Import"**
4. Select which issues to import
5. Choose target Linear team/project
6. Click **Import**

**Option B: They Auto-Link on Next Interaction**
- When you reference a Linear issue in a GitHub PR/commit
- Linear automatically detects and links the GitHub issue
- Status syncs from that point forward

### 3. Export Linear Backlog to GitHub

**Using the Sync Script:**

```bash
# Get your Linear API key
# Visit: https://linear.app/settings/api

# Set environment variables
export LINEAR_API_KEY="lin_api_xxxxxxxxxxxxx"
export LINEAR_TEAM_ID="your-team-id"  # Optional: filter by team

# Run the sync script
node scripts/sync-linear-to-github.js
```

**What the script does:**
1. Fetches all active Linear issues
2. Creates corresponding GitHub issues
3. Links them via issue body reference
4. Applies appropriate labels
5. Linear auto-detects and links them

---

## Ongoing Workflow

### Creating New Issues

**From Linear (Recommended):**
1. Create issue in Linear
2. Linear automatically creates GitHub issue (if enabled)
3. Work on the issue using Linear

**From GitHub:**
1. Create issue using template
2. Linear auto-imports on next sync
3. Edit and manage in Linear

### Working with PRs

**Branch Naming (Auto-Links to Linear):**
```bash
git checkout -b feature/CAMP-123-add-smoke-tests
# Linear detects "CAMP-123" and auto-links the PR
```

**Commit Messages (Auto-Links to Linear):**
```bash
git commit -m "feat: add smoke test script

Implements comprehensive pre-commit validation.

CAMP-123"
```

**PR Description (Auto-Links to Linear):**
```markdown
## Summary
Adds smoke test script for pre-commit validation

Fixes CAMP-123
```

### Status Sync Behavior

| Action | Linear → GitHub | GitHub → Linear |
|--------|-----------------|-----------------|
| Create issue | ✅ Creates GitHub issue | ✅ Imports to Linear |
| Update status | ✅ Updates labels | ✅ Updates Linear state |
| Close issue | ✅ Closes GitHub issue | ✅ Marks Linear "Done" |
| Reopen issue | ✅ Reopens GitHub issue | ✅ Marks Linear "Todo" |
| Add comment | ❌ No sync | ❌ No sync |
| PR linked | ✅ Shows in Linear | ✅ Shows in GitHub |
| PR merged | ✅ Auto-closes Linear | ✅ Auto-closes GitHub |

---

## Label Mapping

Linear and GitHub labels should align:

| Linear Label | GitHub Label | Usage |
|--------------|--------------|-------|
| Priority: Urgent | `critical` | Immediate attention |
| Priority: High | `high-priority` | Important work |
| Type: Bug | `bug` | Something broken |
| Type: Feature | `feature` | New functionality |
| Type: Improvement | `enhancement` | Existing feature improvement |
| Area: Frontend | `frontend` | UI/React work |
| Area: Backend | `backend` | API/Server work |
| Sprint: Week 1 | `sprint-week-1` | Current sprint |

**Create matching labels in both systems for best sync.**

---

## Milestones vs Cycles

**Linear Cycles** (recommended) replace GitHub Milestones:

- Linear Cycles = Sprint iterations
- GitHub Milestones = Release milestones
- Use Cycles for sprint planning
- Use Milestones for version releases

---

## Troubleshooting

### Issue Not Syncing

**Check:**
1. GitHub integration enabled in Linear
2. Repository connected and authorized
3. Issue references Linear ID correctly (e.g., `CAMP-123`)
4. Sync settings enabled in Linear integration

**Force Sync:**
1. Edit the Linear issue (add/remove label)
2. Linear will push update to GitHub
3. Or edit GitHub issue to trigger sync

### Duplicate Issues Created

**Prevention:**
- Don't run sync script if Linear auto-create is enabled
- Check Linear settings: disable "Auto-create GitHub issues"
- Use script only for initial backlog import

**Fix:**
1. Close duplicates in GitHub
2. Keep the one linked in Linear
3. Update Linear issue to reference correct GitHub issue

### Labels Not Syncing

**Create matching labels:**
```bash
# Create GitHub labels that match Linear
gh label create "priority-urgent" --color "d73a4a"
gh label create "priority-high" --color "ff6b6b"
```

**In Linear:**
1. Settings → Labels
2. Create matching labels
3. Configure sync mapping

---

## Best Practices

### 1. Single Source of Truth
- **Use Linear** as primary project management tool
- **Use GitHub** for code review and technical discussion
- Let the integration keep them in sync

### 2. Meaningful References
Always reference Linear issues in:
- Branch names: `feature/CAMP-123-description`
- Commit messages: `feat: description (CAMP-123)`
- PR titles: `feat: description (CAMP-123)`

### 3. Consistent Labels
- Keep label names consistent between systems
- Use lowercase, hyphen-separated
- Align priority/type/area labels

### 4. Close Issues via PRs
```markdown
Fixes CAMP-123
Closes CAMP-456
Resolves CAMP-789
```
Linear auto-transitions to "Done" when PR merges.

### 5. Regular Sync Audits
Weekly check:
- Verify critical issues are linked
- Confirm status sync is working
- Close stale/duplicate issues

---

## API Keys & Security

### Get Linear API Key
1. Go to https://linear.app/settings/api
2. Click **"Create new key"**
3. Name: `GitHub Sync Script`
4. Copy the key (starts with `lin_api_`)

### Store Securely
```bash
# Add to .env.local (never commit!)
LINEAR_API_KEY=lin_api_xxxxxxxxxxxxx
LINEAR_TEAM_ID=your-team-id

# Load in scripts
source .env.local
```

### Add to .gitignore
```bash
echo ".env.local" >> .gitignore
```

---

## Quick Reference Commands

```bash
# List Linear team IDs
curl -X POST https://api.linear.app/graphql \
  -H "Authorization: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ teams { nodes { id name } } }"}'

# Sync Linear backlog to GitHub
node scripts/sync-linear-to-github.js

# List GitHub issues
gh issue list --limit 50

# Bulk close GitHub issues
gh issue list --state open --json number --jq '.[].number' | \
  xargs -I {} gh issue close {}

# View Linear issue from CLI
open "https://linear.app/issue/CAMP-123"
```

---

## Support

- **Linear Docs**: https://linear.app/docs/github
- **Linear API**: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
- **GitHub CLI**: https://cli.github.com/manual/

---

## Summary

1. ✅ Enable GitHub integration in Linear
2. ✅ Import existing GitHub issues to Linear (one-time)
3. ✅ Export Linear backlog to GitHub (optional, via script)
4. ✅ Use Linear for planning, GitHub for code
5. ✅ Reference Linear IDs in branches/commits/PRs
6. ✅ Let automation handle status syncing

Everything syncs bidirectionally once connected!

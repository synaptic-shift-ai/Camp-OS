#!/usr/bin/env node
/**
 * Sync Linear issues to GitHub Issues
 *
 * Prerequisites:
 * - LINEAR_API_KEY environment variable
 * - GitHub CLI (gh) authenticated
 *
 * Usage:
 *   node scripts/sync-linear-to-github.js
 */

const https = require('https');
const { execSync } = require('child_process');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const TEAM_ID = process.env.LINEAR_TEAM_ID; // Optional: filter by team

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY environment variable is required');
  console.error('Get your API key from: https://linear.app/settings/api');
  process.exit(1);
}

// GraphQL query to fetch Linear issues
const query = `
  query {
    issues(
      filter: {
        state: { type: { nin: ["completed", "canceled"] } }
        ${TEAM_ID ? `, team: { id: { eq: "${TEAM_ID}" } }` : ''}
      }
      first: 100
    ) {
      nodes {
        id
        identifier
        title
        description
        priority
        state {
          name
        }
        assignee {
          name
        }
        labels {
          nodes {
            name
          }
        }
        url
      }
    }
  }
`;

// Make Linear API request
function fetchLinearIssues() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ query });

    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(parsed.errors[0].message));
          } else {
            resolve(parsed.data.issues.nodes);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Map Linear priority to GitHub labels
function mapPriority(priority) {
  switch (priority) {
    case 1: return 'critical';
    case 2: return 'high-priority';
    case 3: return '';
    case 4: return '';
    default: return '';
  }
}

// Create GitHub issue from Linear issue
function createGitHubIssue(linearIssue) {
  const labels = [];

  // Add priority label
  const priorityLabel = mapPriority(linearIssue.priority);
  if (priorityLabel) labels.push(priorityLabel);

  // Add Linear labels
  linearIssue.labels.nodes.forEach(label => {
    labels.push(label.name.toLowerCase().replace(/\s+/g, '-'));
  });

  // Build issue body
  const body = `${linearIssue.description || 'No description provided.'}

---

**Linear Issue:** [${linearIssue.identifier}](${linearIssue.url})
**Status:** ${linearIssue.state.name}
${linearIssue.assignee ? `**Assignee:** ${linearIssue.assignee.name}` : ''}

_This issue was synced from Linear_`;

  // Escape single quotes in title and body for shell
  const title = linearIssue.title.replace(/'/g, "'\\''");
  const escapedBody = body.replace(/'/g, "'\\''");
  const labelArg = labels.length > 0 ? `--label "${labels.join(',')}"` : '';

  try {
    // Create GitHub issue
    const result = execSync(
      `gh issue create --title '${title}' --body '${escapedBody}' ${labelArg}`,
      { encoding: 'utf8' }
    );

    console.log(`✅ Created: ${linearIssue.identifier} → ${result.trim()}`);
    return result.trim();
  } catch (error) {
    console.error(`❌ Failed to create issue for ${linearIssue.identifier}:`, error.message);
    return null;
  }
}

// Main execution
async function main() {
  console.log('🔄 Fetching Linear issues...\n');

  try {
    const issues = await fetchLinearIssues();
    console.log(`Found ${issues.length} Linear issues to sync\n`);

    if (issues.length === 0) {
      console.log('No issues to sync. Exiting.');
      return;
    }

    // Confirm before creating
    console.log('Issues to be created in GitHub:');
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. [${issue.identifier}] ${issue.title}`);
    });

    console.log('\n⚠️  This will create GitHub issues for all Linear issues listed above.');
    console.log('Press Ctrl+C to cancel, or press Enter to continue...\n');

    // Wait for user confirmation (in non-interactive mode, skip this)
    if (process.stdin.isTTY) {
      await new Promise(resolve => {
        process.stdin.once('data', resolve);
      });
    }

    // Create GitHub issues
    console.log('\n📝 Creating GitHub issues...\n');
    const created = [];

    for (const issue of issues) {
      const url = createGitHubIssue(issue);
      if (url) created.push(url);

      // Rate limiting: wait 1 second between creates
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`\n✅ Successfully created ${created.length}/${issues.length} GitHub issues`);

    console.log('\n📋 Next steps:');
    console.log('1. Review created issues in GitHub');
    console.log('2. Linear should auto-detect and link these via GitHub integration');
    console.log('3. Future changes will sync bidirectionally');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

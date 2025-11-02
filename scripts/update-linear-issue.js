#!/usr/bin/env node
/**
 * Update Linear Issue - Add comments and update labels
 *
 * Usage:
 *   node scripts/update-linear-issue.js CAM-78 --comment "PRD completed" --remove-label "needs-prd" --add-label "ready-for-development"
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const ISSUE_ID = process.argv[2];

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY environment variable not set.');
  process.exit(1);
}

if (!ISSUE_ID) {
  console.error('ERROR: Issue ID required.');
  console.error('Usage: node scripts/update-linear-issue.js CAM-78 --comment "text" --remove-label "label" --add-label "label"');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(3);
let comment = null;
let removeLabels = [];
let addLabels = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--comment' && args[i + 1]) {
    comment = args[i + 1];
    i++;
  } else if (args[i] === '--remove-label' && args[i + 1]) {
    removeLabels.push(args[i + 1]);
    i++;
  } else if (args[i] === '--add-label' && args[i + 1]) {
    addLabels.push(args[i + 1]);
    i++;
  }
}

// Get issue details first
const getIssueQuery = `
  query GetIssue($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      labels {
        nodes {
          id
          name
        }
      }
    }
  }
`;

// Add comment mutation
const addCommentMutation = `
  mutation AddComment($issueId: String!, $body: String!) {
    commentCreate(input: {
      issueId: $issueId
      body: $body
    }) {
      success
      comment {
        id
        body
      }
    }
  }
`;

// Update labels mutation
const updateLabelsMutation = `
  mutation UpdateLabels($issueId: String!, $labelIds: [String!]!) {
    issueUpdate(id: $issueId, input: {
      labelIds: $labelIds
    }) {
      success
      issue {
        id
        labels {
          nodes {
            name
          }
        }
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

async function updateIssue() {
  try {
    console.log(`\n🔄 Updating Linear issue ${ISSUE_ID}...`);

    // Get current issue details
    const issueData = await makeLinearRequest(getIssueQuery, { id: ISSUE_ID });
    const issue = issueData.issue;

    if (!issue) {
      console.error(`❌ Issue ${ISSUE_ID} not found.`);
      process.exit(1);
    }

    console.log(`\n📋 Issue: ${issue.identifier} - ${issue.title}`);
    console.log(`Current labels: ${issue.labels.nodes.map(l => l.name).join(', ') || 'None'}`);

    // Add comment if specified
    if (comment) {
      console.log(`\n💬 Adding comment...`);
      const commentResult = await makeLinearRequest(addCommentMutation, {
        issueId: issue.id,
        body: comment,
      });

      if (commentResult.commentCreate.success) {
        console.log(`✅ Comment added successfully`);
      } else {
        console.log(`❌ Failed to add comment`);
      }
    }

    // Update labels if specified
    if (removeLabels.length > 0 || addLabels.length > 0) {
      console.log(`\n🏷️  Updating labels...`);

      // Get current label IDs
      let currentLabelIds = issue.labels.nodes.map(l => l.id);
      const currentLabelNames = issue.labels.nodes.map(l => l.name);

      // Remove specified labels
      if (removeLabels.length > 0) {
        const labelsToRemove = issue.labels.nodes.filter(l =>
          removeLabels.includes(l.name)
        );
        labelsToRemove.forEach(label => {
          console.log(`  - Removing label: "${label.name}"`);
          currentLabelIds = currentLabelIds.filter(id => id !== label.id);
        });
      }

      // Note: Adding new labels requires fetching available labels first
      // For now, we'll just handle removal
      // TODO: Implement label creation/lookup for adding labels

      if (addLabels.length > 0) {
        console.log(`\n⚠️  Note: Adding labels requires label IDs. Skipping label additions.`);
        console.log(`   Labels to add manually: ${addLabels.join(', ')}`);
      }

      // Update issue with new label set
      const updateResult = await makeLinearRequest(updateLabelsMutation, {
        issueId: issue.id,
        labelIds: currentLabelIds,
      });

      if (updateResult.issueUpdate.success) {
        const newLabels = updateResult.issueUpdate.issue.labels.nodes.map(l => l.name);
        console.log(`✅ Labels updated successfully`);
        console.log(`   New labels: ${newLabels.join(', ') || 'None'}`);
      } else {
        console.log(`❌ Failed to update labels`);
      }
    }

    console.log(`\n✅ Issue ${ISSUE_ID} updated successfully!\n`);
    console.log(`View issue: https://linear.app/issue/${ISSUE_ID}`);

  } catch (error) {
    console.error('❌ Error updating issue:', error.message);
    process.exit(1);
  }
}

updateIssue();

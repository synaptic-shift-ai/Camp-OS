#!/usr/bin/env node
/**
 * Remove label from Linear issue
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const ISSUE_ID = process.argv[2];
const LABEL_NAME = process.argv[3];

if (!LINEAR_API_KEY || !ISSUE_ID || !LABEL_NAME) {
  console.error('Usage: node scripts/remove-linear-label.js CAM-129 "needs-prd"');
  process.exit(1);
}

// Get issue and labels
const getIssueAndLabelsQuery = `
  query GetIssueAndLabels($issueId: String!) {
    issue(id: $issueId) {
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

async function removeLabel() {
  try {
    console.log(`\n🔍 Fetching issue ${ISSUE_ID}...`);

    // Get issue and labels
    const data = await makeLinearRequest(getIssueAndLabelsQuery, { issueId: ISSUE_ID });
    const issue = data.issue;

    if (!issue) {
      console.error(`❌ Issue ${ISSUE_ID} not found.`);
      process.exit(1);
    }

    console.log(`📋 Issue: ${issue.identifier} - ${issue.title}`);
    console.log(`Current labels: ${issue.labels.nodes.map(l => l.name).join(', ') || 'None'}`);

    // Find the label to remove
    const labelToRemove = issue.labels.nodes.find(l => l.name === LABEL_NAME);

    if (!labelToRemove) {
      console.log(`\n✅ Label "${LABEL_NAME}" is not applied to this issue`);
      return;
    }

    // Remove the label from the current list
    const newLabelIds = issue.labels.nodes
      .filter(l => l.id !== labelToRemove.id)
      .map(l => l.id);

    console.log(`\n🗑️  Removing label "${LABEL_NAME}"...`);

    // Update issue with new labels
    const updateResult = await makeLinearRequest(updateLabelsMutation, {
      issueId: issue.id,
      labelIds: newLabelIds,
    });

    if (updateResult.issueUpdate.success) {
      const finalLabels = updateResult.issueUpdate.issue.labels.nodes.map(l => l.name);
      console.log(`✅ Label removed successfully`);
      console.log(`New labels: ${finalLabels.join(', ') || 'None'}`);
    } else {
      console.error(`❌ Failed to remove label`);
    }

    console.log(`\n✅ Done!\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

removeLabel();

#!/usr/bin/env node
/**
 * Add label to Linear issue
 * First fetches available labels, then adds the specified label
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const ISSUE_ID = process.argv[2];
const LABEL_NAME = process.argv[3];

if (!LINEAR_API_KEY || !ISSUE_ID || !LABEL_NAME) {
  console.error('Usage: node scripts/add-linear-label.js CAM-78 "needs-validation"');
  process.exit(1);
}

// Get issue and all labels
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
      team {
        id
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

// Create label if it doesn't exist
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

async function addLabel() {
  try {
    console.log(`\n🔍 Fetching issue ${ISSUE_ID} and available labels...`);

    // Get issue and available labels
    const data = await makeLinearRequest(getIssueAndLabelsQuery, { issueId: ISSUE_ID });
    const issue = data.issue;

    if (!issue) {
      console.error(`❌ Issue ${ISSUE_ID} not found.`);
      process.exit(1);
    }

    console.log(`📋 Issue: ${issue.identifier} - ${issue.title}`);
    console.log(`Current labels: ${issue.labels.nodes.map(l => l.name).join(', ') || 'None'}`);

    // Find the label in team labels
    let targetLabel = issue.team.labels.nodes.find(l => l.name === LABEL_NAME);

    // If label doesn't exist, create it
    if (!targetLabel) {
      console.log(`\n🏷️  Label "${LABEL_NAME}" doesn't exist. Creating it...`);
      const createResult = await makeLinearRequest(createLabelMutation, {
        teamId: issue.team.id,
        name: LABEL_NAME,
      });

      if (createResult.issueLabelCreate.success) {
        targetLabel = createResult.issueLabelCreate.issueLabel;
        console.log(`✅ Label "${LABEL_NAME}" created`);
      } else {
        console.error(`❌ Failed to create label`);
        process.exit(1);
      }
    }

    // Get current label IDs and add the new one
    const currentLabelIds = issue.labels.nodes.map(l => l.id);

    // Check if label is already applied
    if (currentLabelIds.includes(targetLabel.id)) {
      console.log(`\n✅ Label "${LABEL_NAME}" is already applied to this issue`);
      return;
    }

    const newLabelIds = [...currentLabelIds, targetLabel.id];

    console.log(`\n🏷️  Adding label "${LABEL_NAME}"...`);

    // Update issue with new labels
    const updateResult = await makeLinearRequest(updateLabelsMutation, {
      issueId: issue.id,
      labelIds: newLabelIds,
    });

    if (updateResult.issueUpdate.success) {
      const finalLabels = updateResult.issueUpdate.issue.labels.nodes.map(l => l.name);
      console.log(`✅ Label added successfully`);
      console.log(`New labels: ${finalLabels.join(', ')}`);
    } else {
      console.error(`❌ Failed to add label`);
    }

    console.log(`\n✅ Done!\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addLabel();

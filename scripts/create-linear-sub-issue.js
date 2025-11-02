#!/usr/bin/env node
/**
 * Create Linear Sub-Issue (linked to parent)
 *
 * Usage:
 *   node scripts/create-linear-sub-issue.js --parent "CAM-129" --title "Task title" --description "Description" --labels "phase-1,backend" --estimate 8
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY environment variable not set.');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
let parentId = null;
let title = null;
let description = null;
let labels = [];
let estimate = null;
let priority = 0; // Default: No priority

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--parent' && args[i + 1]) {
    parentId = args[i + 1];
    i++;
  } else if (args[i] === '--title' && args[i + 1]) {
    title = args[i + 1];
    i++;
  } else if (args[i] === '--description' && args[i + 1]) {
    description = args[i + 1];
    i++;
  } else if (args[i] === '--labels' && args[i + 1]) {
    labels = args[i + 1].split(',').map(l => l.trim());
    i++;
  } else if (args[i] === '--estimate' && args[i + 1]) {
    estimate = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--priority' && args[i + 1]) {
    priority = parseInt(args[i + 1]);
    i++;
  }
}

if (!parentId || !title) {
  console.error('ERROR: --parent and --title are required.');
  console.error('Usage: node scripts/create-linear-sub-issue.js --parent "CAM-129" --title "Task title" --description "Description" --labels "phase-1,backend" --estimate 8');
  process.exit(1);
}

// Get parent issue
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

// Create sub-issue mutation
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

// Create label if needed
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

async function createSubIssue() {
  try {
    console.log(`\n🔍 Looking up parent issue ${parentId}...`);

    // Get parent issue
    const parentData = await makeLinearRequest(getParentQuery, { id: parentId });
    const parent = parentData.issue;

    if (!parent) {
      console.error(`❌ Parent issue ${parentId} not found.`);
      process.exit(1);
    }

    console.log(`✅ Found parent: ${parent.identifier} - ${parent.title}`);
    console.log(`   Team: ${parent.team.name} (${parent.team.key})`);

    // Get or create labels
    let labelIds = [];
    if (labels.length > 0) {
      console.log(`\n🏷️  Processing labels: ${labels.join(', ')}`);

      const existingLabels = parent.team.labels.nodes;

      for (const labelName of labels) {
        let label = existingLabels.find(l => l.name === labelName);

        if (!label) {
          console.log(`  - Creating label: "${labelName}"`);
          const createResult = await makeLinearRequest(createLabelMutation, {
            teamId: parent.team.id,
            name: labelName,
          });

          if (createResult.issueLabelCreate.success) {
            label = createResult.issueLabelCreate.issueLabel;
          } else {
            console.warn(`  ⚠️  Failed to create label: "${labelName}"`);
            continue;
          }
        } else {
          console.log(`  - Found existing label: "${labelName}"`);
        }

        labelIds.push(label.id);
      }
    }

    console.log(`\n📝 Creating sub-issue...`);
    console.log(`Title: ${title}`);
    if (description) console.log(`Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`);
    if (estimate) console.log(`Estimate: ${estimate} hours`);
    console.log(`Priority: ${priority} (0=None, 1=Urgent, 2=High, 3=Medium, 4=Low)`);

    // Create sub-issue
    const createResult = await makeLinearRequest(createSubIssueMutation, {
      teamId: parent.team.id,
      parentId: parent.id,
      title,
      description: description || '',
      priority,
      labelIds,
      estimate: estimate || null,
    });

    if (createResult.issueCreate.success) {
      const issue = createResult.issueCreate.issue;
      console.log(`\n✅ Sub-issue created successfully!`);
      console.log(`\nIssue: ${issue.identifier} - ${issue.title}`);
      console.log(`Parent: ${parent.identifier}`);
      console.log(`URL: ${issue.url}`);
      console.log('');

      return issue;
    } else {
      console.error(`❌ Failed to create sub-issue`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error creating sub-issue:', error.message);
    process.exit(1);
  }
}

createSubIssue();

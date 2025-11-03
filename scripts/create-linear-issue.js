#!/usr/bin/env node
/**
 * Create Linear Issue
 *
 * Usage:
 *   node scripts/create-linear-issue.js --title "Issue title" --description "Issue description" --team "CAM" --priority 2 --labels "bug,ui"
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY environment variable not set.');
  process.exit(1);
}

// Parse arguments
const args = process.argv.slice(2);
let title = null;
let description = null;
let teamKey = 'CAM'; // Default team
let priority = 0; // Default priority (0 = No priority, 1 = Urgent, 2 = High, 3 = Medium, 4 = Low)
let labels = [];

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--title' && args[i + 1]) {
    title = args[i + 1];
    i++;
  } else if (args[i] === '--description' && args[i + 1]) {
    description = args[i + 1];
    i++;
  } else if (args[i] === '--team' && args[i + 1]) {
    teamKey = args[i + 1];
    i++;
  } else if (args[i] === '--priority' && args[i + 1]) {
    priority = parseInt(args[i + 1]);
    i++;
  } else if (args[i] === '--labels' && args[i + 1]) {
    labels = args[i + 1].split(',').map(l => l.trim());
    i++;
  }
}

if (!title) {
  console.error('ERROR: --title is required.');
  console.error('Usage: node scripts/create-linear-issue.js --title "Issue title" --description "Description" --team "CAM" --priority 2 --labels "bug,ui"');
  process.exit(1);
}

// Get all teams and find by key
const getTeamsQuery = `
  query GetTeams {
    teams {
      nodes {
        id
        name
        key
      }
    }
  }
`;

// Create issue mutation
const createIssueMutation = `
  mutation CreateIssue($teamId: String!, $title: String!, $description: String, $priority: Int, $labelIds: [String!]) {
    issueCreate(input: {
      teamId: $teamId
      title: $title
      description: $description
      priority: $priority
      labelIds: $labelIds
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

// Get or create label
const getTeamLabelsQuery = `
  query GetTeamLabels($teamId: String!) {
    team(id: $teamId) {
      labels {
        nodes {
          id
          name
        }
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

async function createIssue() {
  try {
    console.log(`\n🔍 Looking up team "${teamKey}"...`);

    // Get all teams and find by key
    const teamsData = await makeLinearRequest(getTeamsQuery, {});
    const team = teamsData.teams.nodes.find(t => t.key === teamKey);

    if (!team) {
      console.error(`❌ Team "${teamKey}" not found.`);
      console.error(`Available teams: ${teamsData.teams.nodes.map(t => t.key).join(', ')}`);
      process.exit(1);
    }

    console.log(`✅ Found team: ${team.name} (${team.key})`);

    // Get or create labels
    let labelIds = [];
    if (labels.length > 0) {
      console.log(`\n🏷️  Processing labels: ${labels.join(', ')}`);

      const labelsData = await makeLinearRequest(getTeamLabelsQuery, { teamId: team.id });
      const existingLabels = labelsData.team.labels.nodes;

      for (const labelName of labels) {
        let label = existingLabels.find(l => l.name === labelName);

        if (!label) {
          console.log(`  - Creating label: "${labelName}"`);
          const createResult = await makeLinearRequest(createLabelMutation, {
            teamId: team.id,
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

    console.log(`\n📝 Creating issue...`);
    console.log(`Title: ${title}`);
    if (description) console.log(`Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`);
    console.log(`Priority: ${priority} (0=None, 1=Urgent, 2=High, 3=Medium, 4=Low)`);

    // Create issue
    const createResult = await makeLinearRequest(createIssueMutation, {
      teamId: team.id,
      title,
      description: description || '',
      priority,
      labelIds,
    });

    if (createResult.issueCreate.success) {
      const issue = createResult.issueCreate.issue;
      console.log(`\n✅ Issue created successfully!`);
      console.log(`\nIssue: ${issue.identifier} - ${issue.title}`);
      console.log(`URL: ${issue.url}`);
      console.log('');

      return issue;
    } else {
      console.error(`❌ Failed to create issue`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error creating issue:', error.message);
    process.exit(1);
  }
}

createIssue();

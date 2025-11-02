#!/usr/bin/env node
/**
 * Create Linear Epic (Parent Issue)
 *
 * Usage:
 *   node scripts/create-linear-epic.js --title "Epic title" --description "Epic description" --team "CAM" --children "CAM-129,CAM-130"
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
let childIssueIds = [];

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
  } else if (args[i] === '--children' && args[i + 1]) {
    childIssueIds = args[i + 1].split(',').map(id => id.trim());
    i++;
  }
}

if (!title) {
  console.error('ERROR: --title is required.');
  console.error('Usage: node scripts/create-linear-epic.js --title "Epic title" --description "Description" --team "CAM" --children "CAM-129,CAM-130"');
  process.exit(1);
}

// Get all teams
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

// Create epic mutation
const createIssueMutation = `
  mutation CreateIssue($teamId: String!, $title: String!, $description: String) {
    issueCreate(input: {
      teamId: $teamId
      title: $title
      description: $description
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

// Update issue to set parent
const updateIssueParentMutation = `
  mutation UpdateIssueParent($issueId: String!, $parentId: String!) {
    issueUpdate(id: $issueId, input: {
      parentId: $parentId
    }) {
      success
      issue {
        id
        identifier
        parent {
          identifier
          title
        }
      }
    }
  }
`;

// Get issue by identifier
const getIssueQuery = `
  query GetIssue($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
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

async function createEpic() {
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

    console.log(`\n📝 Creating epic...`);
    console.log(`Title: ${title}`);
    if (description) console.log(`Description: ${description.substring(0, 100)}${description.length > 100 ? '...' : ''}`);

    // Create epic (parent issue)
    const createResult = await makeLinearRequest(createIssueMutation, {
      teamId: team.id,
      title,
      description: description || '',
    });

    if (!createResult.issueCreate.success) {
      console.error(`❌ Failed to create epic`);
      process.exit(1);
    }

    const epic = createResult.issueCreate.issue;
    console.log(`\n✅ Epic created successfully!`);
    console.log(`\nEpic: ${epic.identifier} - ${epic.title}`);
    console.log(`URL: ${epic.url}`);

    // Link child issues if provided
    if (childIssueIds.length > 0) {
      console.log(`\n🔗 Linking child issues...`);

      for (const childId of childIssueIds) {
        try {
          // Get child issue
          const childData = await makeLinearRequest(getIssueQuery, { id: childId });
          const childIssue = childData.issue;

          if (!childIssue) {
            console.warn(`  ⚠️  Issue ${childId} not found, skipping`);
            continue;
          }

          console.log(`  - Linking ${childIssue.identifier}: ${childIssue.title}`);

          // Update child to set parent
          const updateResult = await makeLinearRequest(updateIssueParentMutation, {
            issueId: childIssue.id,
            parentId: epic.id,
          });

          if (updateResult.issueUpdate.success) {
            console.log(`    ✅ Linked successfully`);
          } else {
            console.warn(`    ⚠️  Failed to link`);
          }
        } catch (error) {
          console.warn(`  ⚠️  Error linking ${childId}: ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Done!\n`);
    console.log(`Epic: ${epic.identifier}`);
    console.log(`URL: ${epic.url}`);
    console.log('');

    return epic;

  } catch (error) {
    console.error('❌ Error creating epic:', error.message);
    process.exit(1);
  }
}

createEpic();

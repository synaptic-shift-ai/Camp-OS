#!/usr/bin/env node
/**
 * Update Linear Issue State
 *
 * Usage:
 *   node scripts/update-issue-state.js CAM-135 "Done"
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const ISSUE_ID = process.argv[2];
const STATE_NAME = process.argv[3];

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY environment variable not set.');
  process.exit(1);
}

if (!ISSUE_ID || !STATE_NAME) {
  console.error('ERROR: Issue ID and state name required.');
  console.error('Usage: node scripts/update-issue-state.js CAM-135 "Done"');
  process.exit(1);
}

// Query to get team workflow states
const getTeamStatesQuery = `
  query GetTeam {
    teams {
      nodes {
        id
        name
        states {
          nodes {
            id
            name
            type
          }
        }
      }
    }
  }
`;

// Query to get issue
const getIssueQuery = `
  query GetIssue($id: String!) {
    issue(id: $id) {
      id
      identifier
      title
      team {
        id
        name
      }
    }
  }
`;

// Mutation to update issue state
const updateStateMutation = `
  mutation UpdateIssueState($issueId: String!, $stateId: String!) {
    issueUpdate(id: $issueId, input: {
      stateId: $stateId
    }) {
      success
      issue {
        id
        state {
          name
          type
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

async function updateIssueState() {
  try {
    console.log(`\n🔍 Fetching issue ${ISSUE_ID}...`);

    // Get issue to find its team
    const issueData = await makeLinearRequest(getIssueQuery, { id: ISSUE_ID });
    const issue = issueData.issue;

    if (!issue) {
      console.error(`❌ Issue ${ISSUE_ID} not found.`);
      process.exit(1);
    }

    console.log(`📋 Issue: ${issue.identifier} - ${issue.title}`);
    console.log(`Team: ${issue.team.name}`);

    // Get all teams and their states
    console.log(`\n🔍 Finding state "${STATE_NAME}"...`);
    const teamsData = await makeLinearRequest(getTeamStatesQuery, {});

    // Find the team's states
    const team = teamsData.teams.nodes.find(t => t.id === issue.team.id);
    if (!team) {
      console.error(`❌ Could not find team states`);
      process.exit(1);
    }

    // Find the target state
    const targetState = team.states.nodes.find(s =>
      s.name.toLowerCase() === STATE_NAME.toLowerCase()
    );

    if (!targetState) {
      console.error(`❌ State "${STATE_NAME}" not found.`);
      console.log(`\nAvailable states:`);
      team.states.nodes.forEach(s => {
        console.log(`  - ${s.name} (${s.type})`);
      });
      process.exit(1);
    }

    console.log(`✅ Found state: ${targetState.name} (${targetState.type})`);

    // Update issue state
    console.log(`\n🔄 Updating issue state...`);
    const updateResult = await makeLinearRequest(updateStateMutation, {
      issueId: issue.id,
      stateId: targetState.id,
    });

    if (updateResult.issueUpdate.success) {
      const newState = updateResult.issueUpdate.issue.state;
      console.log(`✅ State updated successfully!`);
      console.log(`   New state: ${newState.name} (${newState.type})`);
      console.log(`\nView issue: https://linear.app/issue/${ISSUE_ID}`);
    } else {
      console.error(`❌ Failed to update state`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateIssueState();

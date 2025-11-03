#!/usr/bin/env node
/**
 * Get All Linear Issues for CampgroundOps
 *
 * Usage:
 *   node scripts/get-all-linear-issues.js
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY environment variable not set.');
  process.exit(1);
}

const query = `
  query GetAllIssues($teamKey: String!) {
    team(id: $teamKey) {
      issues {
        nodes {
          id
          identifier
          title
          description
          priority
          priorityLabel
          state {
            name
            type
          }
          labels {
            nodes {
              name
            }
          }
          parent {
            identifier
            title
          }
          children {
            nodes {
              identifier
              title
            }
          }
          createdAt
          updatedAt
          estimate
          url
        }
      }
    }
  }
`;

async function getAllIssues() {
  try {
    // First, get team ID for CAM
    const teamsResponse = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
      },
      body: JSON.stringify({
        query: `
          query GetTeams {
            teams {
              nodes {
                id
                key
                name
              }
            }
          }
        `,
      }),
    });

    const teamsData = await teamsResponse.json();

    if (teamsData.errors) {
      console.error('GraphQL Errors:', JSON.stringify(teamsData.errors, null, 2));
      process.exit(1);
    }

    const camTeam = teamsData.data.teams.nodes.find(t => t.key === 'CAM');

    if (!camTeam) {
      console.error('Team CAM not found');
      process.exit(1);
    }

    // Now get all issues for the team
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
      },
      body: JSON.stringify({
        query,
        variables: { teamKey: camTeam.id },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    if (!data.data?.team?.issues) {
      console.error('No issues found.');
      process.exit(1);
    }

    const issues = data.data.team.issues.nodes;

    console.log('='.repeat(80));
    console.log(`LINEAR ISSUES FOR CAMPGROUNDOPS (${issues.length} total)`);
    console.log('='.repeat(80));
    console.log('');

    // Group by status
    const byStatus = {};
    issues.forEach(issue => {
      const status = issue.state.type;
      if (!byStatus[status]) byStatus[status] = [];
      byStatus[status].push(issue);
    });

    // Display by status
    for (const [status, statusIssues] of Object.entries(byStatus)) {
      console.log(`\n${status.toUpperCase()} (${statusIssues.length})`);
      console.log('-'.repeat(80));

      statusIssues.forEach(issue => {
        console.log(`\n${issue.identifier}: ${issue.title}`);
        console.log(`  Status: ${issue.state.name}`);
        console.log(`  Priority: ${issue.priorityLabel || 'None'}`);
        if (issue.estimate) {
          console.log(`  Estimate: ${issue.estimate}h`);
        }
        if (issue.labels.nodes.length > 0) {
          console.log(`  Labels: ${issue.labels.nodes.map(l => l.name).join(', ')}`);
        }
        if (issue.parent) {
          console.log(`  Parent: ${issue.parent.identifier} - ${issue.parent.title}`);
        }
        if (issue.children.nodes.length > 0) {
          console.log(`  Sub-issues: ${issue.children.nodes.map(c => c.identifier).join(', ')}`);
        }
        console.log(`  URL: ${issue.url}`);
      });
    }

    console.log('\n' + '='.repeat(80));

    // Save to JSON
    const fs = require('fs');
    const outputPath = 'E:/Projects/Saas_CampOS/specs/all-linear-issues.json';
    fs.writeFileSync(outputPath, JSON.stringify(issues, null, 2));
    console.log(`\nRaw data saved to: ${outputPath}`);

  } catch (error) {
    console.error('Error fetching issues:', error.message);
    process.exit(1);
  }
}

getAllIssues();

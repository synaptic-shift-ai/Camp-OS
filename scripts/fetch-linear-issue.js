#!/usr/bin/env node
/**
 * Fetch Linear Issue Details
 *
 * Usage:
 *   LINEAR_API_KEY=lin_api_xxx node scripts/fetch-linear-issue.js CAM-78
 *
 * Or set LINEAR_API_KEY in .env.local and run:
 *   node scripts/fetch-linear-issue.js CAM-78
 */

require('dotenv').config({ path: '.env.local' });

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const ISSUE_ID = process.argv[2];

if (!LINEAR_API_KEY) {
  console.error('ERROR: LINEAR_API_KEY environment variable not set.');
  console.error('');
  console.error('Get your API key from: https://linear.app/settings/api');
  console.error('');
  console.error('Then either:');
  console.error('  1. Add it to .env.local:');
  console.error('     LINEAR_API_KEY=lin_api_xxxxxxxxxxxxx');
  console.error('  2. Or run with:');
  console.error('     LINEAR_API_KEY=lin_api_xxx node scripts/fetch-linear-issue.js CAM-78');
  process.exit(1);
}

if (!ISSUE_ID) {
  console.error('ERROR: Issue ID required.');
  console.error('Usage: node scripts/fetch-linear-issue.js CAM-78');
  process.exit(1);
}

const query = `
  query GetIssue($id: String!) {
    issue(id: $id) {
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
      team {
        name
        key
      }
      assignee {
        name
        email
      }
      creator {
        name
        email
      }
      labels {
        nodes {
          name
          color
        }
      }
      comments {
        nodes {
          body
          user {
            name
          }
          createdAt
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
      relations {
        nodes {
          type
          relatedIssue {
            identifier
            title
          }
        }
      }
      createdAt
      updatedAt
      dueDate
      estimate
      url
    }
  }
`;

async function fetchIssue() {
  try {
    const response = await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
      },
      body: JSON.stringify({
        query,
        variables: { id: ISSUE_ID },
      }),
    });

    const data = await response.json();

    if (data.errors) {
      console.error('GraphQL Errors:', JSON.stringify(data.errors, null, 2));
      process.exit(1);
    }

    if (!data.data?.issue) {
      console.error(`Issue ${ISSUE_ID} not found.`);
      process.exit(1);
    }

    const issue = data.data.issue;

    console.log('='.repeat(80));
    console.log(`LINEAR ISSUE: ${issue.identifier}`);
    console.log('='.repeat(80));
    console.log('');
    console.log(`Title: ${issue.title}`);
    console.log(`Status: ${issue.state.name} (${issue.state.type})`);
    console.log(`Priority: ${issue.priorityLabel || 'None'}`);
    console.log(`Team: ${issue.team.name}`);
    console.log(`Created: ${new Date(issue.createdAt).toLocaleDateString()}`);
    console.log(`Updated: ${new Date(issue.updatedAt).toLocaleDateString()}`);
    if (issue.dueDate) {
      console.log(`Due Date: ${new Date(issue.dueDate).toLocaleDateString()}`);
    }
    if (issue.estimate) {
      console.log(`Estimate: ${issue.estimate} points`);
    }
    if (issue.assignee) {
      console.log(`Assignee: ${issue.assignee.name} (${issue.assignee.email})`);
    }
    console.log(`Creator: ${issue.creator.name}`);
    console.log(`URL: ${issue.url}`);
    console.log('');

    if (issue.labels.nodes.length > 0) {
      console.log('Labels:');
      issue.labels.nodes.forEach(label => {
        console.log(`  - ${label.name}`);
      });
      console.log('');
    }

    if (issue.parent) {
      console.log(`Parent Issue: ${issue.parent.identifier} - ${issue.parent.title}`);
      console.log('');
    }

    if (issue.children.nodes.length > 0) {
      console.log('Sub-issues:');
      issue.children.nodes.forEach(child => {
        console.log(`  - ${child.identifier}: ${child.title}`);
      });
      console.log('');
    }

    if (issue.relations.nodes.length > 0) {
      console.log('Related Issues:');
      issue.relations.nodes.forEach(rel => {
        console.log(`  - ${rel.type}: ${rel.relatedIssue.identifier} - ${rel.relatedIssue.title}`);
      });
      console.log('');
    }

    console.log('-'.repeat(80));
    console.log('DESCRIPTION:');
    console.log('-'.repeat(80));
    console.log(issue.description || '(No description provided)');
    console.log('');

    if (issue.comments.nodes.length > 0) {
      console.log('-'.repeat(80));
      console.log('COMMENTS:');
      console.log('-'.repeat(80));
      issue.comments.nodes.forEach((comment, idx) => {
        console.log('');
        console.log(`Comment ${idx + 1} by ${comment.user.name} on ${new Date(comment.createdAt).toLocaleDateString()}:`);
        console.log(comment.body);
      });
      console.log('');
    }

    console.log('='.repeat(80));
    console.log('');

    // Also save to JSON for easier parsing
    const fs = require('fs');
    const outputPath = `E:/Projects/Saas_CampOS/specs/${ISSUE_ID}-raw.json`;
    fs.writeFileSync(outputPath, JSON.stringify(issue, null, 2));
    console.log(`Raw data saved to: ${outputPath}`);

  } catch (error) {
    console.error('Error fetching issue:', error.message);
    process.exit(1);
  }
}

fetchIssue();

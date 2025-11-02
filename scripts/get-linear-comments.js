#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });

const ISSUE_ID = process.argv[2] || 'CAM-129';
const query = `
  query GetComments($id: String!) {
    issue(id: $id) {
      identifier
      comments {
        nodes {
          body
          createdAt
          user {
            name
            email
          }
        }
      }
    }
  }
`;

fetch('https://api.linear.app/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': process.env.LINEAR_API_KEY,
  },
  body: JSON.stringify({ query, variables: { id: ISSUE_ID } }),
})
.then(r => r.json())
.then(data => {
  if (data.errors) {
    console.error('Errors:', data.errors);
    return;
  }

  const comments = data.data.issue.comments.nodes;
  console.log(`\nComments for ${data.data.issue.identifier}:\n`);

  if (comments.length === 0) {
    console.log('No comments found.');
  } else {
    comments.forEach((c, i) => {
      console.log(`Comment ${i + 1} (${new Date(c.createdAt).toLocaleString()}):`);
      console.log(`By: ${c.user?.name || c.user?.email || 'Unknown'}`);
      console.log(c.body);
      console.log('\n' + '='.repeat(80) + '\n');
    });
  }
})
.catch(console.error);

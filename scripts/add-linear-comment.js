const https = require('https');
const fs = require('fs');

const LINEAR_API_KEY = process.env.LINEAR_API_KEY;
const issueIdentifier = process.argv[2];
let commentBody = process.argv[3];

if (!LINEAR_API_KEY) {
  console.error('❌ LINEAR_API_KEY environment variable is required');
  process.exit(1);
}

if (!issueIdentifier || !commentBody) {
  console.error('Usage: node add-linear-comment.js <issue-identifier> <comment-body-or-file>');
  console.error('Example: node add-linear-comment.js CAM-132 "Comment text here"');
  console.error('Example: node add-linear-comment.js CAM-132 @path/to/file.txt');
  process.exit(1);
}

// If comment body starts with @, read from file
if (commentBody.startsWith('@')) {
  const filePath = commentBody.substring(1);
  try {
    commentBody = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`❌ Error reading file ${filePath}:`, error.message);
    process.exit(1);
  }
}

// First, fetch the issue to get its ID
function fetchIssue(identifier) {
  return new Promise((resolve, reject) => {
    // Linear API uses different query for identifier vs ID
    const query = `
      query {
        issues(filter: { number: { eq: ${identifier.replace('CAM-', '')} } }) {
          nodes {
            id
            identifier
            title
          }
        }
      }
    `;

    const data = JSON.stringify({
      query
    });

    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        const response = JSON.parse(body);
        if (response.errors) {
          reject(new Error(JSON.stringify(response.errors, null, 2)));
        } else if (response.data.issues && response.data.issues.nodes.length > 0) {
          resolve(response.data.issues.nodes[0]);
        } else {
          resolve(null);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Add comment to the issue
function addComment(issueId, body) {
  return new Promise((resolve, reject) => {
    const mutation = `
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

    const data = JSON.stringify({
      query: mutation,
      variables: { issueId, body }
    });

    const options = {
      hostname: 'api.linear.app',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': LINEAR_API_KEY,
        'Content-Length': data.length
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', (chunk) => responseBody += chunk);
      res.on('end', () => {
        const response = JSON.parse(responseBody);
        if (response.errors) {
          reject(new Error(JSON.stringify(response.errors, null, 2)));
        } else if (response.data && response.data.commentCreate) {
          resolve(response.data.commentCreate);
        } else {
          reject(new Error('Unexpected response format: ' + JSON.stringify(response)));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  try {
    console.log(`📋 Fetching issue ${issueIdentifier}...`);
    const issue = await fetchIssue(issueIdentifier);

    if (!issue) {
      console.error(`❌ Issue ${issueIdentifier} not found`);
      process.exit(1);
    }

    console.log(`✅ Found: ${issue.identifier} - ${issue.title}`);
    console.log(`\n💬 Adding comment...`);

    const result = await addComment(issue.id, commentBody);

    if (result.success) {
      console.log(`✅ Comment added successfully!`);
      console.log(`\nComment preview:`);
      console.log('─'.repeat(80));
      console.log(commentBody.substring(0, 200) + (commentBody.length > 200 ? '...' : ''));
      console.log('─'.repeat(80));
    } else {
      console.error('❌ Failed to add comment');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();

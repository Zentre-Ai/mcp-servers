# GitHub MCP Server

A Model Context Protocol (MCP) server for GitHub integration with dynamic authentication.

## Features

- **Dynamic Authentication**: Pass GitHub token via HTTP headers per-request
- **Repository Management**: Create, update, delete, fork repositories
- **Issue Management**: Create, update, comment on issues
- **Pull Request Management**: Create, review, merge pull requests
- **Branch Management**: Create, delete, merge branches
- **User Operations**: Get user info, search users
- **Docker Support**: Production-ready containerization

## Authentication

This server supports GitHub tokens via HTTP headers:

| Header | Description |
|--------|-------------|
| `x-github-token` | GitHub Personal Access Token or OAuth token |
| `Authorization` | Bearer token (alternative) |

### Example Request

```bash
# Using x-github-token header
curl -X POST http://localhost:3000/mcp \
  -H "x-github-token: ghp_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# Using Authorization header
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## Tools

### Repository Tools (8)

| Tool | Description |
|------|-------------|
| `github_list_repos` | List repositories for user or org |
| `github_get_repo` | Get repository details |
| `github_create_repo` | Create a new repository |
| `github_update_repo` | Update repository settings |
| `github_delete_repo` | Delete a repository |
| `github_fork_repo` | Fork a repository |
| `github_list_commits` | List commits in a repository |
| `github_get_commit` | Get commit details |

### Issue Tools (8)

| Tool | Description |
|------|-------------|
| `github_list_issues` | List issues with filters |
| `github_get_issue` | Get issue details |
| `github_create_issue` | Create a new issue |
| `github_update_issue` | Update an issue |
| `github_add_issue_comment` | Add comment to issue |
| `github_list_issue_comments` | List issue comments |
| `github_add_labels` | Add labels to issue |
| `github_remove_labels` | Remove labels from issue |

### Pull Request Tools (9)

| Tool | Description |
|------|-------------|
| `github_list_pulls` | List pull requests |
| `github_get_pull` | Get pull request details |
| `github_create_pull` | Create a pull request |
| `github_update_pull` | Update a pull request |
| `github_merge_pull` | Merge a pull request |
| `github_list_pull_commits` | List commits in a PR |
| `github_list_pull_files` | List files changed in a PR |
| `github_create_review` | Create a PR review |
| `github_add_pull_comment` | Add comment to PR |

### Branch Tools (5)

| Tool | Description |
|------|-------------|
| `github_list_branches` | List repository branches |
| `github_get_branch` | Get branch details |
| `github_create_branch` | Create a new branch |
| `github_delete_branch` | Delete a branch |
| `github_merge_branches` | Merge branches |

### User Tools (4)

| Tool | Description |
|------|-------------|
| `github_get_me` | Get authenticated user |
| `github_get_user` | Get user by username |
| `github_list_org_members` | List organization members |
| `github_search_users` | Search for users |

**Total: 34 tools**

## Installation

```bash
npm install
```

## Development

```bash
# Run in development mode
npm run dev

# Build for production
npm run build

# Run production build
npm start
```

## Docker

### Build and Run

```bash
# Using docker-compose
docker-compose up -d

# Or build manually
docker build -t mcp-server-github .
docker run -p 3006:3000 mcp-server-github
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | MCP protocol endpoint |
| `GET /health` | Health check endpoint |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |

## Example Usage

### Create a Repository

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-github-token: ghp_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "github_create_repo",
      "arguments": {
        "name": "my-new-repo",
        "description": "A new repository",
        "private": false,
        "autoInit": true
      }
    },
    "id": 1
  }'
```

### Create an Issue

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-github-token: ghp_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "github_create_issue",
      "arguments": {
        "owner": "my-username",
        "repo": "my-repo",
        "title": "Bug: Something is broken",
        "body": "## Description\nSomething is not working as expected.",
        "labels": ["bug"]
      }
    },
    "id": 1
  }'
```

### Create a Pull Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-github-token: ghp_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "github_create_pull",
      "arguments": {
        "owner": "my-username",
        "repo": "my-repo",
        "title": "Add new feature",
        "head": "feature-branch",
        "base": "main",
        "body": "## Summary\nThis PR adds a new feature."
      }
    },
    "id": 1
  }'
```

### Merge a Pull Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-github-token: ghp_xxxxxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "github_merge_pull",
      "arguments": {
        "owner": "my-username",
        "repo": "my-repo",
        "pullNumber": 123,
        "mergeMethod": "squash"
      }
    },
    "id": 1
  }'
```

## Docker Ports

| Server | Port |
|--------|------|
| mcp-server-notion | 3001 |
| mcp-server-gmail | 3002 |
| mcp-server-google-calendar | 3003 |
| mcp-server-slack | 3004 |
| mcp-server-jira | 3005 |
| mcp-server-github | 3006 |

## Getting a GitHub Token

1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)" or "Fine-grained tokens"
3. Select the required scopes:
   - `repo` - Full repository access
   - `read:org` - Read organization data
   - `user` - Read user profile
   - `delete_repo` - Delete repositories (optional)
4. Copy the token and use it in the `x-github-token` header

## Required Token Scopes

| Scope | Description |
|-------|-------------|
| `repo` | Full control of private repositories |
| `read:org` | Read org and team membership |
| `user` | Read user profile data |
| `delete_repo` | Delete repositories (optional) |

## License

MIT

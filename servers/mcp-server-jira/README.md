# Jira MCP Server

A Model Context Protocol (MCP) server for Jira integration with dynamic authentication.

## Features

- **Dynamic Authentication**: Pass credentials via HTTP headers per-request
- **Issue Management**: Create, update, delete, transition, comment on issues
- **Project Management**: List projects, components, versions, sprints
- **JQL Search**: Powerful search with Jira Query Language
- **User Management**: Search users, find assignable users
- **Agile Support**: Boards, sprints, epics
- **Docker Support**: Production-ready containerization

## Authentication

This server supports two authentication methods via HTTP headers:

### Option 1: API Token (Recommended for Jira Cloud)

| Header | Description |
|--------|-------------|
| `x-jira-host` | Your Jira host (e.g., `your-domain.atlassian.net`) |
| `x-jira-email` | Your Atlassian account email |
| `x-jira-token` | Your API token |

### Option 2: OAuth 2.0 Bearer Token

| Header | Description |
|--------|-------------|
| `x-jira-host` | Your Jira host (e.g., `your-domain.atlassian.net`) |
| `Authorization` | Bearer token |

### Example Request

```bash
# Using API Token
curl -X POST http://localhost:3000/mcp \
  -H "x-jira-host: your-domain.atlassian.net" \
  -H "x-jira-email: your-email@example.com" \
  -H "x-jira-token: your-api-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'

# Using OAuth Bearer
curl -X POST http://localhost:3000/mcp \
  -H "x-jira-host: your-domain.atlassian.net" \
  -H "Authorization: Bearer your-oauth-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## Tools

### Issue Tools (9)

| Tool | Description |
|------|-------------|
| `jira_get_issue` | Get issue details by key or ID |
| `jira_create_issue` | Create a new issue |
| `jira_update_issue` | Update an existing issue |
| `jira_delete_issue` | Delete an issue |
| `jira_get_transitions` | Get available status transitions |
| `jira_transition_issue` | Change issue status |
| `jira_add_comment` | Add comment to issue |
| `jira_get_comments` | Get issue comments |
| `jira_assign_issue` | Assign issue to user |

### Project Tools (7)

| Tool | Description |
|------|-------------|
| `jira_list_projects` | List all projects |
| `jira_get_project` | Get project details |
| `jira_get_issue_types` | Get issue types for project |
| `jira_get_components` | Get project components |
| `jira_get_versions` | Get project versions/releases |
| `jira_get_boards` | Get agile boards |
| `jira_get_sprints` | Get sprints for a board |

### Search Tools (5)

| Tool | Description |
|------|-------------|
| `jira_search` | Search issues with JQL |
| `jira_my_issues` | Get issues assigned to me |
| `jira_recent_issues` | Get recently updated issues |
| `jira_sprint_issues` | Get issues in a sprint |
| `jira_epic_issues` | Get issues in an epic |

### User Tools (5)

| Tool | Description |
|------|-------------|
| `jira_get_myself` | Get current user info |
| `jira_get_user` | Get user by account ID |
| `jira_search_users` | Search for users |
| `jira_assignable_users` | Find assignable users |
| `jira_get_project_roles` | Get project roles and members |

**Total: 26 tools**

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
docker build -t mcp-server-jira .
docker run -p 3005:3000 mcp-server-jira
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

### Create an Issue

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-jira-host: your-domain.atlassian.net" \
  -H "x-jira-email: your-email@example.com" \
  -H "x-jira-token: your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "jira_create_issue",
      "arguments": {
        "projectKey": "PROJ",
        "issueType": "Task",
        "summary": "New task from MCP",
        "description": "This task was created via MCP server",
        "priority": "Medium"
      }
    },
    "id": 1
  }'
```

### Search with JQL

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-jira-host: your-domain.atlassian.net" \
  -H "x-jira-email: your-email@example.com" \
  -H "x-jira-token: your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "jira_search",
      "arguments": {
        "jql": "project = PROJ AND status = \"In Progress\" ORDER BY updated DESC",
        "maxResults": 10
      }
    },
    "id": 1
  }'
```

### Transition Issue Status

```bash
# First get available transitions
curl -X POST http://localhost:3000/mcp \
  -H "x-jira-host: your-domain.atlassian.net" \
  -H "x-jira-email: your-email@example.com" \
  -H "x-jira-token: your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "jira_get_transitions",
      "arguments": {
        "issueIdOrKey": "PROJ-123"
      }
    },
    "id": 1
  }'

# Then transition using the ID
curl -X POST http://localhost:3000/mcp \
  -H "x-jira-host: your-domain.atlassian.net" \
  -H "x-jira-email: your-email@example.com" \
  -H "x-jira-token: your-api-token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "jira_transition_issue",
      "arguments": {
        "issueIdOrKey": "PROJ-123",
        "transitionId": "31",
        "comment": "Moving to In Progress"
      }
    },
    "id": 1
  }'
```

## JQL Examples

| Query | Description |
|-------|-------------|
| `project = PROJ` | All issues in project |
| `assignee = currentUser()` | Issues assigned to me |
| `status = "In Progress"` | Issues in progress |
| `sprint in openSprints()` | Issues in active sprints |
| `updated >= -1d` | Updated in last day |
| `priority = High AND status != Done` | High priority open issues |
| `labels = "bug"` | Issues with bug label |
| `"Epic Link" = PROJ-100` | Issues in an epic |

## Docker Ports

| Server | Port |
|--------|------|
| mcp-server-notion | 3001 |
| mcp-server-gmail | 3002 |
| mcp-server-google-calendar | 3003 |
| mcp-server-slack | 3004 |
| mcp-server-jira | 3005 |

## Getting an API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name and copy the token
4. Use your Atlassian account email and this token for authentication

## License

MIT

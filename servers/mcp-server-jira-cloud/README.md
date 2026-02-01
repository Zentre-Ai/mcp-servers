# Jira Cloud MCP Server

A Model Context Protocol (MCP) server for Jira Cloud with OAuth 2.0 (3LO) authentication.

> **Note**: For Jira Data Center/Server or Jira Cloud with API tokens, see [mcp-server-jira-datacenter](../mcp-server-jira-datacenter/).

## Features

- **OAuth 2.0 Authentication**: Secure 3-legged OAuth flow with PKCE
- **Token Management**: Token exchange and refresh endpoints
- **Multi-site Support**: Access multiple Jira Cloud sites with one token
- **Issue Management**: Create, update, delete, transition, comment on issues
- **Project Management**: List projects, components, versions, sprints
- **JQL Search**: Powerful search with Jira Query Language
- **User Management**: Search users, find assignable users
- **Agile Support**: Boards, sprints, epics
- **Docker Support**: Production-ready containerization

## Authentication

### OAuth 2.0 Flow

This server implements Atlassian's OAuth 2.0 (3LO) authentication:

1. **Get Authorization URL**: `GET /oauth/authorize`
2. **User Authorizes**: User visits URL and grants permission
3. **Exchange Code**: `POST /oauth/callback` with code and verifier
4. **Get Sites**: Use access token to fetch accessible Jira sites
5. **Make API Calls**: Include token and cloud ID in MCP requests

### MCP Request Headers

| Header | Description |
|--------|-------------|
| `Authorization` | `Bearer <access-token>` |
| `x-jira-cloud-id` | Cloud ID from sites endpoint |

### Example MCP Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer <access-token>" \
  -H "x-jira-cloud-id: <cloud-id>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## OAuth Endpoints

### GET /oauth/authorize

Get the Atlassian authorization URL for OAuth flow.

**Query Parameters:**
- `redirect_uri` - OAuth callback URL (optional if configured via env)

**Response:**
```json
{
  "authorizationUrl": "https://auth.atlassian.com/authorize?...",
  "state": "random-state-string",
  "codeVerifier": "pkce-code-verifier",
  "redirectUri": "http://localhost:3000/oauth/callback"
}
```

### POST /oauth/callback

Exchange authorization code for access tokens.

**Request Body:**
```json
{
  "code": "authorization-code-from-callback",
  "codeVerifier": "pkce-verifier-from-authorize",
  "redirectUri": "http://localhost:3000/oauth/callback"
}
```

**Response:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "expiresAt": 1234567890000,
  "tokenType": "Bearer",
  "scope": "read:jira-work write:jira-work",
  "sites": [
    {
      "id": "cloud-id",
      "name": "My Company",
      "url": "https://mycompany.atlassian.net",
      "scopes": ["read:jira-work", "write:jira-work"]
    }
  ]
}
```

### POST /oauth/refresh

Refresh an expired access token.

**Request Body:**
```json
{
  "refreshToken": "refresh-token"
}
```

**Response:**
```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token",
  "expiresAt": 1234567890000,
  "tokenType": "Bearer",
  "scope": "read:jira-work write:jira-work"
}
```

### GET /oauth/sites

Get accessible Jira Cloud sites for an access token.

**Headers:**
- `Authorization: Bearer <access-token>`

**Response:**
```json
{
  "sites": [
    {
      "id": "cloud-id",
      "name": "My Company",
      "url": "https://mycompany.atlassian.net",
      "scopes": ["read:jira-work", "write:jira-work"]
    }
  ]
}
```

## Tools

### Issue Tools (9)

| Tool | Description |
|------|-------------|
| `jira_cloud_get_issue` | Get issue details by key or ID |
| `jira_cloud_create_issue` | Create a new issue |
| `jira_cloud_update_issue` | Update an existing issue |
| `jira_cloud_delete_issue` | Delete an issue |
| `jira_cloud_get_transitions` | Get available status transitions |
| `jira_cloud_transition_issue` | Change issue status |
| `jira_cloud_add_comment` | Add comment to issue |
| `jira_cloud_get_comments` | Get issue comments |
| `jira_cloud_assign_issue` | Assign issue to user |

### Project Tools (7)

| Tool | Description |
|------|-------------|
| `jira_cloud_list_projects` | List all projects |
| `jira_cloud_get_project` | Get project details |
| `jira_cloud_get_issue_types` | Get issue types for project |
| `jira_cloud_get_components` | Get project components |
| `jira_cloud_get_versions` | Get project versions/releases |
| `jira_cloud_get_boards` | Get agile boards |
| `jira_cloud_get_sprints` | Get sprints for a board |

### Search Tools (5)

| Tool | Description |
|------|-------------|
| `jira_cloud_search` | Search issues with JQL |
| `jira_cloud_my_issues` | Get issues assigned to me |
| `jira_cloud_recent_issues` | Get recently updated issues |
| `jira_cloud_sprint_issues` | Get issues in a sprint |
| `jira_cloud_epic_issues` | Get issues in an epic |

### User Tools (5)

| Tool | Description |
|------|-------------|
| `jira_cloud_get_myself` | Get current user info |
| `jira_cloud_get_user` | Get user by account ID |
| `jira_cloud_search_users` | Search for users |
| `jira_cloud_assignable_users` | Find assignable users |
| `jira_cloud_get_project_roles` | Get project roles and members |

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
docker build -t mcp-server-jira-cloud .
docker run -p 3006:3000 \
  -e ATLASSIAN_CLIENT_ID=your-client-id \
  -e ATLASSIAN_CLIENT_SECRET=your-client-secret \
  mcp-server-jira-cloud
```

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | POST | MCP protocol endpoint |
| `/health` | GET | Health check endpoint |
| `/oauth/authorize` | GET | Get authorization URL |
| `/oauth/callback` | POST | Exchange code for tokens |
| `/oauth/refresh` | POST | Refresh access token |
| `/oauth/sites` | GET | List accessible sites |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `PORT` | `3000` | HTTP server port |
| `LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `ATLASSIAN_CLIENT_ID` | - | OAuth 2.0 client ID |
| `ATLASSIAN_CLIENT_SECRET` | - | OAuth 2.0 client secret |
| `OAUTH_REDIRECT_URI` | - | OAuth callback URL |
| `OAUTH_SCOPES` | `read:jira-work write:jira-work read:jira-user offline_access` | OAuth scopes |

## Setting Up OAuth 2.0

### 1. Create an Atlassian OAuth App

1. Go to [developer.atlassian.com/console/myapps](https://developer.atlassian.com/console/myapps)
2. Click **Create** > **OAuth 2.0 integration**
3. Name your app and agree to terms

### 2. Configure Authorization

1. Under **Authorization**, click **Configure**
2. Add your callback URL (e.g., `http://localhost:3006/oauth/callback`)
3. Save changes

### 3. Add Permissions

Under **Permissions**, add:
- **Jira API**:
  - `read:jira-work` - Read project and issue data
  - `write:jira-work` - Create and edit issues
  - `read:jira-user` - Read user information

### 4. Get Credentials

Under **Settings**, copy:
- **Client ID**
- **Client secret** (click to reveal)

### 5. Configure the Server

Set environment variables:
```bash
export ATLASSIAN_CLIENT_ID=your-client-id
export ATLASSIAN_CLIENT_SECRET=your-client-secret
export OAUTH_REDIRECT_URI=http://localhost:3006/oauth/callback
```

## Example Usage

### Complete OAuth Flow

```bash
# 1. Start the server
npm run dev

# 2. Get authorization URL
curl "http://localhost:3000/oauth/authorize?redirect_uri=http://localhost:3000/oauth/callback"

# 3. User visits authorizationUrl and grants permission
# 4. User is redirected to callback with ?code=... and ?state=...

# 5. Exchange code for tokens
curl -X POST http://localhost:3000/oauth/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "authorization-code",
    "codeVerifier": "code-verifier-from-step-2",
    "redirectUri": "http://localhost:3000/oauth/callback"
  }'

# 6. Use tokens to make MCP requests
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer <access-token>" \
  -H "x-jira-cloud-id: <cloud-id-from-sites>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "jira_cloud_get_myself"
    },
    "id": 1
  }'
```

### Create an Issue

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer <access-token>" \
  -H "x-jira-cloud-id: <cloud-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "jira_cloud_create_issue",
      "arguments": {
        "projectKey": "PROJ",
        "issueType": "Task",
        "summary": "New task from MCP",
        "description": "This task was created via MCP server"
      }
    },
    "id": 1
  }'
```

### Search with JQL

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer <access-token>" \
  -H "x-jira-cloud-id: <cloud-id>" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "jira_cloud_search",
      "arguments": {
        "jql": "project = PROJ AND status = \"In Progress\" ORDER BY updated DESC",
        "maxResults": 10
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

## License

MIT

# GitLab MCP Server Implementation Plan

## Overview

Create a unified MCP server for GitLab that supports both GitLab.com (cloud) and self-hosted GitLab instances. This server will follow the established patterns from existing servers (GitHub, Jira Cloud/Datacenter) in this repository.

## Design Decision: Unified Server

**Recommended Approach**: Single server handling both cloud and self-hosted

**Rationale**:
- GitLab API is consistent between cloud and self-hosted versions
- Only difference is the base URL (`gitlab.com` vs custom domain)
- Simpler maintenance than two separate servers
- Follows the GitHub server pattern (which also supports GitHub Enterprise via custom URL)

**Alternative Considered**: Separate servers (like Jira Cloud vs Jira Datacenter)
- Rejected because GitLab doesn't have significantly different APIs between editions
- Jira has different authentication models; GitLab uses the same PAT/OAuth for both

---

## Authentication Strategy

### Primary: OAuth 2.0 with PKCE

OAuth 2.0 with PKCE (Proof Key for Code Exchange) provides secure user authorization for both GitLab.com and self-hosted instances.

**Why OAuth 2.0:**
- Secure user authorization without sharing passwords
- Granular scope control
- Token refresh without user re-authentication
- Standard flow supported by GitLab
- PKCE prevents authorization code interception attacks

**GitLab OAuth 2.0 Flow:**
```
┌─────────┐     ┌─────────────┐     ┌─────────────┐
│  User   │     │  MCP Server │     │   GitLab    │
└────┬────┘     └──────┬──────┘     └──────┬──────┘
     │                 │                    │
     │ 1. Request Auth │                    │
     │────────────────>│                    │
     │                 │                    │
     │ 2. Auth URL +   │                    │
     │    PKCE verifier│                    │
     │<────────────────│                    │
     │                 │                    │
     │ 3. User authorizes via browser       │
     │─────────────────────────────────────>│
     │                 │                    │
     │ 4. Redirect with code                │
     │<─────────────────────────────────────│
     │                 │                    │
     │ 5. Code + verifier                   │
     │────────────────>│                    │
     │                 │ 6. Exchange code   │
     │                 │───────────────────>│
     │                 │                    │
     │                 │ 7. Tokens          │
     │                 │<───────────────────│
     │ 8. Tokens       │                    │
     │<────────────────│                    │
     │                 │                    │
     │ 9. MCP requests with token           │
     │────────────────>│                    │
     │                 │ 10. API calls      │
     │                 │───────────────────>│
```

**OAuth Scopes Required:**
| Scope | Purpose |
|-------|---------|
| `api` | Full API access (read/write) |
| `read_user` | Read user profile |
| `read_api` | Read-only API access |
| `read_repository` | Read repository contents |
| `write_repository` | Write to repositories |
| `openid` | OpenID Connect (optional) |

**GitLab OAuth Endpoints:**
- Authorization: `https://{host}/oauth/authorize`
- Token: `https://{host}/oauth/token`
- Revoke: `https://{host}/oauth/revoke`
- UserInfo: `https://{host}/oauth/userinfo` (OpenID)

### Fallback: Personal Access Token (PAT)
- Still supported for backward compatibility
- Token passed via `Authorization: Bearer <token>` header
- Useful for CI/CD and automated workflows
- No server-side secrets required

---

## GitLab API Reference

**Base URL**:
- Cloud: `https://gitlab.com/api/v4`
- Self-hosted: `https://{custom-domain}/api/v4`

**Key Differences from GitHub**:
| Concept | GitHub | GitLab |
|---------|--------|--------|
| Repository | Repository | Project |
| Pull Request | Pull Request | Merge Request |
| Organization | Organization | Group |
| ID in URLs | Uses `id` | Uses `iid` (internal ID) for issues/MRs within project |

---

## Directory Structure

```
servers/mcp-server-gitlab/
├── src/
│   ├── config.ts              # Zod configuration validation
│   ├── server.ts              # MCP server setup with auth management
│   ├── index.ts               # HTTP server with optional OAuth endpoints
│   ├── utils/
│   │   ├── logger.ts          # stderr logger (copy from template)
│   │   ├── gitlab-client.ts   # GitLab API client with formatters
│   │   └── oauth.ts           # OAuth 2.0 flow (optional)
│   └── tools/
│       ├── projects.tool.ts   # Project management (repos equivalent)
│       ├── issues.tool.ts     # Issue management
│       ├── merge-requests.tool.ts  # MR management (PRs equivalent)
│       ├── branches.tool.ts   # Branch management
│       ├── users.tool.ts      # User and group management
│       ├── pipelines.tool.ts  # CI/CD pipelines
│       └── search.tool.ts     # Global search
├── tests/
│   └── tools/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Files to Create

### 1. `src/config.ts`

```typescript
// Environment variables:
// - PORT (default: 3000)
// - LOG_LEVEL (debug|info|warn|error, default: info)
// - GITLAB_DEFAULT_HOST (optional, defaults to gitlab.com)
//
// Note: Credentials are passed per-request via headers, not env vars
```

### 2. `src/utils/gitlab-client.ts`

**GitLab Auth Interface**:
```typescript
interface GitLabAuth {
  host: string;      // gitlab.com or custom domain
  token: string;     // Personal Access Token or OAuth token
}
```

**Functions**:
- `createGitLabClient(auth)` - Create API client instance
- `extractGitLabAuth(headers)` - Extract auth from request headers
- `formatProject(project)` - Format project response
- `formatIssue(issue)` - Format issue response
- `formatMergeRequest(mr)` - Format MR response
- `formatUser(user)` - Format user response
- `formatPipeline(pipeline)` - Format pipeline response
- `formatBranch(branch)` - Format branch response

**Headers Expected**:
```
Authorization: Bearer <token>
x-gitlab-host: gitlab.example.com  (optional, defaults to gitlab.com)
```

### 3. `src/utils/oauth.ts`

**Core OAuth 2.0 with PKCE Implementation:**

```typescript
import { createHash, randomBytes } from "node:crypto";

// ============================================================
// Types
// ============================================================

export interface PKCEPair {
  codeVerifier: string;
  codeChallenge: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: number;      // Calculated: Date.now() + expiresIn * 1000
  tokenType: string;      // "Bearer"
  scope: string;
  createdAt: number;
}

export interface AuthorizationUrlParams {
  host: string;           // gitlab.com or custom domain
  clientId: string;
  redirectUri: string;
  scopes: string;
  state: string;
  codeChallenge: string;
}

// ============================================================
// PKCE Functions
// ============================================================

/**
 * Generate cryptographically secure random string
 */
function generateRandomString(length: number): string {
  return randomBytes(length).toString("base64url").slice(0, length);
}

/**
 * Generate CSRF protection state
 */
export function generateState(): string {
  return generateRandomString(32);
}

/**
 * Generate PKCE code verifier and challenge pair
 * Uses S256 method (SHA-256 hash, base64url encoded)
 */
export function generatePKCE(): PKCEPair {
  // Code verifier: 43-128 characters, URL-safe
  const codeVerifier = generateRandomString(64);

  // Code challenge: SHA-256 hash of verifier, base64url encoded
  const codeChallenge = createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");

  return { codeVerifier, codeChallenge };
}

// ============================================================
// Authorization URL
// ============================================================

/**
 * Generate GitLab OAuth authorization URL
 */
export function generateAuthorizationUrl(params: AuthorizationUrlParams): string {
  const { host, clientId, redirectUri, scopes, state, codeChallenge } = params;

  const baseUrl = `https://${host}/oauth/authorize`;
  const urlParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `${baseUrl}?${urlParams.toString()}`;
}

// ============================================================
// Token Exchange
// ============================================================

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  host: string,
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string
): Promise<TokenResponse> {
  const tokenUrl = `https://${host}/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Token exchange failed: ${error.error_description || error.error || response.statusText}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type || "Bearer",
    scope: data.scope || "",
    createdAt: data.created_at || Math.floor(Date.now() / 1000),
  };
}

// ============================================================
// Token Refresh
// ============================================================

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  host: string,
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<TokenResponse> {
  const tokenUrl = `https://${host}/oauth/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Token refresh failed: ${error.error_description || error.error || response.statusText}`
    );
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // GitLab may reuse refresh token
    expiresIn: data.expires_in,
    expiresAt: Date.now() + data.expires_in * 1000,
    tokenType: data.token_type || "Bearer",
    scope: data.scope || "",
    createdAt: data.created_at || Math.floor(Date.now() / 1000),
  };
}

// ============================================================
// Token Revocation
// ============================================================

/**
 * Revoke access or refresh token
 */
export async function revokeToken(
  host: string,
  token: string,
  clientId: string,
  clientSecret: string
): Promise<void> {
  const revokeUrl = `https://${host}/oauth/revoke`;

  const response = await fetch(revokeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      token: token,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Token revocation failed: ${error.error_description || error.error || response.statusText}`
    );
  }
}
```

**Key Implementation Details:**

1. **PKCE S256 Method**: Uses SHA-256 hash with base64url encoding (more secure than plain method)
2. **State Parameter**: CSRF protection - client must verify state matches on callback
3. **Code Verifier Storage**: Client must store verifier between authorize and callback steps
4. **Token Expiration**: `expiresAt` calculated server-side for consistent timing
5. **Refresh Token Reuse**: GitLab may return same refresh token or issue new one

### 4. `src/server.ts`

- MCP server setup with `@modelcontextprotocol/sdk`
- Auth context management (`setCurrentAuth`, `getCurrentAuth`)
- Tool registration imports

### 5. `src/index.ts`

**HTTP Server with OAuth Endpoints:**

```typescript
import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { config } from "./config.js";
import { server, setCurrentAuth } from "./server.js";
import { extractGitLabAuth } from "./utils/gitlab-client.js";
import {
  generateState,
  generatePKCE,
  generateAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  revokeToken,
} from "./utils/oauth.js";
import { logger } from "./utils/logger.js";

// ============================================================
// HTTP Endpoints
// ============================================================

/**
 * GET /health
 * Health check endpoint
 */
async function handleHealth(res: ServerResponse): Promise<void> {
  sendJson(res, 200, {
    status: "ok",
    server: "mcp-server-gitlab",
    timestamp: new Date().toISOString(),
  });
}

/**
 * GET /oauth/authorize
 * Generate authorization URL with PKCE
 *
 * Query params (all provided by client):
 * - clientId: GitLab OAuth Application ID (REQUIRED)
 * - host: GitLab host (optional, defaults to gitlab.com)
 * - redirectUri: OAuth redirect URI (REQUIRED)
 * - scopes: Space-separated scopes (optional, uses default)
 *
 * Returns:
 * - authorizationUrl: URL to redirect user to
 * - state: CSRF token (client must verify on callback)
 * - codeVerifier: PKCE verifier (client must store for callback)
 * - host: GitLab host used
 */
async function handleOAuthAuthorize(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  // Client provides their OAuth credentials
  const clientId = url.searchParams.get("clientId");
  const redirectUri = url.searchParams.get("redirectUri");
  const host = url.searchParams.get("host") || config.GITLAB_DEFAULT_HOST;
  const scopes = url.searchParams.get("scopes") || config.OAUTH_DEFAULT_SCOPES;

  // Validate required parameters
  if (!clientId) {
    sendJson(res, 400, {
      error: "Missing required parameter",
      message: "clientId is required",
    });
    return;
  }

  if (!redirectUri) {
    sendJson(res, 400, {
      error: "Missing required parameter",
      message: "redirectUri is required",
    });
    return;
  }

  // Generate PKCE and state
  const { codeVerifier, codeChallenge } = generatePKCE();
  const state = generateState();

  // Build authorization URL
  const authorizationUrl = generateAuthorizationUrl({
    host,
    clientId,
    redirectUri,
    scopes,
    state,
    codeChallenge,
  });

  logger.info(`Generated authorization URL for ${host}`);

  sendJson(res, 200, {
    authorizationUrl,
    state,
    codeVerifier,  // Client must store this for callback
    host,
  });
}

/**
 * POST /oauth/callback
 * Exchange authorization code for tokens
 *
 * Body (JSON) - Client provides their OAuth credentials:
 * - code: Authorization code from GitLab (REQUIRED)
 * - codeVerifier: PKCE verifier from authorize step (REQUIRED)
 * - clientId: GitLab OAuth Application ID (REQUIRED)
 * - clientSecret: GitLab OAuth Application Secret (REQUIRED)
 * - redirectUri: OAuth redirect URI (REQUIRED)
 * - host: GitLab host (optional, defaults to gitlab.com)
 *
 * Returns:
 * - accessToken, refreshToken, expiresIn, expiresAt, tokenType, scope
 * - host: GitLab host used
 * - user: Current user info
 */
async function handleOAuthCallback(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);
  const {
    code,
    codeVerifier,
    clientId,
    clientSecret,
    redirectUri,
    host = config.GITLAB_DEFAULT_HOST,
  } = body;

  // Validate required parameters
  if (!code) {
    sendJson(res, 400, { error: "Missing required parameter", message: "code is required" });
    return;
  }
  if (!codeVerifier) {
    sendJson(res, 400, { error: "Missing required parameter", message: "codeVerifier is required" });
    return;
  }
  if (!clientId) {
    sendJson(res, 400, { error: "Missing required parameter", message: "clientId is required" });
    return;
  }
  if (!clientSecret) {
    sendJson(res, 400, { error: "Missing required parameter", message: "clientSecret is required" });
    return;
  }
  if (!redirectUri) {
    sendJson(res, 400, { error: "Missing required parameter", message: "redirectUri is required" });
    return;
  }

  try {
    // Exchange code for tokens using client-provided credentials
    const tokens = await exchangeCodeForTokens(
      host,
      code,
      clientId,
      clientSecret,
      redirectUri,
      codeVerifier
    );

    // Fetch current user info
    const userResponse = await fetch(`https://${host}/api/v4/user`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Accept: "application/json",
      },
    });

    let user = null;
    if (userResponse.ok) {
      user = await userResponse.json();
    }

    logger.info(`OAuth callback successful for ${host}`);

    sendJson(res, 200, {
      ...tokens,
      host,
      user,
    });
  } catch (error) {
    logger.error("OAuth callback failed", error);
    sendJson(res, 500, {
      error: "OAuth callback failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /oauth/refresh
 * Refresh access token
 *
 * Body (JSON) - Client provides their OAuth credentials:
 * - refreshToken: Refresh token from previous auth (REQUIRED)
 * - clientId: GitLab OAuth Application ID (REQUIRED)
 * - clientSecret: GitLab OAuth Application Secret (REQUIRED)
 * - host: GitLab host (optional, defaults to gitlab.com)
 *
 * Returns:
 * - accessToken, refreshToken, expiresIn, expiresAt, tokenType, scope
 * - host: GitLab host used
 */
async function handleOAuthRefresh(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);
  const {
    refreshToken,
    clientId,
    clientSecret,
    host = config.GITLAB_DEFAULT_HOST,
  } = body;

  // Validate required parameters
  if (!refreshToken) {
    sendJson(res, 400, { error: "Missing required parameter", message: "refreshToken is required" });
    return;
  }
  if (!clientId) {
    sendJson(res, 400, { error: "Missing required parameter", message: "clientId is required" });
    return;
  }
  if (!clientSecret) {
    sendJson(res, 400, { error: "Missing required parameter", message: "clientSecret is required" });
    return;
  }

  try {
    // Refresh token using client-provided credentials
    const tokens = await refreshAccessToken(
      host,
      refreshToken,
      clientId,
      clientSecret
    );

    logger.info(`Token refreshed for ${host}`);

    sendJson(res, 200, {
      ...tokens,
      host,
    });
  } catch (error) {
    logger.error("Token refresh failed", error);
    sendJson(res, 500, {
      error: "Token refresh failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /oauth/revoke
 * Revoke access or refresh token
 *
 * Body (JSON) - Client provides their OAuth credentials:
 * - token: Token to revoke - access or refresh (REQUIRED)
 * - clientId: GitLab OAuth Application ID (REQUIRED)
 * - clientSecret: GitLab OAuth Application Secret (REQUIRED)
 * - host: GitLab host (optional, defaults to gitlab.com)
 */
async function handleOAuthRevoke(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const body = await parseJsonBody(req);
  const {
    token,
    clientId,
    clientSecret,
    host = config.GITLAB_DEFAULT_HOST,
  } = body;

  // Validate required parameters
  if (!token) {
    sendJson(res, 400, { error: "Missing required parameter", message: "token is required" });
    return;
  }
  if (!clientId) {
    sendJson(res, 400, { error: "Missing required parameter", message: "clientId is required" });
    return;
  }
  if (!clientSecret) {
    sendJson(res, 400, { error: "Missing required parameter", message: "clientSecret is required" });
    return;
  }

  try {
    // Revoke token using client-provided credentials
    await revokeToken(
      host,
      token,
      clientId,
      clientSecret
    );

    logger.info(`Token revoked for ${host}`);

    sendJson(res, 200, { success: true, host });
  } catch (error) {
    logger.error("Token revocation failed", error);
    sendJson(res, 500, {
      error: "Token revocation failed",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * GET /oauth/user
 * Get current user info using access token
 *
 * Headers:
 * - Authorization: Bearer <accessToken>
 * - x-gitlab-host: GitLab host (optional)
 */
async function handleOAuthUser(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const auth = extractGitLabAuth(req.headers as Record<string, string | string[] | undefined>);

  if (!auth) {
    sendJson(res, 401, {
      error: "Unauthorized",
      message: "Authorization header with Bearer token required",
    });
    return;
  }

  try {
    const userResponse = await fetch(`https://${auth.host}/api/v4/user`, {
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        Accept: "application/json",
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.json().catch(() => ({}));
      throw new Error(error.message || userResponse.statusText);
    }

    const user = await userResponse.json();

    sendJson(res, 200, { user, host: auth.host });
  } catch (error) {
    logger.error("Failed to fetch user", error);
    sendJson(res, 500, {
      error: "Failed to fetch user",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * POST /mcp
 * MCP protocol endpoint
 */
async function handleMcp(
  req: IncomingMessage,
  res: ServerResponse,
  transport: StreamableHTTPServerTransport
): Promise<void> {
  // Extract auth from headers
  const auth = extractGitLabAuth(req.headers as Record<string, string | string[] | undefined>);

  if (!auth) {
    sendJson(res, 401, {
      error: "Unauthorized",
      message: "Authorization header required. Use 'Bearer <token>' format.",
    });
    return;
  }

  // Set auth for current request (request-scoped)
  setCurrentAuth(auth);

  try {
    await transport.handleRequest(req, res);
  } finally {
    // Clear auth after request
    setCurrentAuth(null);
  }
}

// ============================================================
// Server Setup
// ============================================================

const httpServer = createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-gitlab-host, mcp-session-id"
  );

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const path = url.pathname;

  try {
    // Route handling
    if (path === "/health" && req.method === "GET") {
      await handleHealth(res);
    } else if (path === "/oauth/authorize" && req.method === "GET") {
      await handleOAuthAuthorize(req, res);
    } else if (path === "/oauth/callback" && req.method === "POST") {
      await handleOAuthCallback(req, res);
    } else if (path === "/oauth/refresh" && req.method === "POST") {
      await handleOAuthRefresh(req, res);
    } else if (path === "/oauth/revoke" && req.method === "POST") {
      await handleOAuthRevoke(req, res);
    } else if (path === "/oauth/user" && req.method === "GET") {
      await handleOAuthUser(req, res);
    } else if (path === "/mcp" && req.method === "POST") {
      await handleMcp(req, res, transport);
    } else {
      sendJson(res, 404, { error: "Not found" });
    }
  } catch (error) {
    logger.error("Request handler error", error);
    sendJson(res, 500, {
      error: "Internal server error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
```

**HTTP Endpoints Summary:**

| Method | Path | Client Provides | Description |
|--------|------|-----------------|-------------|
| `GET` | `/health` | - | Health check |
| `GET` | `/oauth/authorize` | `clientId`, `redirectUri`, `host?`, `scopes?` | Generate authorization URL with PKCE |
| `POST` | `/oauth/callback` | `code`, `codeVerifier`, `clientId`, `clientSecret`, `redirectUri`, `host?` | Exchange code for tokens |
| `POST` | `/oauth/refresh` | `refreshToken`, `clientId`, `clientSecret`, `host?` | Refresh access token |
| `POST` | `/oauth/revoke` | `token`, `clientId`, `clientSecret`, `host?` | Revoke token |
| `GET` | `/oauth/user` | `Authorization` header, `x-gitlab-host?` header | Get current user info |
| `POST` | `/mcp` | `Authorization` header, `x-gitlab-host?` header | MCP protocol endpoint |

**Note**: `?` indicates optional parameter. All OAuth endpoints require client to provide their own credentials.

---

## MCP Tools (45+ tools)

### Projects (8 tools) - `projects.tool.ts`

| Tool | GitLab API | Description |
|------|------------|-------------|
| `gitlab_list_projects` | `GET /projects` | List projects with filters |
| `gitlab_get_project` | `GET /projects/:id` | Get project by ID or path |
| `gitlab_create_project` | `POST /projects` | Create new project |
| `gitlab_update_project` | `PUT /projects/:id` | Update project settings |
| `gitlab_delete_project` | `DELETE /projects/:id` | Delete project |
| `gitlab_fork_project` | `POST /projects/:id/fork` | Fork a project |
| `gitlab_list_project_members` | `GET /projects/:id/members` | List project members |
| `gitlab_star_project` | `POST /projects/:id/star` | Star a project |

### Issues (9 tools) - `issues.tool.ts`

| Tool | GitLab API | Description |
|------|------------|-------------|
| `gitlab_list_issues` | `GET /projects/:id/issues` | List project issues |
| `gitlab_get_issue` | `GET /projects/:id/issues/:iid` | Get issue by IID |
| `gitlab_create_issue` | `POST /projects/:id/issues` | Create new issue |
| `gitlab_update_issue` | `PUT /projects/:id/issues/:iid` | Update issue |
| `gitlab_delete_issue` | `DELETE /projects/:id/issues/:iid` | Delete issue |
| `gitlab_close_issue` | `PUT /projects/:id/issues/:iid` | Close issue (state_event=close) |
| `gitlab_reopen_issue` | `PUT /projects/:id/issues/:iid` | Reopen issue (state_event=reopen) |
| `gitlab_list_issue_notes` | `GET /projects/:id/issues/:iid/notes` | List issue comments |
| `gitlab_create_issue_note` | `POST /projects/:id/issues/:iid/notes` | Add issue comment |

### Merge Requests (12 tools) - `merge-requests.tool.ts`

| Tool | GitLab API | Description |
|------|------------|-------------|
| `gitlab_list_merge_requests` | `GET /projects/:id/merge_requests` | List MRs with filters |
| `gitlab_get_merge_request` | `GET /projects/:id/merge_requests/:iid` | Get MR details |
| `gitlab_create_merge_request` | `POST /projects/:id/merge_requests` | Create new MR |
| `gitlab_update_merge_request` | `PUT /projects/:id/merge_requests/:iid` | Update MR |
| `gitlab_delete_merge_request` | `DELETE /projects/:id/merge_requests/:iid` | Delete MR |
| `gitlab_merge_merge_request` | `PUT /projects/:id/merge_requests/:iid/merge` | Accept and merge MR |
| `gitlab_approve_merge_request` | `POST /projects/:id/merge_requests/:iid/approve` | Approve MR |
| `gitlab_unapprove_merge_request` | `POST /projects/:id/merge_requests/:iid/unapprove` | Remove approval |
| `gitlab_list_mr_commits` | `GET /projects/:id/merge_requests/:iid/commits` | List MR commits |
| `gitlab_list_mr_changes` | `GET /projects/:id/merge_requests/:iid/changes` | List MR file changes |
| `gitlab_list_mr_notes` | `GET /projects/:id/merge_requests/:iid/notes` | List MR comments |
| `gitlab_create_mr_note` | `POST /projects/:id/merge_requests/:iid/notes` | Add MR comment |

### Branches (5 tools) - `branches.tool.ts`

| Tool | GitLab API | Description |
|------|------------|-------------|
| `gitlab_list_branches` | `GET /projects/:id/repository/branches` | List branches |
| `gitlab_get_branch` | `GET /projects/:id/repository/branches/:branch` | Get branch details |
| `gitlab_create_branch` | `POST /projects/:id/repository/branches` | Create branch |
| `gitlab_delete_branch` | `DELETE /projects/:id/repository/branches/:branch` | Delete branch |
| `gitlab_protect_branch` | `POST /projects/:id/protected_branches` | Protect branch |

### Commits (4 tools) - `commits.tool.ts`

| Tool | GitLab API | Description |
|------|------------|-------------|
| `gitlab_list_commits` | `GET /projects/:id/repository/commits` | List commits |
| `gitlab_get_commit` | `GET /projects/:id/repository/commits/:sha` | Get commit details |
| `gitlab_get_commit_diff` | `GET /projects/:id/repository/commits/:sha/diff` | Get commit diff |
| `gitlab_cherry_pick_commit` | `POST /projects/:id/repository/commits/:sha/cherry_pick` | Cherry-pick commit |

### Pipelines (6 tools) - `pipelines.tool.ts`

| Tool | GitLab API | Description |
|------|------------|-------------|
| `gitlab_list_pipelines` | `GET /projects/:id/pipelines` | List pipelines |
| `gitlab_get_pipeline` | `GET /projects/:id/pipelines/:pipeline_id` | Get pipeline details |
| `gitlab_create_pipeline` | `POST /projects/:id/pipeline` | Trigger new pipeline |
| `gitlab_retry_pipeline` | `POST /projects/:id/pipelines/:pipeline_id/retry` | Retry failed pipeline |
| `gitlab_cancel_pipeline` | `POST /projects/:id/pipelines/:pipeline_id/cancel` | Cancel pipeline |
| `gitlab_list_pipeline_jobs` | `GET /projects/:id/pipelines/:pipeline_id/jobs` | List pipeline jobs |

### Users & Groups (5 tools) - `users.tool.ts`

| Tool | GitLab API | Description |
|------|------------|-------------|
| `gitlab_get_current_user` | `GET /user` | Get authenticated user |
| `gitlab_get_user` | `GET /users/:id` | Get user by ID |
| `gitlab_search_users` | `GET /users?search=` | Search users |
| `gitlab_list_groups` | `GET /groups` | List groups |
| `gitlab_get_group` | `GET /groups/:id` | Get group details |

### Search (1 tool) - `search.tool.ts`

| Tool | GitLab API | Description |
|------|------------|-------------|
| `gitlab_search` | `GET /search` | Global search (projects, issues, MRs, etc.) |

---

## Request Headers

### For MCP Requests

**Required:**
```
Authorization: Bearer <access-token-or-pat>
```

**Optional:**
```
x-gitlab-host: gitlab.example.com
```
If not provided, defaults to `gitlab.com` (or `GITLAB_DEFAULT_HOST` env var).

### Auth Extraction (`src/utils/gitlab-client.ts`)

```typescript
export interface GitLabAuth {
  host: string;        // gitlab.com or custom domain
  accessToken: string; // OAuth access token or PAT
}

/**
 * Extract GitLab auth from request headers
 * Supports both OAuth tokens and Personal Access Tokens
 */
export function extractGitLabAuth(
  headers: Record<string, string | string[] | undefined>
): GitLabAuth | null {
  // Get authorization header
  const authHeader = headers["authorization"];
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }

  // Extract Bearer token
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!bearerMatch) {
    return null;
  }
  const accessToken = bearerMatch[1];

  // Get host from header or use default
  const hostHeader = headers["x-gitlab-host"];
  const host =
    typeof hostHeader === "string" ? hostHeader : config.GITLAB_DEFAULT_HOST;

  return { accessToken, host };
}
```

### Header Examples

**OAuth Token (after completing OAuth flow):**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer oauth-access-token-here" \
  -H "x-gitlab-host: gitlab.com" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gitlab_get_current_user","arguments":{}},"id":1}'
```

**Personal Access Token (fallback):**
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer glpat-your-personal-token" \
  -H "x-gitlab-host: gitlab.mycompany.com" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gitlab_list_projects","arguments":{}},"id":1}'
```

---

## Configuration (.env.example)

```env
# Server Configuration
PORT=3000
LOG_LEVEL=info

# GitLab Configuration
# Default host if x-gitlab-host header not provided
GITLAB_DEFAULT_HOST=gitlab.com

# Default OAuth Scopes (space-separated)
# Used if client doesn't specify scopes
OAUTH_DEFAULT_SCOPES=api read_user read_api read_repository write_repository
```

**Note**: OAuth credentials (client_id, client_secret) are **NOT** stored in env vars. They are passed dynamically by the client for each OAuth operation. This enables:
- Multi-tenant support (multiple customers, each with their own GitLab instance)
- Each GitLab instance has its own OAuth application
- Server remains stateless and doesn't store secrets

### `src/config.ts` (Minimal - No OAuth Secrets)

```typescript
import { z } from "zod";
import "dotenv/config";

const ConfigSchema = z.object({
  // Server Configuration
  PORT: z.coerce.number().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  // GitLab Configuration
  GITLAB_DEFAULT_HOST: z.string().default("gitlab.com"),

  // Default OAuth scopes (client can override)
  OAUTH_DEFAULT_SCOPES: z
    .string()
    .default("api read_user read_api read_repository write_repository"),
});

export const config = ConfigSchema.parse(process.env);
```

---

## Dynamic OAuth Credentials

### Design Principle

The MCP server is **stateless** and **multi-tenant**:
- Each customer/user provides their own GitLab OAuth credentials
- Credentials are passed per-request, not stored server-side
- Supports unlimited GitLab instances (gitlab.com + self-hosted)

### Credential Flow

```
┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│   Customer   │     │  MCP Server │     │   GitLab    │
│   Frontend   │     │  (stateless)│     │  Instance   │
└──────┬───────┘     └──────┬──────┘     └──────┬──────┘
       │                    │                    │
       │ Customer configures their GitLab app   │
       │ (stores clientId + clientSecret)       │
       │                    │                    │
       │ GET /oauth/authorize                   │
       │ { clientId, host, redirectUri }        │
       │───────────────────>│                    │
       │                    │                    │
       │ { authUrl, state, codeVerifier }       │
       │<───────────────────│                    │
       │                    │                    │
       │ User authorizes ──────────────────────>│
       │                    │                    │
       │ POST /oauth/callback                   │
       │ { code, codeVerifier, clientId,        │
       │   clientSecret, host, redirectUri }    │
       │───────────────────>│                    │
       │                    │ Exchange code     │
       │                    │──────────────────>│
       │                    │<──────────────────│
       │ { accessToken, refreshToken, ... }     │
       │<───────────────────│                    │
       │                    │                    │
       │ POST /oauth/refresh                    │
       │ { refreshToken, clientId,              │
       │   clientSecret, host }                 │
       │───────────────────>│                    │
       │                    │──────────────────>│
       │                    │<──────────────────│
       │ { accessToken, ... }                   │
       │<───────────────────│                    │
```

### Why This Approach?

| Static (Env Vars) | Dynamic (Per-Request) |
|-------------------|----------------------|
| Single GitLab instance | Multiple instances |
| Server stores secrets | Server is stateless |
| Single-tenant | Multi-tenant |
| Simpler setup | More flexible |
| Security risk (secrets in env) | Secrets stay with customer |

---

## Implementation Phases

### Phase 1: Foundation + OAuth (MVP)

**Step 1: Scaffold Server**
- Create directory structure following repository patterns
- Copy template files (logger.ts, tsconfig.json, etc.)
- Set up package.json with dependencies

**Step 2: Configuration**
- `src/config.ts` - Zod validation with OAuth env vars
- `.env.example` - Document all configuration options

**Step 3: OAuth Module**
- `src/utils/oauth.ts` - PKCE generation, token exchange, refresh, revoke
- Full OAuth 2.0 flow implementation

**Step 4: GitLab Client**
- `src/utils/gitlab-client.ts` - API wrapper with auth extraction
- Support both OAuth tokens and PATs
- Formatters for all entity types

**Step 5: HTTP Server with OAuth Endpoints**
- `src/index.ts` - HTTP server setup
- `GET /health` - Health check
- `GET /oauth/authorize` - Generate auth URL with PKCE
- `POST /oauth/callback` - Exchange code for tokens
- `POST /oauth/refresh` - Refresh access token
- `POST /oauth/revoke` - Revoke token
- `GET /oauth/user` - Get current user
- `POST /mcp` - MCP protocol endpoint

**Step 6: MCP Server**
- `src/server.ts` - MCP server setup with auth context
- Request-scoped auth management

**Step 7: Priority Tools**
- `gitlab_get_current_user` - Verify auth works
- `gitlab_list_projects` - List with filters
- `gitlab_get_project` - Get by ID or path
- `gitlab_create_project` - Create new project

### Phase 2: Core Tools

**Step 8: Issue Tools**
- `gitlab_list_issues`, `gitlab_get_issue`
- `gitlab_create_issue`, `gitlab_update_issue`
- `gitlab_close_issue`, `gitlab_reopen_issue`

**Step 9: Merge Request Tools**
- `gitlab_list_merge_requests`, `gitlab_get_merge_request`
- `gitlab_create_merge_request`, `gitlab_update_merge_request`
- `gitlab_merge_merge_request`

**Step 10: Branch Tools**
- `gitlab_list_branches`, `gitlab_get_branch`
- `gitlab_create_branch`, `gitlab_delete_branch`

### Phase 3: Complete Toolset

**Step 11: Notes/Comments**
- `gitlab_list_issue_notes`, `gitlab_create_issue_note`
- `gitlab_list_mr_notes`, `gitlab_create_mr_note`

**Step 12: MR Advanced**
- `gitlab_approve_merge_request`, `gitlab_unapprove_merge_request`
- `gitlab_list_mr_commits`, `gitlab_list_mr_changes`

**Step 13: Pipeline Tools**
- `gitlab_list_pipelines`, `gitlab_get_pipeline`
- `gitlab_create_pipeline`, `gitlab_retry_pipeline`
- `gitlab_cancel_pipeline`, `gitlab_list_pipeline_jobs`

**Step 14: Additional Tools**
- `gitlab_fork_project`, `gitlab_delete_project`
- `gitlab_list_project_members`, `gitlab_star_project`
- `gitlab_list_groups`, `gitlab_get_group`
- `gitlab_search`

### Phase 4: Testing & Documentation

**Step 15: Tests**
- Unit tests for oauth.ts functions
- Unit tests for formatters
- Integration tests for tools (mocked API)

**Step 16: Documentation**
- README.md with OAuth setup guide
- Docker configuration
- Example usage

---

## Docker Configuration

### Dockerfile
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 mcp
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
RUN chown -R mcp:nodejs /app
USER mcp
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "build/index.js"]
```

### docker-compose.yml
```yaml
version: "3.8"
services:
  mcp-server-gitlab:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3011:3000"
    environment:
      - PORT=3000
      - LOG_LEVEL=info
      - GITLAB_DEFAULT_HOST=gitlab.com
      - OAUTH_DEFAULT_SCOPES=api read_user read_api read_repository write_repository
    restart: unless-stopped
```

**Note**: No OAuth secrets in server configuration. Credentials are provided by clients per-request, enabling multi-tenant support.

---

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.0.0"
  }
}
```

**Note**: No GitLab SDK - using native `fetch()` for API calls (GitLab doesn't have an official Node.js SDK like GitHub's Octokit).

---

## Key Implementation Notes

1. **No GitLab SDK** - Unlike GitHub (Octokit), GitLab doesn't have an official Node SDK. Use native `fetch()`.

2. **Project ID formats** - GitLab accepts both numeric ID (`123`) and URL-encoded path (`namespace%2Fproject`). Support both.

3. **IID vs ID** - Issues and MRs use `iid` (internal ID within project) in URLs, not the global `id`.

4. **Pagination** - GitLab uses offset-based pagination with `page` and `per_page` params. Support pagination in list tools.

5. **Rate Limiting** - GitLab has rate limits (varies by plan). Consider implementing retry logic.

6. **Self-hosted compatibility** - Some features may not be available on all self-hosted versions. Handle gracefully.

7. **Error responses** - GitLab returns errors in `{ message: string, error: string }` format.

---

## Testing Strategy

### 1. Unit Tests

**OAuth Module Tests (`tests/utils/oauth.test.ts`):**
```typescript
import { describe, it, expect } from "vitest";
import { generatePKCE, generateState } from "../src/utils/oauth.js";

describe("PKCE", () => {
  it("should generate valid code verifier and challenge", () => {
    const { codeVerifier, codeChallenge } = generatePKCE();

    // Verifier: 43-128 URL-safe characters
    expect(codeVerifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);

    // Challenge: base64url encoded SHA-256
    expect(codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(codeChallenge.length).toBeGreaterThan(0);
  });

  it("should generate different values each time", () => {
    const pkce1 = generatePKCE();
    const pkce2 = generatePKCE();

    expect(pkce1.codeVerifier).not.toBe(pkce2.codeVerifier);
    expect(pkce1.codeChallenge).not.toBe(pkce2.codeChallenge);
  });
});

describe("State", () => {
  it("should generate cryptographically random state", () => {
    const state1 = generateState();
    const state2 = generateState();

    expect(state1).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(state1).not.toBe(state2);
  });
});
```

**Auth Extraction Tests (`tests/utils/gitlab-client.test.ts`):**
```typescript
import { describe, it, expect } from "vitest";
import { extractGitLabAuth } from "../src/utils/gitlab-client.js";

describe("extractGitLabAuth", () => {
  it("should extract Bearer token and default host", () => {
    const auth = extractGitLabAuth({
      authorization: "Bearer my-token-here",
    });

    expect(auth).toEqual({
      accessToken: "my-token-here",
      host: "gitlab.com",
    });
  });

  it("should extract custom host from header", () => {
    const auth = extractGitLabAuth({
      authorization: "Bearer my-token",
      "x-gitlab-host": "gitlab.mycompany.com",
    });

    expect(auth?.host).toBe("gitlab.mycompany.com");
  });

  it("should return null for missing auth header", () => {
    const auth = extractGitLabAuth({});
    expect(auth).toBeNull();
  });

  it("should return null for non-Bearer auth", () => {
    const auth = extractGitLabAuth({
      authorization: "Basic dXNlcjpwYXNz",
    });
    expect(auth).toBeNull();
  });
});
```

### 2. Integration Tests (Mocked API)

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("OAuth token exchange", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should exchange code for tokens", async () => {
    // Mock fetch
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 7200,
        token_type: "Bearer",
        scope: "api read_user",
        created_at: 1234567890,
      }),
    }));

    const { exchangeCodeForTokens } = await import("../src/utils/oauth.js");

    const tokens = await exchangeCodeForTokens(
      "gitlab.com",
      "auth-code",
      "client-id",
      "client-secret",
      "http://localhost:3000/oauth/callback",
      "code-verifier"
    );

    expect(tokens.accessToken).toBe("access-token");
    expect(tokens.refreshToken).toBe("refresh-token");
    expect(tokens.expiresAt).toBeGreaterThan(Date.now());
  });
});
```

### 3. Manual Testing

**OAuth Flow (Multi-Tenant - Dynamic Credentials):**
```bash
# Customer's GitLab OAuth app credentials (stored by customer, not server)
CLIENT_ID="customer-app-id"
CLIENT_SECRET="customer-app-secret"
REDIRECT_URI="https://customer-app.com/oauth/callback"
HOST="gitlab.com"

# Step 1: Get authorization URL (client provides clientId)
curl "http://localhost:3000/oauth/authorize?clientId=${CLIENT_ID}&redirectUri=${REDIRECT_URI}&host=${HOST}"
# Returns: { authorizationUrl, state, codeVerifier, host }

# Step 2: User visits authorizationUrl in browser, authorizes, gets redirected with code

# Step 3: Exchange code for tokens (client provides ALL credentials)
curl -X POST http://localhost:3000/oauth/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "authorization-code-from-redirect",
    "codeVerifier": "verifier-from-step-1",
    "clientId": "'"$CLIENT_ID"'",
    "clientSecret": "'"$CLIENT_SECRET"'",
    "redirectUri": "'"$REDIRECT_URI"'",
    "host": "'"$HOST"'"
  }'
# Returns: { accessToken, refreshToken, expiresAt, host, user, ... }

# Step 4: Use token for MCP requests
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer access-token-from-step-3" \
  -H "x-gitlab-host: gitlab.com" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gitlab_get_current_user","arguments":{}},"id":1}'

# Step 5: Refresh token when expired (client provides credentials again)
curl -X POST http://localhost:3000/oauth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "refresh-token-from-step-3",
    "clientId": "'"$CLIENT_ID"'",
    "clientSecret": "'"$CLIENT_SECRET"'",
    "host": "'"$HOST"'"
  }'
```

**Self-hosted GitLab (Different Customer):**
```bash
# Another customer with their own self-hosted GitLab
CUSTOMER2_HOST="gitlab.acme-corp.com"
CUSTOMER2_CLIENT_ID="acme-app-id"
CUSTOMER2_CLIENT_SECRET="acme-app-secret"
CUSTOMER2_REDIRECT_URI="https://acme-internal.com/oauth/callback"

# Get auth URL for their self-hosted instance
curl "http://localhost:3000/oauth/authorize?clientId=${CUSTOMER2_CLIENT_ID}&redirectUri=${CUSTOMER2_REDIRECT_URI}&host=${CUSTOMER2_HOST}"

# Exchange code (client provides their credentials)
curl -X POST http://localhost:3000/oauth/callback \
  -H "Content-Type: application/json" \
  -d '{
    "code": "auth-code",
    "codeVerifier": "verifier",
    "clientId": "'"$CUSTOMER2_CLIENT_ID"'",
    "clientSecret": "'"$CUSTOMER2_CLIENT_SECRET"'",
    "redirectUri": "'"$CUSTOMER2_REDIRECT_URI"'",
    "host": "'"$CUSTOMER2_HOST"'"
  }'

# MCP request to their self-hosted GitLab
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer token" \
  -H "x-gitlab-host: gitlab.acme-corp.com" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gitlab_list_projects","arguments":{"owned":true}},"id":1}'
```

---

## References

### GitLab API Documentation
- REST API: https://docs.gitlab.com/api/rest/
- Projects API: https://docs.gitlab.com/api/projects/
- Issues API: https://docs.gitlab.com/api/issues/
- Merge Requests API: https://docs.gitlab.com/api/merge_requests/
- Authentication: https://docs.gitlab.com/api/rest/authentication/
- OAuth 2.0: https://docs.gitlab.com/api/oauth2/

### Existing Server References
- GitHub pattern: `/servers/mcp-server-github/`
- Jira Cloud OAuth: `/servers/mcp-server-jira-cloud/`
- Jira Datacenter (self-hosted): `/servers/mcp-server-jira-datacenter/`

---

## Verification Steps

### 1. Build & Run

```bash
cd servers/mcp-server-gitlab
npm install && npm run build
npm start
```

### 2. Health Check

```bash
curl http://localhost:3000/health
# Expected: {"status":"ok","server":"mcp-server-gitlab","timestamp":"..."}
```

### 3. Test OAuth Authorization (Dynamic Credentials)

```bash
# Client provides their own OAuth app credentials
CLIENT_ID="your-gitlab-app-id"
REDIRECT_URI="http://localhost:3000/oauth/callback"
HOST="gitlab.com"  # or your self-hosted GitLab

# Get authorization URL
curl "http://localhost:3000/oauth/authorize?clientId=${CLIENT_ID}&redirectUri=${REDIRECT_URI}&host=${HOST}"

# Expected:
# {
#   "authorizationUrl": "https://gitlab.com/oauth/authorize?client_id=...&code_challenge=...",
#   "state": "random-state-string",
#   "codeVerifier": "random-verifier-string",
#   "host": "gitlab.com"
# }

# Missing clientId returns error:
curl "http://localhost:3000/oauth/authorize"
# { "error": "Missing required parameter", "message": "clientId is required" }
```

### 4. Complete OAuth Flow (Dynamic Credentials)

```bash
# Customer's GitLab OAuth app credentials
CLIENT_ID="your-gitlab-app-id"
CLIENT_SECRET="your-gitlab-app-secret"
REDIRECT_URI="http://localhost:3000/oauth/callback"
HOST="gitlab.com"

# Step 1: Get authorization URL
AUTH_RESPONSE=$(curl -s "http://localhost:3000/oauth/authorize?clientId=${CLIENT_ID}&redirectUri=${REDIRECT_URI}&host=${HOST}")
echo $AUTH_RESPONSE | jq .

# Step 2: Extract values
AUTH_URL=$(echo $AUTH_RESPONSE | jq -r .authorizationUrl)
CODE_VERIFIER=$(echo $AUTH_RESPONSE | jq -r .codeVerifier)
STATE=$(echo $AUTH_RESPONSE | jq -r .state)

# Step 3: Open auth URL in browser
echo "Open this URL in browser: $AUTH_URL"
# User authorizes and gets redirected with ?code=xxx&state=xxx

# Step 4: Exchange code for tokens (client provides ALL credentials)
curl -X POST http://localhost:3000/oauth/callback \
  -H "Content-Type: application/json" \
  -d "{
    \"code\": \"YOUR_CODE_HERE\",
    \"codeVerifier\": \"$CODE_VERIFIER\",
    \"clientId\": \"$CLIENT_ID\",
    \"clientSecret\": \"$CLIENT_SECRET\",
    \"redirectUri\": \"$REDIRECT_URI\",
    \"host\": \"$HOST\"
  }"

# Expected:
# {
#   "accessToken": "...",
#   "refreshToken": "...",
#   "expiresIn": 7200,
#   "expiresAt": 1234567890000,
#   "tokenType": "Bearer",
#   "scope": "api read_user ...",
#   "host": "gitlab.com",
#   "user": { "id": 1, "username": "...", ... }
# }
```

### 5. Test MCP with OAuth Token

```bash
# Use the access token from Step 4
ACCESS_TOKEN="your-access-token-from-step-4"

# Get current user via MCP
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gitlab_get_current_user","arguments":{}},"id":1}'

# List projects
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gitlab_list_projects","arguments":{"owned":true,"per_page":5}},"id":1}'
```

### 6. Test Token Refresh (Dynamic Credentials)

```bash
# Client provides credentials for refresh too
REFRESH_TOKEN="your-refresh-token"
CLIENT_ID="your-gitlab-app-id"
CLIENT_SECRET="your-gitlab-app-secret"
HOST="gitlab.com"

curl -X POST http://localhost:3000/oauth/refresh \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\",
    \"clientId\": \"$CLIENT_ID\",
    \"clientSecret\": \"$CLIENT_SECRET\",
    \"host\": \"$HOST\"
  }"

# Expected: New accessToken, refreshToken, expiresAt, host
```

### 7. Test Self-Hosted GitLab (Different Customer)

```bash
# Each customer has their own GitLab instance and OAuth app
CUSTOMER_HOST="gitlab.mycompany.com"
CUSTOMER_CLIENT_ID="customer-app-id"
CUSTOMER_CLIENT_SECRET="customer-app-secret"
CUSTOMER_REDIRECT_URI="https://app.customer.com/oauth/callback"

# Get auth URL for customer's self-hosted instance
curl "http://localhost:3000/oauth/authorize?clientId=${CUSTOMER_CLIENT_ID}&redirectUri=${CUSTOMER_REDIRECT_URI}&host=${CUSTOMER_HOST}"

# After OAuth flow, use token with custom host
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "x-gitlab-host: gitlab.mycompany.com" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gitlab_list_projects","arguments":{}},"id":1}'
```

### 8. Test PAT Fallback

```bash
# Personal Access Tokens still work without OAuth flow
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer glpat-your-personal-access-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"gitlab_get_current_user","arguments":{}},"id":1}'
```

---

## Summary

This plan creates a unified GitLab MCP server that:

- **OAuth 2.0 with PKCE** as primary authentication method
- **Multi-tenant by design** - OAuth credentials passed dynamically per-request
- Supports **unlimited GitLab instances** (gitlab.com + any self-hosted) via `x-gitlab-host` header
- **Server stores NO secrets** - each customer provides their own OAuth app credentials
- **PAT fallback** for backward compatibility and CI/CD workflows
- Provides **45+ tools** covering projects, issues, merge requests, branches, pipelines, and users
- **Fully stateless** - no server-side session or credential storage

### OAuth Flow Summary

```
Client                    MCP Server                   GitLab
  │                           │                           │
  │ GET /oauth/authorize      │                           │
  │ ─────────────────────────>│                           │
  │                           │ Generate PKCE + state     │
  │ { authUrl, verifier }     │                           │
  │ <─────────────────────────│                           │
  │                           │                           │
  │ User visits authUrl ─────────────────────────────────>│
  │                           │                           │
  │ Redirect with code  <─────────────────────────────────│
  │                           │                           │
  │ POST /oauth/callback      │                           │
  │ { code, codeVerifier }    │                           │
  │ ─────────────────────────>│                           │
  │                           │ POST /oauth/token         │
  │                           │ ─────────────────────────>│
  │                           │                           │
  │                           │ { access_token, ... }     │
  │                           │ <─────────────────────────│
  │ { accessToken, ... }      │                           │
  │ <─────────────────────────│                           │
  │                           │                           │
  │ POST /mcp (with token)    │                           │
  │ ─────────────────────────>│ GET /api/v4/...          │
  │                           │ ─────────────────────────>│
  │                           │ <─────────────────────────│
  │ { result }                │                           │
  │ <─────────────────────────│                           │
```

---

## GitLab Application Setup

To use OAuth, you need to create a GitLab application:

### For GitLab.com

1. Go to https://gitlab.com/-/profile/applications (or User Settings → Applications)
2. Create new application:
   - **Name**: `MCP Server GitLab` (or your choice)
   - **Redirect URI**: `http://localhost:3000/oauth/callback` (adjust for your deployment)
   - **Confidential**: Yes (checked)
   - **Scopes**: Select `api`, `read_user`, `read_api`, `read_repository`, `write_repository`
3. Click "Save application"
4. Copy **Application ID** and **Secret** to your `.env` file

### For Self-Hosted GitLab

1. Go to `https://your-gitlab.com/-/profile/applications`
2. Follow same steps as above
3. Ensure redirect URI matches your MCP server deployment URL

### Group/Instance-Level Applications

For organization-wide use:
1. Go to Group Settings → Applications (group admin)
2. Or Admin Area → Applications (instance admin)
3. Create application with same settings

---

## Security Considerations

### Multi-Tenant Security

1. **No Server-Side Secrets**: MCP server never stores OAuth credentials - eliminates risk of credential exposure from server breach
2. **Per-Request Credentials**: Each OAuth operation requires client to provide credentials - no shared secrets between tenants
3. **Customer Isolation**: Each customer's credentials are independent - one customer's breach doesn't affect others
4. **Credential Ownership**: Customers maintain full control of their OAuth app credentials

### OAuth Security

5. **PKCE (S256)**: Prevents authorization code interception attacks
6. **State Parameter**: Prevents CSRF attacks - client must verify state matches on callback
7. **HTTPS Required**: Always use HTTPS in production for redirect URIs and API calls
8. **Token Storage**: Client is responsible for secure token storage (encrypted at rest)
9. **Refresh Before Expiry**: Client should refresh tokens before expiration to avoid service interruption
10. **Scope Minimization**: Request only scopes actually needed for the use case
11. **Token Revocation**: Use `/oauth/revoke` when user logs out or access should be removed

### Client Responsibilities

| Responsibility | Description |
|----------------|-------------|
| Store OAuth App credentials securely | Customer's clientId and clientSecret |
| Store user tokens securely | accessToken, refreshToken (encrypted) |
| Verify state parameter | Compare state on callback with authorize response |
| Store PKCE verifier | Between authorize and callback steps |
| Implement token refresh | Before accessToken expires |
| Use HTTPS | For all redirect URIs and API calls |

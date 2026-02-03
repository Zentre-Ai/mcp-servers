# MCP Servers Repository - Claude Coding Standards

## Project Overview

This repository contains MCP (Model Context Protocol) servers for integrating external systems with AI assistants like Claude Desktop, Cursor, VS Code, and other MCP-compatible clients.

**Technology Stack:**
- Node.js with TypeScript
- @modelcontextprotocol/sdk for MCP implementation
- Zod for schema validation
- Vitest for testing
- Docker for containerization

---

## Architecture Standards

### Repository Structure

```
mcp-servers/
├── cli/                    # CLI scaffolding tool
├── template/               # Template for new servers
├── servers/                # Individual MCP servers
│   ├── mcp-server-github/
│   ├── mcp-server-slack/
│   └── ...
├── CLAUDE.md               # This file
└── package.json            # Root package with CLI script
```

### Individual Server Structure

Each MCP server follows this structure:

```
mcp-server-{name}/
├── src/
│   ├── tools/              # MCP tools (actions that modify state or call APIs)
│   ├── resources/          # MCP resources (read-only data access)
│   ├── prompts/            # MCP prompts (reusable AI prompt templates)
│   ├── utils/              # Shared utilities (logger, API clients)
│   ├── config.ts           # Configuration with Zod validation
│   ├── server.ts           # MCP server setup and registration
│   └── index.ts            # Entry point with transport selection
├── tests/
│   └── tools/              # Tool tests
├── mcp-config.json         # Server metadata and auth configuration
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json
```

---

## Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Tool files | `{name}.tool.ts` | `create-issue.tool.ts` |
| Resource files | `{name}.resource.ts` | `user-profile.resource.ts` |
| Prompt files | `{name}.prompt.ts` | `code-review.prompt.ts` |
| Test files | `{name}.test.ts` | `create-issue.test.ts` |
| Utility files | `{name}.ts` or `{name}-client.ts` | `github-client.ts` |

**Tool/Resource naming:**
- Use `snake_case` for tool and resource names in MCP registration
- Use descriptive, action-oriented names for tools (e.g., `create_issue`, `send_message`)
- Use noun-based names for resources (e.g., `user_profile`, `repository_list`)

---

## MCP Config Format (mcp-config.json)

Every MCP server must include a `mcp-config.json` file with standardized metadata.

### Basic Structure

```json
{
  "name": "mcp-server-{name}",
  "version": "1.0.0",
  "description": "MCP server for {Service} - brief description",
  "categories": ["Category"],
  "tutorial": "## Setup instructions in markdown...",
  "port": 3000,
  "auth": { ... },
  "tools": [
    { "name": "tool_name", "description": "Tool description" }
  ]
}
```

### Authentication Configuration

#### OAuth 2.0 Servers (Preferred)

```json
"auth": {
  "type": "oauth2",
  "label": "Service OAuth 2.0",
  "description": "OAuth 2.0 authentication description",
  "oauth2": {
    "authorizationUrl": "https://service.com/oauth/authorize",
    "tokenUrl": "https://service.com/oauth/token",
    "scopes": ["read", "write"],
    "pkce": true
  },
  "required": [
    { "header": "x-required-header", "description": "Description" }
  ],
  "optional": [
    { "header": "x-optional-header", "description": "Description", "default": "value" }
  ]
}
```

**OAuth2 specific fields:**
- `pkce`: Set to `true` if PKCE is supported (recommended)
- `dynamicCredentials`: Set to `true` if OAuth credentials are passed per-request (multi-tenant)
- `dynamicHost`: Set to `true` if host is dynamic (e.g., Keycloak, self-hosted GitLab)
- `multiDatacenter`: Set to `true` if service has multiple datacenters (e.g., Zoho)

#### Token/API Key Servers

```json
"auth": {
  "type": "token",
  "label": "Service Token",
  "description": "Token authentication description",
  "required": [
    { "header": "x-service-url", "description": "Service instance URL" },
    { "header": "x-service-token", "description": "API token" }
  ],
  "optional": []
}
```

#### Multiple Auth Options

For servers supporting multiple auth methods (e.g., API key OR basic auth):

```json
"auth": {
  "type": "api_key",
  "label": "Service Authentication",
  "description": "Supports API key or basic auth",
  "required": [
    { "header": "x-service-url", "description": "Service URL" }
  ],
  "oneOf": [
    {
      "type": "api_key",
      "label": "API Key (Recommended)",
      "headers": [
        { "header": "x-api-key", "description": "API key" }
      ]
    },
    {
      "type": "basic",
      "label": "Basic Auth",
      "headers": [
        { "header": "x-username", "description": "Username" },
        { "header": "x-password", "description": "Password" }
      ]
    }
  ]
}
```

### Auth Type Values

| Type | Description | Example Services |
|------|-------------|------------------|
| `oauth2` | OAuth 2.0 flow | GitHub, Slack, Google, GitLab, Stripe |
| `token` | Service account token | Grafana |
| `api_token` | API token auth | Jira Data Center |
| `api_key` | API key auth | Elasticsearch |
| `basic` | Username/password | Legacy systems |

### Important Rules

1. **Always use `oauth2`** (not `oauth`) for OAuth 2.0 authentication
2. **Never use `methods` array** - use the flat structure shown above
3. **Include `oauth2` object** with URLs and scopes for OAuth2 servers
4. **List all tools** with name and description

---

## Code Patterns

### Creating a Tool

Tools perform actions that may modify state or call external APIs.

**IMPORTANT:** Pass a raw Zod shape (object of Zod schemas), NOT a `z.object()`.

```typescript
import { z } from "zod";
import { server } from "../server.js";
import { logger } from "../utils/logger.js";

// Register the tool with a raw Zod shape
// CORRECT: Pass { key: z.schema() } directly
// WRONG: Don't use z.object({ ... })
server.tool(
  "create_issue",
  {
    repository: z.string().describe("Repository name in format owner/repo"),
    title: z.string().describe("Issue title"),
    body: z.string().optional().describe("Issue body/description"),
    labels: z.array(z.string()).optional().describe("Labels to apply"),
  },
  async ({ repository, title, body, labels }) => {
    try {
      logger.info(`Creating issue in ${repository}`);

      // Implementation here
      const issue = await githubClient.createIssue({
        repository,
        title,
        body,
        labels,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(issue, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to create issue", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);
```

### Creating a Resource

Resources provide read-only access to data.

```typescript
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { server } from "../server.js";
import { logger } from "../utils/logger.js";

// Resource with URI template
server.resource(
  "repository",
  new ResourceTemplate("repo://{owner}/{name}", { list: undefined }),
  async (uri, { owner, name }) => {
    logger.info(`Fetching repository ${owner}/${name}`);

    const repo = await githubClient.getRepository(owner, name);

    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(repo, null, 2),
        },
      ],
    };
  }
);
```

### Creating a Prompt

Prompts are reusable AI interaction templates.

```typescript
import { z } from "zod";
import { server } from "../server.js";

server.prompt(
  "code_review",
  {
    code: z.string().describe("Code to review"),
    language: z.string().describe("Programming language"),
    focus: z.enum(["security", "performance", "style", "all"]).optional(),
  },
  async ({ code, language, focus = "all" }) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Please review this ${language} code with focus on ${focus}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      },
    ],
  })
);
```

---

## Critical Rules

### Logging (CRITICAL)

**NEVER use `console.log()` in MCP servers** - it corrupts the STDIO JSON-RPC transport and will crash the server.

Always use the stderr logger:

```typescript
import { logger } from "../utils/logger.js";

// Correct usage
logger.debug("Debug message");
logger.info("Info message");
logger.warn("Warning message");
logger.error("Error message", error);

// NEVER do this in MCP servers:
// console.log("This will break STDIO transport!");
```

### Error Handling

Always return errors in MCP format with `isError: true`:

```typescript
try {
  // operation
} catch (error) {
  return {
    content: [
      {
        type: "text",
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      },
    ],
    isError: true,
  };
}
```

### Configuration

- All configuration via environment variables
- Validate with Zod in `src/config.ts`
- Document all variables in `.env.example`
- Never commit secrets or API keys

```typescript
// src/config.ts
import { z } from "zod";
import "dotenv/config";

const ConfigSchema = z.object({
  API_KEY: z.string().min(1, "API_KEY is required"),
  API_BASE_URL: z.string().url().default("https://api.example.com"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = ConfigSchema.parse(process.env);
```

---

## Transport Support

All servers support dual transport:

- **STDIO** (default): For local use with Claude Desktop, Cursor, etc.
- **HTTP/SSE**: For remote deployment

```bash
# STDIO mode (default)
node build/index.js --stdio

# HTTP mode
node build/index.js --http --port 3000
```

---

## Docker Guidelines

- Always use multi-stage builds for smaller images
- Use `node:22-alpine` as base image
- Expose port 3000 for HTTP transport
- Update Dockerfile when adding system dependencies

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3000
CMD ["node", "build/index.js", "--http"]
```

---

## Testing Guidelines

- Use Vitest for all tests
- Test tools by calling handler functions directly
- Mock external API calls
- Aim for high coverage on business logic

```typescript
import { describe, it, expect, vi } from "vitest";

describe("create_issue tool", () => {
  it("should create an issue successfully", async () => {
    // Mock external API
    vi.mock("../utils/github-client.js", () => ({
      createIssue: vi.fn().mockResolvedValue({ id: 1, title: "Test" }),
    }));

    // Test the tool handler
    const result = await createIssueHandler({
      repository: "owner/repo",
      title: "Test Issue",
    });

    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain("Test");
  });
});
```

---

## Common Tasks

### Creating a New MCP Server

Use the CLI scaffolding tool:

```bash
npm run create-server
```

**Do NOT manually copy template files.**

### Adding a New Tool to Existing Server

1. Create `src/tools/{name}.tool.ts` following the tool pattern above
2. Import in `src/server.ts` to register it
3. Add tests in `tests/tools/{name}.test.ts`
4. Update `mcp-config.json` tools array with new tool entry
5. Update README.md with tool documentation

### Adding External API Integration

1. Create API client in `src/utils/{service}-client.ts`
2. Add required env vars to `.env.example`
3. Add validation to `src/config.ts`
4. Create tools/resources that use the client

### Building and Running

```bash
# Development
npm run dev

# Build
npm run build

# Run built version
npm start

# Run with Docker
docker-compose up
```

---

## Code Quality

### Before Committing

1. Run linting: `npm run lint`
2. Run type check: `npm run typecheck`
3. Run tests: `npm test`
4. Ensure Docker builds: `docker build -t test .`

### Style Guide

- Use Prettier for formatting (configured in `.prettierrc`)
- Use ESLint for linting (configured in `.eslintrc.json`)
- Prefer explicit types over inference for function parameters
- Use descriptive variable and function names
- Add JSDoc comments for public APIs

---

## MCP Concepts Quick Reference

| Concept | Purpose | Example |
|---------|---------|---------|
| **Tool** | Actions that modify state | Create issue, send message, write file |
| **Resource** | Read-only data access | Fetch user profile, list repositories |
| **Prompt** | Reusable AI templates | Code review prompt, summarization prompt |

---

## Troubleshooting

### Server not responding
- Check if using `console.log` (breaks STDIO)
- Verify environment variables are set
- Check logs in stderr

### Docker container exits immediately
- Check environment variables in docker-compose.yml
- Verify the entrypoint command
- Check container logs: `docker logs <container>`

### Tests failing
- Ensure mocks are properly set up
- Check for async/await issues
- Verify test environment variables

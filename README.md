# MCP Servers

Collection of Model Context Protocol (MCP) servers for integrating external systems with AI assistants like Claude Desktop, Cursor, VS Code, and other MCP-compatible clients.

## Overview

This repository provides:

- **Template**: A production-ready template for building MCP servers
- **CLI**: A scaffolding tool to create new servers quickly
- **Servers**: Individual MCP server implementations

## Quick Start

### 1. Setup

```bash
# Install CLI dependencies
npm run setup
```

### 2. Create a New Server

```bash
npm run create-server
```

This will prompt you for:
- Server name (e.g., `github`, `slack`, `jira`)
- Description
- Author

A new server will be created in `servers/mcp-server-{name}/`.

### 3. Develop Your Server

```bash
cd servers/mcp-server-{name}

# Install dependencies (if not done during creation)
npm install

# Start development server
npm run dev
```

## Repository Structure

```
mcp-servers/
├── cli/                    # CLI scaffolding tool
│   └── src/
├── template/               # Server template
│   ├── src/
│   │   ├── tools/          # MCP tools
│   │   ├── resources/      # MCP resources
│   │   ├── prompts/        # MCP prompts
│   │   └── ...
│   ├── Dockerfile
│   └── ...
├── servers/                # Created MCP servers
│   ├── mcp-server-github/
│   ├── mcp-server-slack/
│   └── ...
├── CLAUDE.md               # AI coding standards
└── package.json
```

## MCP Concepts

| Concept | Description | Use Case |
|---------|-------------|----------|
| **Tools** | Actions that perform operations | Create issues, send messages, execute commands |
| **Resources** | Read-only data access | Fetch user profiles, list repositories |
| **Prompts** | Reusable AI templates | Code review prompts, summarization templates |

## Server Features

Each server includes:

- ✅ TypeScript with strict type checking
- ✅ Dual transport (STDIO + HTTP/SSE)
- ✅ Docker support with multi-stage builds
- ✅ ESLint + Prettier configuration
- ✅ Vitest testing setup
- ✅ GitHub Actions CI pipeline
- ✅ Environment-based configuration

## Development Workflow

### Adding Tools

```typescript
// src/tools/my-tool.tool.ts
import { z } from "zod";
import { server } from "../server.js";

server.tool(
  "my_tool",
  z.object({ param: z.string() }),
  async ({ param }) => ({
    content: [{ type: "text", text: `Result: ${param}` }],
  })
);
```

### Adding Resources

```typescript
// src/resources/my-resource.resource.ts
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { server } from "../server.js";

server.resource(
  "my_resource",
  new ResourceTemplate("resource://{id}", { list: undefined }),
  async (uri, { id }) => ({
    contents: [{ uri: uri.href, text: `Data for ${id}` }],
  })
);
```

## Using with Claude Desktop

Add your server to Claude Desktop's configuration:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["/path/to/servers/mcp-server-my/build/index.js"]
    }
  }
}
```

## Docker Deployment

Each server can be deployed with Docker:

```bash
cd servers/mcp-server-my

# Build image
docker build -t mcp-server-my .

# Run container
docker run -p 3000:3000 --env-file .env mcp-server-my
```

## Contributing

1. Create a new server using `npm run create-server`
2. Implement your tools, resources, and prompts
3. Add tests for your implementation
4. Submit a pull request

## License

MIT

# MCP Server: example

Example MCP server for testing

## Overview

This is a Model Context Protocol (MCP) server that provides tools, resources, and prompts for AI assistants like Claude Desktop, Cursor, and other MCP-compatible clients.

## Features

### Tools

| Tool | Description |
|------|-------------|
| `calculator` | Perform basic mathematical operations (add, subtract, multiply, divide) |

### Resources

| Resource | URI Pattern | Description |
|----------|-------------|-------------|
| `greeting` | `greeting://{name}` | Generate a personalized greeting |
| `server-info` | `info://server` | Get server information |

### Prompts

| Prompt | Description |
|--------|-------------|
| `code_review` | Generate a structured code review prompt |
| `explain_mcp` | Explain the Model Context Protocol |

## Quick Start

### Prerequisites

- Node.js 22+
- npm

### Installation

```bash
npm install
```

### Development

```bash
# Run in development mode with hot reload
npm run dev

# Run with HTTP transport
npm run dev -- --http
```

### Build

```bash
npm run build
```

### Run

```bash
# STDIO mode (for Claude Desktop, Cursor, etc.)
npm start

# HTTP mode (for remote deployment)
npm run start:http
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |
| `PORT` | HTTP server port | `3000` |

## Usage with Claude Desktop

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "example": {
      "command": "node",
      "args": ["/path/to/build/index.js"]
    }
  }
}
```

## Docker

### Build

```bash
docker build -t mcp-server-example .
```

### Run

```bash
docker run -p 3000:3000 --env-file .env mcp-server-example
```

### Docker Compose

```bash
# Production
docker-compose up -d

# Development with hot reload
docker-compose --profile dev up mcp-server-dev
```

## Development

### Project Structure

```
src/
├── tools/              # MCP tools (actions)
├── resources/          # MCP resources (data)
├── prompts/            # MCP prompts (templates)
├── utils/              # Utilities (logger, etc.)
├── config.ts           # Configuration
├── server.ts           # MCP server setup
└── index.ts            # Entry point
```

### Adding a New Tool

1. Create `src/tools/my-tool.tool.ts`:

```typescript
import { z } from "zod";
import { server } from "../server.js";

const InputSchema = z.object({
  param: z.string().describe("Parameter description"),
});

server.tool("my_tool", InputSchema, async ({ param }) => {
  return {
    content: [{ type: "text", text: `Result: ${param}` }],
  };
});
```

2. Import in `src/server.ts`:

```typescript
await import("./tools/my-tool.tool.js");
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Linting & Formatting

```bash
# Lint
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format
```

## API Reference

### HTTP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/sse` | GET | SSE connection for MCP |
| `/message` | POST | Message endpoint for MCP |

## License

MIT

# MCP Server: Notion

MCP server for Notion API with dynamic token authentication via HTTP headers.

## Features

- **Dynamic Authentication**: Token passed via HTTP headers (not environment variables)
- **Full Notion API**: Search, pages, databases, blocks, and comments
- **HTTP Transport**: Uses `/mcp` endpoint with Streamable HTTP transport
- **Docker Support**: Multi-stage build for production deployment

## Quick Start

### Prerequisites

- Node.js 22+
- Notion Integration Token (get from https://www.notion.so/profile/integrations)

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build & Run

```bash
npm run build
npm start
```

## Authentication

**Token is passed via HTTP headers**, not environment variables:

| Header | Format |
|--------|--------|
| `x-notion-token` | `ntn_****` |
| `Authorization` | `Bearer ntn_****` |

### Example Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-notion-token: ntn_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "notion_search",
      "arguments": {
        "query": "meeting notes"
      }
    }
  }'
```

## Setting Up Notion Integration

1. Go to https://www.notion.so/profile/integrations
2. Click "New integration"
3. Give it a name and select the workspace
4. Copy the "Internal Integration Token"
5. **Important**: Grant page access to the integration:
   - Open the page/database you want to access
   - Click "..." menu → "Add connections"
   - Select your integration

## Available Tools

### Search

| Tool | Description |
|------|-------------|
| `notion_search` | Search pages and databases across workspace |

### Pages

| Tool | Description |
|------|-------------|
| `notion_retrieve_page` | Get page properties and metadata |
| `notion_create_page` | Create a new page in database or as child page |
| `notion_update_page` | Update page properties or archive page |

### Databases

| Tool | Description |
|------|-------------|
| `notion_retrieve_database` | Get database schema and properties |
| `notion_query_database` | Query database with filters and sorting |

### Blocks

| Tool | Description |
|------|-------------|
| `notion_retrieve_block` | Get a single block |
| `notion_retrieve_block_children` | Get page content (child blocks) |
| `notion_append_block_children` | Add content blocks to a page |
| `notion_update_block` | Update block content or archive |

### Comments

| Tool | Description |
|------|-------------|
| `notion_retrieve_comments` | Get comments on a page or block |
| `notion_create_comment` | Add a comment to a page or discussion |

## Docker

### Build

```bash
docker build -t mcp-server-notion .
```

### Run

```bash
docker run -p 3000:3000 mcp-server-notion
```

### Docker Compose

```bash
# Production
docker-compose up -d

# Development
docker-compose --profile dev up mcp-server-notion-dev
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/mcp` | GET | SSE stream for server messages |
| `/mcp` | POST | Send MCP requests |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | HTTP server port |
| `LOG_LEVEL` | info | Logging level (debug, info, warn, error) |

## Tool Usage Examples

### Search

```json
{
  "name": "notion_search",
  "arguments": {
    "query": "project",
    "filter": "page",
    "page_size": 10
  }
}
```

### Query Database

```json
{
  "name": "notion_query_database",
  "arguments": {
    "database_id": "abc123",
    "filter": {
      "property": "Status",
      "select": { "equals": "Done" }
    },
    "sorts": [
      { "property": "Created", "direction": "descending" }
    ]
  }
}
```

### Create Page

```json
{
  "name": "notion_create_page",
  "arguments": {
    "parent_type": "database_id",
    "parent_id": "abc123",
    "properties": {
      "Name": {
        "title": [{ "text": { "content": "New Task" } }]
      },
      "Status": {
        "select": { "name": "To Do" }
      }
    }
  }
}
```

### Append Blocks

```json
{
  "name": "notion_append_block_children",
  "arguments": {
    "block_id": "page_id_here",
    "children": [
      {
        "type": "paragraph",
        "paragraph": {
          "rich_text": [{ "text": { "content": "Hello, World!" } }]
        }
      }
    ]
  }
}
```

## License

MIT

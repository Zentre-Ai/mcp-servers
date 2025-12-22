# Gmail MCP Server

A Model Context Protocol (MCP) server for Gmail integration with dynamic OAuth access token authentication.

## Features

- **Dynamic Token Authentication**: Pass Gmail OAuth access token via HTTP headers per-request
- **Full Gmail API Support**: List, read, send, search, and manage emails
- **Label Management**: Create, update, delete, and list labels
- **Draft Management**: Create, update, send, and delete drafts
- **Docker Support**: Production-ready containerization

## Authentication

This server does **not** store tokens in environment variables. Instead, tokens must be passed dynamically via HTTP headers for each request:

| Header | Description |
|--------|-------------|
| `x-gmail-token` | Gmail OAuth access token |
| `Authorization` | Bearer token (alternative) |

### Example Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-gmail-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## Tools

### Email Tools

| Tool | Description |
|------|-------------|
| `gmail_list_messages` | List messages in the mailbox with optional filters |
| `gmail_get_message` | Get a specific message by ID |
| `gmail_send_message` | Send a new email message |
| `gmail_search_messages` | Search messages using Gmail search syntax |
| `gmail_trash_message` | Move a message to trash |
| `gmail_untrash_message` | Restore a message from trash |
| `gmail_modify_labels` | Add or remove labels from a message |
| `gmail_delete_message` | Permanently delete a message |

### Label Tools

| Tool | Description |
|------|-------------|
| `gmail_list_labels` | List all labels in the mailbox |
| `gmail_get_label` | Get a specific label by ID |
| `gmail_create_label` | Create a new label |
| `gmail_update_label` | Update an existing label |
| `gmail_delete_label` | Delete a label |

### Draft Tools

| Tool | Description |
|------|-------------|
| `gmail_list_drafts` | List drafts in the mailbox |
| `gmail_get_draft` | Get a specific draft by ID |
| `gmail_create_draft` | Create a new draft |
| `gmail_update_draft` | Update an existing draft |
| `gmail_send_draft` | Send an existing draft |
| `gmail_delete_draft` | Delete a draft |

## Installation

```bash
npm install
```

## Development

```bash
# Run in development mode with hot reload
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
docker build -t mcp-server-gmail .
docker run -p 3002:3000 mcp-server-gmail
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

## Gmail API Scopes

Ensure your OAuth token has the following scopes:

- `https://www.googleapis.com/auth/gmail.readonly` - Read-only access
- `https://www.googleapis.com/auth/gmail.send` - Send emails
- `https://www.googleapis.com/auth/gmail.compose` - Create drafts
- `https://www.googleapis.com/auth/gmail.modify` - Modify labels
- `https://www.googleapis.com/auth/gmail.labels` - Manage labels

Or use the full access scope:
- `https://mail.google.com/` - Full access to Gmail

## Example Usage

### List Recent Messages

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-gmail-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "gmail_list_messages",
      "arguments": {
        "maxResults": 5
      }
    },
    "id": 1
  }'
```

### Send an Email

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-gmail-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "gmail_send_message",
      "arguments": {
        "to": "recipient@example.com",
        "subject": "Hello from MCP",
        "body": "This is a test email sent via Gmail MCP server."
      }
    },
    "id": 1
  }'
```

### Search Messages

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-gmail-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "gmail_search_messages",
      "arguments": {
        "query": "from:someone@example.com is:unread",
        "maxResults": 10
      }
    },
    "id": 1
  }'
```

## License

MIT

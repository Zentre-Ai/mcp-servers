# Slack MCP Server

A Model Context Protocol (MCP) server for Slack integration with dynamic bot token authentication.

## Features

- **Dynamic Token Authentication**: Pass Slack bot token via HTTP headers per-request
- **Message Management**: Send, update, delete, search messages and threads
- **Channel Management**: Create, archive, invite users, set topics
- **User Management**: List users, lookup by email, get presence
- **Reactions**: Add, remove, and list emoji reactions
- **Docker Support**: Production-ready containerization

## Authentication

This server does **not** store tokens in environment variables. Instead, tokens must be passed dynamically via HTTP headers for each request:

| Header | Description |
|--------|-------------|
| `x-slack-token` | Slack Bot Token (xoxb-...) |
| `Authorization` | Bearer token (alternative) |

### Example Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-slack-token: xoxb-****" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## Tools

### Message Tools (6)

| Tool | Description |
|------|-------------|
| `slack_post_message` | Send a message to a channel |
| `slack_update_message` | Update an existing message |
| `slack_delete_message` | Delete a message |
| `slack_get_history` | Get conversation history |
| `slack_get_thread` | Get thread replies |
| `slack_search_messages` | Search messages across workspace |

### Channel Tools (10)

| Tool | Description |
|------|-------------|
| `slack_list_channels` | List channels in workspace |
| `slack_get_channel` | Get channel info |
| `slack_create_channel` | Create a new channel |
| `slack_archive_channel` | Archive a channel |
| `slack_unarchive_channel` | Unarchive a channel |
| `slack_invite_to_channel` | Invite users to a channel |
| `slack_kick_from_channel` | Remove user from channel |
| `slack_get_channel_members` | List channel members |
| `slack_set_channel_topic` | Set channel topic |
| `slack_set_channel_purpose` | Set channel purpose |

### User Tools (6)

| Tool | Description |
|------|-------------|
| `slack_list_users` | List workspace users |
| `slack_get_user` | Get user info by ID |
| `slack_lookup_user_by_email` | Find user by email |
| `slack_get_user_presence` | Get user presence status |
| `slack_get_me` | Get current authenticated user |
| `slack_open_dm` | Open direct message channel |

### Reaction Tools (4)

| Tool | Description |
|------|-------------|
| `slack_add_reaction` | Add emoji reaction to message |
| `slack_remove_reaction` | Remove emoji reaction |
| `slack_get_reactions` | Get reactions on a message |
| `slack_list_user_reactions` | List items user reacted to |

**Total: 26 tools**

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
docker build -t mcp-server-slack .
docker run -p 3004:3000 mcp-server-slack
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

## Slack Bot Token Scopes

Ensure your Slack app has these OAuth scopes:

### Required Scopes
- `channels:read` - View basic channel info
- `channels:history` - View messages in public channels
- `chat:write` - Send messages
- `users:read` - View users
- `reactions:read` - View reactions
- `reactions:write` - Add/remove reactions

### Optional Scopes (for full functionality)
- `channels:manage` - Manage channels
- `channels:join` - Join public channels
- `groups:read` - View private channels
- `groups:history` - View messages in private channels
- `im:read` - View direct messages
- `im:history` - View DM history
- `im:write` - Send DMs
- `mpim:read` - View group DMs
- `users:read.email` - View user emails
- `search:read` - Search messages

## Example Usage

### Post a Message

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-slack-token: xoxb-****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "slack_post_message",
      "arguments": {
        "channel": "#general",
        "text": "Hello from MCP! :wave:"
      }
    },
    "id": 1
  }'
```

### Reply to Thread

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-slack-token: xoxb-****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "slack_post_message",
      "arguments": {
        "channel": "C1234567890",
        "text": "Thread reply!",
        "threadTs": "1234567890.123456"
      }
    },
    "id": 1
  }'
```

### Search Messages

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-slack-token: xoxb-****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "slack_search_messages",
      "arguments": {
        "query": "from:@user in:#channel keyword",
        "count": 20
      }
    },
    "id": 1
  }'
```

### Add Reaction

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-slack-token: xoxb-****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "slack_add_reaction",
      "arguments": {
        "channel": "C1234567890",
        "timestamp": "1234567890.123456",
        "name": "thumbsup"
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

## License

MIT

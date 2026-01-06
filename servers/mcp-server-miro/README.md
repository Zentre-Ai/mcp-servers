# MCP Server - Miro

A Model Context Protocol (MCP) server for Miro board and collaboration operations. This server provides 73 tools for comprehensive Miro API integration.

## Features

- **Board Management**: Create, read, update, delete, and copy boards
- **Item Operations**: Manage sticky notes, cards, app cards, and general items
- **Shapes & Text**: Create and manage shapes, text items, and frames
- **Media**: Add images from URLs, manage embeds
- **Connectors**: Create and manage connections between items
- **Tags**: Create, attach, and manage tags on items
- **Groups**: Group and ungroup items
- **Board Members**: Manage board sharing and member permissions
- **Mindmaps**: Create and manage mindmap nodes
- **Bulk Operations**: Create multiple items at once

## Authentication

This server uses dynamic token authentication via HTTP headers. Pass your Miro OAuth access token in one of these headers:

| Header | Description |
|--------|-------------|
| `x-miro-token` | Miro OAuth access token |
| `Authorization` | Bearer token (alternative) |

### Getting a Miro Token

1. Go to [Miro Developer Portal](https://miro.com/app/settings/user-profile/apps)
2. Create a new app or use an existing one
3. Generate an access token with the required scopes

### Required Scopes

- `boards:read` - Read board data
- `boards:write` - Create/update boards
- `identity:read` - Read user info
- `team:read` - Read team data (for organization features)

## Installation

```bash
npm install
npm run build
```

## Running the Server

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Docker

```bash
docker-compose up -d
```

The server runs on port **3007** by default.

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3007` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | MCP protocol endpoint |
| `GET /health` | Health check endpoint |

## Available Tools (73 total)

### Boards (6 tools)

| Tool | Description |
|------|-------------|
| `miro_list_boards` | List all accessible boards |
| `miro_get_board` | Get board details by ID |
| `miro_create_board` | Create a new board |
| `miro_update_board` | Update board settings |
| `miro_delete_board` | Delete a board |
| `miro_copy_board` | Copy/duplicate a board |

### Items (16 tools)

| Tool | Description |
|------|-------------|
| `miro_list_items` | List all items on a board |
| `miro_get_item` | Get item details |
| `miro_update_item_position` | Update item position |
| `miro_delete_item` | Delete any item |
| `miro_create_app_card` | Create app card item |
| `miro_get_app_card` | Get app card details |
| `miro_update_app_card` | Update app card |
| `miro_delete_app_card` | Delete app card |
| `miro_create_card` | Create card item |
| `miro_get_card` | Get card details |
| `miro_update_card` | Update card |
| `miro_delete_card` | Delete card |
| `miro_create_sticky_note` | Create sticky note |
| `miro_get_sticky_note` | Get sticky note details |
| `miro_update_sticky_note` | Update sticky note |
| `miro_delete_sticky_note` | Delete sticky note |

### Shapes (12 tools)

| Tool | Description |
|------|-------------|
| `miro_create_shape` | Create shape item |
| `miro_get_shape` | Get shape details |
| `miro_update_shape` | Update shape |
| `miro_delete_shape` | Delete shape |
| `miro_create_text` | Create text item |
| `miro_get_text` | Get text details |
| `miro_update_text` | Update text |
| `miro_delete_text` | Delete text |
| `miro_create_frame` | Create frame container |
| `miro_get_frame` | Get frame details |
| `miro_update_frame` | Update frame |
| `miro_delete_frame` | Delete frame |

### Media (8 tools)

| Tool | Description |
|------|-------------|
| `miro_create_image_from_url` | Create image from URL |
| `miro_get_image` | Get image details |
| `miro_update_image` | Update image |
| `miro_delete_image` | Delete image |
| `miro_create_embed` | Create embed (URL preview) |
| `miro_get_embed` | Get embed details |
| `miro_update_embed` | Update embed |
| `miro_delete_embed` | Delete embed |

### Connectors (5 tools)

| Tool | Description |
|------|-------------|
| `miro_list_connectors` | List connectors on board |
| `miro_get_connector` | Get connector details |
| `miro_create_connector` | Create connector between items |
| `miro_update_connector` | Update connector |
| `miro_delete_connector` | Delete connector |

### Tags (8 tools)

| Tool | Description |
|------|-------------|
| `miro_list_tags` | List all tags on board |
| `miro_get_tag` | Get tag details |
| `miro_create_tag` | Create a new tag |
| `miro_update_tag` | Update tag |
| `miro_delete_tag` | Delete tag |
| `miro_attach_tag` | Attach tag to item |
| `miro_detach_tag` | Detach tag from item |
| `miro_get_item_tags` | Get tags attached to item |

### Groups (7 tools)

| Tool | Description |
|------|-------------|
| `miro_list_groups` | List groups on board |
| `miro_get_group` | Get group details |
| `miro_create_group` | Create group from items |
| `miro_update_group` | Update group |
| `miro_delete_group` | Delete group |
| `miro_get_group_items` | Get items in group |
| `miro_ungroup_items` | Ungroup items |

### Members (5 tools)

| Tool | Description |
|------|-------------|
| `miro_list_board_members` | List board members |
| `miro_get_board_member` | Get member details |
| `miro_share_board` | Share board with user |
| `miro_update_board_member` | Update member role |
| `miro_remove_board_member` | Remove member |

### Mindmap (4 tools)

| Tool | Description |
|------|-------------|
| `miro_create_mindmap_node` | Create mindmap node |
| `miro_get_mindmap_node` | Get node details |
| `miro_list_mindmap_nodes` | List all nodes |
| `miro_delete_mindmap_node` | Delete node |

### Bulk Operations (2 tools)

| Tool | Description |
|------|-------------|
| `miro_create_items_bulk` | Create multiple items at once |
| `miro_create_items_bulk_file` | Create items from JSON data |

## Usage Example

```bash
# List boards
curl -X POST http://localhost:3007/mcp \
  -H "x-miro-token: your-miro-token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "miro_list_boards",
      "arguments": {}
    },
    "id": 1
  }'

# Create a sticky note
curl -X POST http://localhost:3007/mcp \
  -H "x-miro-token: your-miro-token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "miro_create_sticky_note",
      "arguments": {
        "boardId": "board123",
        "content": "My sticky note",
        "x": 100,
        "y": 200,
        "fillColor": "yellow"
      }
    },
    "id": 2
  }'

# Create a connector between two items
curl -X POST http://localhost:3007/mcp \
  -H "x-miro-token: your-miro-token" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "miro_create_connector",
      "arguments": {
        "boardId": "board123",
        "startItemId": "item1",
        "endItemId": "item2",
        "shape": "curved"
      }
    },
    "id": 3
  }'
```

## Health Check

```bash
curl http://localhost:3007/health
```

## License

MIT

# Google Calendar MCP Server

A Model Context Protocol (MCP) server for Google Calendar integration with dynamic OAuth access token authentication.

## Features

- **Dynamic Token Authentication**: Pass Google OAuth access token via HTTP headers per-request
- **Event Management**: List, create, update, delete, and quick-add events
- **Calendar Management**: Create, update, delete, and list calendars
- **Access Control**: Share calendars with users, groups, or domains
- **Docker Support**: Production-ready containerization

## Authentication

This server does **not** store tokens in environment variables. Instead, tokens must be passed dynamically via HTTP headers for each request:

| Header | Description |
|--------|-------------|
| `x-calendar-token` | Google OAuth access token |
| `Authorization` | Bearer token (alternative) |

### Example Request

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-calendar-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "tools/list", "id": 1}'
```

## Tools

### Event Tools (6)

| Tool | Description |
|------|-------------|
| `calendar_list_events` | List events with optional time range, search, and pagination |
| `calendar_get_event` | Get a specific event by ID |
| `calendar_create_event` | Create a new event with attendees, reminders, recurrence |
| `calendar_update_event` | Update an existing event |
| `calendar_delete_event` | Delete an event |
| `calendar_quick_add` | Create event from natural language (e.g., "Lunch with John tomorrow at noon") |

### Calendar Tools (5)

| Tool | Description |
|------|-------------|
| `calendar_list_calendars` | List all accessible calendars |
| `calendar_get_calendar` | Get calendar details by ID |
| `calendar_create_calendar` | Create a new calendar |
| `calendar_update_calendar` | Update calendar metadata |
| `calendar_delete_calendar` | Delete a calendar (not primary) |

### ACL Tools (3)

| Tool | Description |
|------|-------------|
| `calendar_list_acl` | List sharing permissions for a calendar |
| `calendar_add_acl` | Share calendar with user, group, or domain |
| `calendar_remove_acl` | Remove sharing permission |

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
docker build -t mcp-server-google-calendar .
docker run -p 3003:3000 mcp-server-google-calendar
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

## Google Calendar API Scopes

Ensure your OAuth token has the appropriate scopes:

- `https://www.googleapis.com/auth/calendar` - Full access to calendars
- `https://www.googleapis.com/auth/calendar.events` - Events access only
- `https://www.googleapis.com/auth/calendar.readonly` - Read-only access

## Example Usage

### List Upcoming Events

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-calendar-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "calendar_list_events",
      "arguments": {
        "timeMin": "2024-01-01T00:00:00Z",
        "maxResults": 10
      }
    },
    "id": 1
  }'
```

### Create an Event

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-calendar-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "calendar_create_event",
      "arguments": {
        "summary": "Team Meeting",
        "description": "Weekly sync",
        "location": "Conference Room A",
        "startDateTime": "2024-01-15T10:00:00",
        "endDateTime": "2024-01-15T11:00:00",
        "timeZone": "America/New_York",
        "attendees": "alice@example.com,bob@example.com"
      }
    },
    "id": 1
  }'
```

### Quick Add Event

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-calendar-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "calendar_quick_add",
      "arguments": {
        "text": "Lunch with Sarah tomorrow at 12:30pm"
      }
    },
    "id": 1
  }'
```

### Share Calendar

```bash
curl -X POST http://localhost:3000/mcp \
  -H "x-calendar-token: ya29.****" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "calendar_add_acl",
      "arguments": {
        "role": "reader",
        "scopeType": "user",
        "scopeValue": "colleague@example.com"
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

## License

MIT

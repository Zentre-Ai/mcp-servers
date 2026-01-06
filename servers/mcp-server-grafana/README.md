# MCP Server - Grafana

A Model Context Protocol (MCP) server for Grafana observability platform. This server provides 62 tools for comprehensive Grafana API integration including dashboards, datasources, Prometheus, Loki, alerting, incidents, and more.

## Features

- **Dashboard Management**: Get, update, search dashboards with panel queries and summaries
- **Datasource Operations**: List and query datasources
- **Prometheus**: Execute PromQL queries, list metrics, labels, and metadata
- **Loki**: Execute LogQL queries, list labels and log statistics
- **Alerting**: Manage alert rules and contact points
- **Annotations**: Create, update, and query annotations
- **OnCall**: Manage schedules, shifts, teams, and alert groups
- **Incidents**: Create and manage incidents with timeline activities
- **Sift**: Run investigations to find error patterns and slow requests
- **Pyroscope**: Query profiling data
- **Admin**: Manage teams, users, roles, and RBAC permissions
- **Navigation**: Generate deeplink URLs for dashboards, panels, and explore

## Authentication

This server uses dynamic token authentication via HTTP headers. Pass your Grafana service account token in the headers:

| Header | Description |
|--------|-------------|
| `x-grafana-url` | Grafana instance URL (required) |
| `x-grafana-token` | Service account token |
| `Authorization` | Bearer token (alternative to x-grafana-token) |

### Getting a Grafana Token

1. Go to your Grafana instance
2. Navigate to Administration > Service Accounts
3. Create a new service account with appropriate permissions
4. Generate a token for the service account

### Recommended Permissions

Assign the **Editor** built-in role, or create a custom role with:
- `dashboards:read`, `dashboards:write`
- `datasources:read`, `datasources:query`
- `folders:read`, `folders:write`
- `alert.rules:read`, `alert.rules:write`
- `annotations:read`, `annotations:write`
- `teams:read`, `users:read`

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

The server runs on port **3008** by default.

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3008` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | MCP protocol endpoint |
| `GET /health` | Health check endpoint |

## Available Tools (62 total)

### Dashboards (5 tools)

| Tool | Description |
|------|-------------|
| `grafana_get_dashboard_by_uid` | Get complete dashboard by UID |
| `grafana_update_dashboard` | Create/update dashboard |
| `grafana_get_dashboard_panel_queries` | Extract panel queries |
| `grafana_get_dashboard_property` | Get property via path |
| `grafana_get_dashboard_summary` | Get compact overview |

### Datasources (3 tools)

| Tool | Description |
|------|-------------|
| `grafana_list_datasources` | List all datasources |
| `grafana_get_datasource_by_uid` | Get datasource by UID |
| `grafana_get_datasource_by_name` | Get datasource by name |

### Search (2 tools)

| Tool | Description |
|------|-------------|
| `grafana_search_dashboards` | Search dashboards |
| `grafana_search_folders` | Search folders |

### Prometheus (5 tools)

| Tool | Description |
|------|-------------|
| `grafana_list_prometheus_metric_metadata` | List metric metadata |
| `grafana_query_prometheus` | Execute PromQL query |
| `grafana_list_prometheus_metric_names` | List metric names |
| `grafana_list_prometheus_label_names` | List label names |
| `grafana_list_prometheus_label_values` | Get label values |

### Loki (4 tools)

| Tool | Description |
|------|-------------|
| `grafana_list_loki_label_names` | List log label names |
| `grafana_list_loki_label_values` | Get log label values |
| `grafana_query_loki_stats` | Get log statistics |
| `grafana_query_loki_logs` | Execute LogQL query |

### Alerting (6 tools)

| Tool | Description |
|------|-------------|
| `grafana_list_alert_rules` | List alert rules |
| `grafana_get_alert_rule_by_uid` | Get alert rule details |
| `grafana_create_alert_rule` | Create alert rule |
| `grafana_update_alert_rule` | Update alert rule |
| `grafana_delete_alert_rule` | Delete alert rule |
| `grafana_list_contact_points` | List contact points |

### Annotations (6 tools)

| Tool | Description |
|------|-------------|
| `grafana_get_annotations` | Get annotations |
| `grafana_create_annotation` | Create annotation |
| `grafana_create_graphite_annotation` | Create Graphite annotation |
| `grafana_update_annotation` | Full update annotation |
| `grafana_patch_annotation` | Partial update annotation |
| `grafana_get_annotation_tags` | Get annotation tags |

### OnCall (7 tools)

| Tool | Description |
|------|-------------|
| `grafana_list_oncall_schedules` | List schedules |
| `grafana_get_oncall_shift` | Get shift details |
| `grafana_get_current_oncall_users` | Get current on-call |
| `grafana_list_oncall_teams` | List OnCall teams |
| `grafana_list_oncall_users` | List OnCall users |
| `grafana_list_alert_groups` | List alert groups |
| `grafana_get_alert_group` | Get alert group |

### Incidents (4 tools)

| Tool | Description |
|------|-------------|
| `grafana_list_incidents` | List incidents |
| `grafana_create_incident` | Create incident |
| `grafana_add_activity_to_incident` | Add timeline note |
| `grafana_get_incident` | Get incident details |

### Sift (5 tools)

| Tool | Description |
|------|-------------|
| `grafana_get_sift_investigation` | Get investigation |
| `grafana_get_sift_analysis` | Get analysis |
| `grafana_list_sift_investigations` | List investigations |
| `grafana_find_error_pattern_logs` | Find error patterns |
| `grafana_find_slow_requests` | Find slow requests |

### Pyroscope (4 tools)

| Tool | Description |
|------|-------------|
| `grafana_list_pyroscope_label_names` | List profile labels |
| `grafana_list_pyroscope_label_values` | Get label values |
| `grafana_list_pyroscope_profile_types` | List profile types |
| `grafana_fetch_pyroscope_profile` | Fetch profile |

### Admin (9 tools)

| Tool | Description |
|------|-------------|
| `grafana_list_teams` | Search teams |
| `grafana_list_users_by_org` | List org users |
| `grafana_list_all_roles` | List RBAC roles |
| `grafana_get_role_details` | Get role details |
| `grafana_get_role_assignments` | Get role assignments |
| `grafana_list_user_roles` | List user roles |
| `grafana_list_team_roles` | List team roles |
| `grafana_get_resource_permissions` | Get permissions |
| `grafana_get_resource_description` | Get permission schema |

### Folders (1 tool)

| Tool | Description |
|------|-------------|
| `grafana_create_folder` | Create folder |

### Navigation (1 tool)

| Tool | Description |
|------|-------------|
| `grafana_generate_deeplink` | Generate deeplink URL |

## Usage Example

```bash
# List dashboards
curl -X POST http://localhost:3008/mcp \
  -H "x-grafana-url: https://your-grafana.com" \
  -H "x-grafana-token: glsa_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "grafana_search_dashboards",
      "arguments": { "query": "production" }
    },
    "id": 1
  }'

# Query Prometheus
curl -X POST http://localhost:3008/mcp \
  -H "x-grafana-url: https://your-grafana.com" \
  -H "x-grafana-token: glsa_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "grafana_query_prometheus",
      "arguments": {
        "datasourceUid": "prometheus-uid",
        "expr": "up{job=\"myapp\"}",
        "queryType": "instant"
      }
    },
    "id": 2
  }'

# Create annotation
curl -X POST http://localhost:3008/mcp \
  -H "x-grafana-url: https://your-grafana.com" \
  -H "x-grafana-token: glsa_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "grafana_create_annotation",
      "arguments": {
        "text": "Deployment completed",
        "tags": ["deploy", "production"]
      }
    },
    "id": 3
  }'
```

## Health Check

```bash
curl http://localhost:3008/health
```

## Plugin Requirements

Some tools require Grafana plugins to be installed:

- **OnCall tools**: Requires Grafana OnCall plugin
- **Incident tools**: Requires Grafana Incident plugin
- **Sift tools**: Requires Grafana Sift plugin
- **Pyroscope tools**: Requires Pyroscope datasource

## Grafana Version

Minimum Grafana version **9.0** required for full functionality.

## License

MIT

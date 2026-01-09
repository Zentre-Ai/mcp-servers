# MCP Server - Elasticsearch

A Model Context Protocol (MCP) server for Elasticsearch. This server provides 5 tools for interacting with Elasticsearch indices, executing searches, and running ES|QL queries.

## Features

- **Index Management**: List indices and get field mappings
- **Search**: Execute queries using Elasticsearch Query DSL
- **ES|QL**: Run ES|QL queries for data analysis
- **Cluster Info**: Get shard information

## Authentication

This server uses dynamic token authentication via HTTP headers. Supports both API key and basic authentication.

### Headers

| Header | Description |
|--------|-------------|
| `x-elasticsearch-url` | Elasticsearch instance URL (required) |
| `x-elasticsearch-api-key` | API key authentication |
| `x-elasticsearch-username` | Basic auth username |
| `x-elasticsearch-password` | Basic auth password |
| `x-elasticsearch-skip-ssl` | Set to "true" to skip SSL verification |

### Getting Credentials

#### API Key (Recommended)
1. Go to Kibana > Stack Management > API Keys
2. Create a new API key with appropriate permissions
3. Copy the encoded API key

#### Basic Auth
Use your Elasticsearch username and password.

### Required Permissions

The API key or user should have:
- `read` access to indices you want to query
- `monitor` for cluster/shard information
- `view_index_metadata` for mappings

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

The server runs on port **3009** by default.

## Configuration

Environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3009` |
| `LOG_LEVEL` | Logging level (debug, info, warn, error) | `info` |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /mcp` | MCP protocol endpoint |
| `GET /health` | Health check endpoint |

## Available Tools (5 total)

| Tool | Description |
|------|-------------|
| `elasticsearch_list_indices` | List all available Elasticsearch indices |
| `elasticsearch_get_mappings` | Get field mappings for a specific index |
| `elasticsearch_search` | Execute search using Query DSL |
| `elasticsearch_esql` | Execute ES\|QL query |
| `elasticsearch_get_shards` | Get shard information for all or specific indices |

## Tool Details

### elasticsearch_list_indices

List all available Elasticsearch indices.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `indexPattern` | string | No | Index pattern to filter (e.g., 'logs-*') |

### elasticsearch_get_mappings

Get field mappings for a specific Elasticsearch index.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `index` | string | Yes | Name of the Elasticsearch index |

### elasticsearch_search

Execute search using Elasticsearch Query DSL.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `index` | string | Yes | Name of the Elasticsearch index to search |
| `queryBody` | object | Yes | Complete Elasticsearch query DSL object |
| `fields` | string[] | No | Specific fields to return in _source |

### elasticsearch_esql

Execute ES|QL query. Requires Elasticsearch 8.11+.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Complete ES\|QL query |

### elasticsearch_get_shards

Get shard information for all or specific indices.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `index` | string | No | Optional index name to get shard information for |

## Usage Examples

### List all indices

```bash
curl -X POST http://localhost:3009/mcp \
  -H "x-elasticsearch-url: https://my-cluster.es.cloud:9243" \
  -H "x-elasticsearch-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "elasticsearch_list_indices",
      "arguments": {}
    },
    "id": 1
  }'
```

### Search with Query DSL

```bash
curl -X POST http://localhost:3009/mcp \
  -H "x-elasticsearch-url: https://my-cluster.es.cloud:9243" \
  -H "x-elasticsearch-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "elasticsearch_search",
      "arguments": {
        "index": "logs-*",
        "queryBody": {
          "query": {
            "bool": {
              "must": [
                { "match": { "status": "error" } }
              ],
              "filter": [
                { "range": { "@timestamp": { "gte": "now-1h" } } }
              ]
            }
          },
          "size": 10,
          "sort": [{ "@timestamp": "desc" }]
        }
      }
    },
    "id": 2
  }'
```

### Execute ES|QL query

```bash
curl -X POST http://localhost:3009/mcp \
  -H "x-elasticsearch-url: https://my-cluster.es.cloud:9243" \
  -H "x-elasticsearch-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "elasticsearch_esql",
      "arguments": {
        "query": "FROM logs-* | WHERE status >= 400 | STATS count = COUNT(*) BY status | SORT count DESC | LIMIT 10"
      }
    },
    "id": 3
  }'
```

### Using Basic Auth

```bash
curl -X POST http://localhost:3009/mcp \
  -H "x-elasticsearch-url: https://localhost:9200" \
  -H "x-elasticsearch-username: elastic" \
  -H "x-elasticsearch-password: changeme" \
  -H "x-elasticsearch-skip-ssl: true" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## Health Check

```bash
curl http://localhost:3009/health
```

## Elasticsearch Compatibility

- **Elasticsearch versions**: 8.x and 9.x
- **ES|QL**: Requires Elasticsearch 8.11+

## License

MIT

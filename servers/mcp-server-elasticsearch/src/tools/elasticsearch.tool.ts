import { z } from "zod";
import { server, getCurrentAuth } from "../server.js";
import { elasticsearchRequest } from "../utils/elasticsearch-client.js";
import { logger } from "../utils/logger.js";

/**
 * List all available Elasticsearch indices.
 */
server.tool(
  "elasticsearch_list_indices",
  {
    indexPattern: z.string().optional().describe("Index pattern to filter (e.g., 'logs-*')"),
  },
  async ({ indexPattern }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Elasticsearch credentials available" }] };
    }

    try {
      const pattern = indexPattern || "*";
      const result = await elasticsearchRequest<unknown[]>(
        auth,
        `/_cat/indices/${encodeURIComponent(pattern)}?format=json&h=index,health,status,docs.count,store.size`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to list indices", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error listing indices: ${message}` }] };
    }
  }
);

/**
 * Get field mappings for a specific Elasticsearch index.
 */
server.tool(
  "elasticsearch_get_mappings",
  {
    index: z.string().describe("Name of the Elasticsearch index"),
  },
  async ({ index }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Elasticsearch credentials available" }] };
    }

    try {
      const result = await elasticsearchRequest<Record<string, unknown>>(
        auth,
        `/${encodeURIComponent(index)}/_mapping`
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get mappings", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting mappings: ${message}` }] };
    }
  }
);

/**
 * Execute search using Elasticsearch Query DSL.
 */
server.tool(
  "elasticsearch_search",
  {
    index: z.string().describe("Name of the Elasticsearch index to search"),
    queryBody: z.record(z.unknown()).describe("Complete Elasticsearch query DSL object (can include query, size, from, sort, aggs, etc.)"),
    fields: z.array(z.string()).optional().describe("Specific fields to return in _source"),
  },
  async ({ index, queryBody, fields }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Elasticsearch credentials available" }] };
    }

    try {
      const body: Record<string, unknown> = { ...queryBody };
      if (fields && fields.length > 0) {
        body._source = fields;
      }

      const result = await elasticsearchRequest<Record<string, unknown>>(
        auth,
        `/${encodeURIComponent(index)}/_search`,
        {
          method: "POST",
          body: JSON.stringify(body),
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to execute search", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error executing search: ${message}` }] };
    }
  }
);

/**
 * Execute ES|QL query.
 */
server.tool(
  "elasticsearch_esql",
  {
    query: z.string().describe("Complete ES|QL query (e.g., 'FROM logs | WHERE status >= 400 | LIMIT 10')"),
  },
  async ({ query }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Elasticsearch credentials available" }] };
    }

    try {
      const result = await elasticsearchRequest<Record<string, unknown>>(
        auth,
        "/_query",
        {
          method: "POST",
          body: JSON.stringify({ query }),
        }
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to execute ES|QL query", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error executing ES|QL query: ${message}` }] };
    }
  }
);

/**
 * Get shard information for all or specific indices.
 */
server.tool(
  "elasticsearch_get_shards",
  {
    index: z.string().optional().describe("Optional index name to get shard information for"),
  },
  async ({ index }) => {
    const auth = getCurrentAuth();
    if (!auth) {
      return { content: [{ type: "text", text: "Error: No Elasticsearch credentials available" }] };
    }

    try {
      const path = index
        ? `/_cat/shards/${encodeURIComponent(index)}?format=json`
        : "/_cat/shards?format=json";

      const result = await elasticsearchRequest<unknown[]>(auth, path);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error("Failed to get shards", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      return { content: [{ type: "text", text: `Error getting shards: ${message}` }] };
    }
  }
);

logger.info("Elasticsearch tools registered (5 tools)");

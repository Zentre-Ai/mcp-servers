import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { logger } from "./utils/logger.js";
import { JiraCloudAuth } from "./utils/jira-cloud-client.js";
import { getAccessibleResources, JiraCloudSite } from "./utils/oauth.js";

/**
 * MCP Server instance for Jira Cloud.
 */
export const server = new McpServer({
  name: "mcp-server-jira-cloud",
  version: "1.0.0",
});

/**
 * Global auth storage for the current request.
 * This is set before each MCP request is handled.
 */
let currentJiraCloudAuth: JiraCloudAuth | null = null;

export function setCurrentAuth(auth: JiraCloudAuth | null): void {
  currentJiraCloudAuth = auth;
}

export function getCurrentAuth(): JiraCloudAuth | null {
  return currentJiraCloudAuth;
}

// --- TTL cache utility ---

interface CacheEntry<T> {
  value: T;
  timestamp: number;
}

const MAX_CACHE_SIZE = 1000;

class TtlCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(private ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict oldest entries when cache exceeds max size
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, { value, timestamp: Date.now() });
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }
}

// --- In-memory caches (keyed by access token) ---

// Site selection: 1-hour TTL (re-select after token refresh)
const siteSelectionCache = new TtlCache<string>(60 * 60 * 1000);

// Accessible resources: 5-min TTL
const sitesCache = new TtlCache<JiraCloudSite[]>(5 * 60 * 1000);

// Periodic cleanup every 5 minutes to remove expired entries
setInterval(() => {
  siteSelectionCache.cleanup();
  sitesCache.cleanup();
}, 5 * 60 * 1000).unref();

export function setSelectedSite(accessToken: string, cloudId: string): void {
  siteSelectionCache.set(accessToken, cloudId);
}

export function getSelectedSite(accessToken: string): string | undefined {
  return siteSelectionCache.get(accessToken);
}

export async function getCachedAccessibleResources(
  accessToken: string
): Promise<JiraCloudSite[]> {
  const cached = sitesCache.get(accessToken);
  if (cached) return cached;

  const sites = await getAccessibleResources(accessToken);
  sitesCache.set(accessToken, sites);
  return sites;
}

// --- Cloud ID resolution ---

export type ResolveResult =
  | { resolved: true; cloudId: string }
  | { resolved: false; sites: JiraCloudSite[] };

/**
 * Resolve the cloud ID for a given access token.
 * 1. If a site was previously selected → use it.
 * 2. If only 1 accessible site → auto-select it.
 * 3. If 0 sites → throw error.
 * 4. If multiple sites → return needs-selection result.
 */
export async function resolveCloudId(
  accessToken: string
): Promise<ResolveResult> {
  // Check if a site was previously selected
  const selected = getSelectedSite(accessToken);
  if (selected) {
    return { resolved: true, cloudId: selected };
  }

  // Fetch accessible resources
  const sites = await getCachedAccessibleResources(accessToken);

  if (sites.length === 0) {
    throw new Error(
      "No accessible Jira Cloud sites found for this account. Ensure the OAuth app has the correct scopes."
    );
  }

  if (sites.length === 1) {
    // Auto-select the only site
    const cloudId = sites[0].id;
    siteSelectionCache.set(accessToken, cloudId);
    return { resolved: true, cloudId };
  }

  // Multiple sites — needs user selection
  return { resolved: false, sites };
}

/**
 * Helper for tools that require a resolved cloud ID.
 * Returns the auth with a guaranteed cloudId, or an MCP error response if not resolved.
 */
export async function requireCloudId(): Promise<
  | { auth: JiraCloudAuth & { cloudId: string }; error?: never }
  | { auth?: never; error: { content: Array<{ type: "text"; text: string }>; isError: true } }
> {
  const auth = getCurrentAuth();
  if (!auth) {
    return {
      error: {
        content: [{ type: "text" as const, text: "Error: No Jira Cloud credentials available" }],
        isError: true,
      },
    };
  }

  if (auth.cloudId) {
    return { auth: auth as JiraCloudAuth & { cloudId: string } };
  }

  // Try to resolve
  try {
    const result = await resolveCloudId(auth.accessToken);
    if (result.resolved) {
      auth.cloudId = result.cloudId;
      return { auth: auth as JiraCloudAuth & { cloudId: string } };
    }

    // Multiple sites — return error with site list
    const siteList = result.sites
      .map((s) => `  - ${s.name} (cloud_id: ${s.id}, url: ${s.url})`)
      .join("\n");
    return {
      error: {
        content: [
          {
            type: "text" as const,
            text: `Multiple Jira Cloud sites found. Please use the jira_cloud_select_site tool to choose one:\n\n${siteList}`,
          },
        ],
        isError: true,
      },
    };
  } catch (err) {
    return {
      error: {
        content: [
          {
            type: "text" as const,
            text: `Error resolving Jira Cloud site: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      },
    };
  }
}

/**
 * Register all tools with the server.
 */
export async function registerHandlers(): Promise<void> {
  logger.info("Registering Jira Cloud MCP handlers...");

  // Import all tools - each tool registers itself with the server
  await import("./tools/sites.tool.js");
  await import("./tools/issues.tool.js");
  await import("./tools/projects.tool.js");
  await import("./tools/search.tool.js");
  await import("./tools/users.tool.js");

  logger.info("All Jira Cloud handlers registered successfully");
}

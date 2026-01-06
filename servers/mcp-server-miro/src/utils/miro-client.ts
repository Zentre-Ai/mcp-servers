import { MiroLowlevelApi } from "@mirohq/miro-api";

/**
 * Create a Miro API client with the provided access token.
 * Uses the low-level API for direct method access.
 */
export function createMiroClient(accessToken: string): MiroLowlevelApi {
  return new MiroLowlevelApi(accessToken);
}

/**
 * Extract Miro token from request headers.
 */
export function extractMiroToken(
  headers: Record<string, string | string[] | undefined>
): string | null {
  // Check for x-miro-token header
  const miroToken = headers["x-miro-token"];
  if (miroToken) {
    return Array.isArray(miroToken) ? miroToken[0] : miroToken;
  }

  // Check for Authorization: Bearer header
  const authHeader = headers["authorization"];
  if (authHeader) {
    const auth = Array.isArray(authHeader) ? authHeader[0] : authHeader;
    if (auth.toLowerCase().startsWith("bearer ")) {
      return auth.slice(7);
    }
  }

  return null;
}

/**
 * Format a board object for output.
 */
export function formatBoard(board: Record<string, unknown>): Record<string, unknown> {
  return {
    id: board.id,
    name: board.name,
    description: board.description,
    team: board.team,
    owner: board.owner,
    currentUserMembership: board.currentUserMembership,
    createdAt: board.createdAt,
    modifiedAt: board.modifiedAt,
    viewLink: board.viewLink,
    sharingPolicy: board.sharingPolicy,
    permissionsPolicy: board.permissionsPolicy,
  };
}

/**
 * Format an item object for output.
 */
export function formatItem(item: Record<string, unknown>): Record<string, unknown> {
  return {
    id: item.id,
    type: item.type,
    position: item.position,
    geometry: item.geometry,
    parent: item.parent,
    origin: item.origin,
    createdAt: item.createdAt,
    modifiedAt: item.modifiedAt,
    createdBy: item.createdBy,
    modifiedBy: item.modifiedBy,
    data: item.data,
    style: item.style,
  };
}

/**
 * Format a connector object for output.
 */
export function formatConnector(connector: Record<string, unknown>): Record<string, unknown> {
  return {
    id: connector.id,
    type: connector.type,
    startItem: connector.startItem,
    endItem: connector.endItem,
    shape: connector.shape,
    style: connector.style,
    captions: connector.captions,
    createdAt: connector.createdAt,
    modifiedAt: connector.modifiedAt,
    createdBy: connector.createdBy,
    modifiedBy: connector.modifiedBy,
  };
}

/**
 * Format a tag object for output.
 */
export function formatTag(tag: Record<string, unknown>): Record<string, unknown> {
  return {
    id: tag.id,
    title: tag.title,
    fillColor: tag.fillColor,
  };
}

/**
 * Format a board member object for output.
 */
export function formatMember(member: Record<string, unknown>): Record<string, unknown> {
  return {
    id: member.id,
    name: member.name,
    type: member.type,
    role: member.role,
  };
}

/**
 * Format a group object for output.
 */
export function formatGroup(group: Record<string, unknown>): Record<string, unknown> {
  return {
    id: group.id,
    items: group.items,
  };
}

/**
 * Zoho multi-datacenter configuration.
 * Zoho operates in multiple geographic datacenters, each with its own domain.
 */

export const ZOHO_DATACENTERS = {
  com: {
    name: "United States",
    accountsDomain: "accounts.zoho.com",
    peopleDomain: "people.zoho.com",
  },
  eu: {
    name: "Europe",
    accountsDomain: "accounts.zoho.eu",
    peopleDomain: "people.zoho.eu",
  },
  in: {
    name: "India",
    accountsDomain: "accounts.zoho.in",
    peopleDomain: "people.zoho.in",
  },
  "com.au": {
    name: "Australia",
    accountsDomain: "accounts.zoho.com.au",
    peopleDomain: "people.zoho.com.au",
  },
  jp: {
    name: "Japan",
    accountsDomain: "accounts.zoho.jp",
    peopleDomain: "people.zoho.jp",
  },
  "com.cn": {
    name: "China",
    accountsDomain: "accounts.zoho.com.cn",
    peopleDomain: "people.zoho.com.cn",
  },
} as const;

export type ZohoDatacenter = keyof typeof ZOHO_DATACENTERS;

/**
 * Get datacenter configuration by code.
 */
export function getDatacenterConfig(datacenter: string): (typeof ZOHO_DATACENTERS)[ZohoDatacenter] {
  const dc = datacenter as ZohoDatacenter;
  if (!(dc in ZOHO_DATACENTERS)) {
    // Default to US datacenter
    return ZOHO_DATACENTERS.com;
  }
  return ZOHO_DATACENTERS[dc];
}

/**
 * Validate datacenter code.
 */
export function isValidDatacenter(datacenter: string): datacenter is ZohoDatacenter {
  return datacenter in ZOHO_DATACENTERS;
}

/**
 * Get all available datacenters.
 */
export function getAllDatacenters(): Array<{ code: string; name: string }> {
  return Object.entries(ZOHO_DATACENTERS).map(([code, config]) => ({
    code,
    name: config.name,
  }));
}

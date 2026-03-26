/**
 * URL classification engine.
 *
 * classifyUrl: pure function — testable without chrome APIs.
 * classify:    chrome-integrated wrapper that reads the blacklist from storage.
 */

const INTERNAL_PROTOCOLS = new Set([
  'chrome:',
  'chrome-extension:',
  'edge:',
  'about:',
]);

type Classification = 'degenerative' | 'neutral';

/**
 * Classify a URL against an explicit blacklist.
 *
 * Rules (per constitution Principle V):
 *  - Internal browser URLs → neutral
 *  - Hostname matches a blacklist domain (exact or subdomain) → degenerative
 *  - Everything else → neutral (unknowns default to non-work)
 */
export function classifyUrl(url: string, blacklist: string[]): Classification {
  let hostname: string;

  try {
    const parsed = new URL(url);
    if (INTERNAL_PROTOCOLS.has(parsed.protocol)) {
      return 'neutral';
    }
    hostname = parsed.hostname.toLowerCase();
  } catch {
    return 'neutral';
  }

  for (const domain of blacklist) {
    const d = domain.toLowerCase().trim();
    if (!d) continue;
    if (hostname === d || hostname.endsWith(`.${d}`)) {
      return 'degenerative';
    }
  }

  return 'neutral';
}

/**
 * Classify a URL using the blacklist stored in chrome.storage.local.
 */
export async function classify(url: string): Promise<Classification> {
  const result = await chrome.storage.local.get('blacklist');
  const blacklist: string[] = Array.isArray(result.blacklist) ? result.blacklist : [];
  return classifyUrl(url, blacklist);
}

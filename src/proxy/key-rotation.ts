import type { ProtocolAuth } from '../config/types.js';

/**
 * Select a single key from the auth config using time-based round-robin.
 * Returns null if no multi-key rotation is configured.
 */
export function selectKey(auth: ProtocolAuth): string | null {
  const keys = extractKeys(auth);
  if (!keys || keys.length <= 1) return null;
  return keys[Date.now() % keys.length]!;
}

/**
 * Returns an effective single-key auth object for use in upstream requests.
 * If multi-key rotation is configured, picks the current key and returns
 * a normalized bearer/x-api-key auth. Otherwise returns the original auth.
 */
export function getEffectiveAuth(auth: ProtocolAuth): ProtocolAuth {
  const keys = extractKeys(auth);
  if (!keys || keys.length <= 1) return auth;

  const selectedKey = keys[Date.now() % keys.length]!;

  // Normalize to the appropriate single-key type based on original auth
  if (auth.type === 'multiKey') {
    return { type: 'bearer', token: selectedKey };
  }
  if (auth.type === 'bearer') {
    return { type: 'bearer', token: selectedKey };
  }
  if (auth.type === 'x-api-key') {
    return { type: 'x-api-key', key: selectedKey };
  }
  // For aws/azure/none, fall through to original auth
  return auth;
}

/**
 * Extract the keys array from any auth type.
 */
function extractKeys(auth: ProtocolAuth): string[] | null {
  if (auth.type === 'multiKey') return auth.keys;
  if (auth.type === 'bearer') return auth.keys ?? null;
  if (auth.type === 'x-api-key') return auth.keys ?? null;
  return null;
}

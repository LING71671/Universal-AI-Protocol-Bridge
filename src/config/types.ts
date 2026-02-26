import type { ProtocolId } from '../canonical/types.js';

export type { ProtocolId };

// ── Authentication ────────────────────────────────────────────────────────────

export type ProtocolAuth =
  | { type: 'bearer'; token: string }
  | { type: 'x-api-key'; key: string }
  | { type: 'aws'; accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string }
  | { type: 'azure'; apiKey: string; apiVersion: string }
  | { type: 'none' };

// ── Proxy Config (embedded in encrypted URL token) ────────────────────────────

export interface ProxyConfig {
  version: 1;
  sourceProtocol: ProtocolId;
  targetProtocol: ProtocolId;
  targetBaseUrl: string;
  auth: ProtocolAuth;
  modelMap?: Record<string, string>;
  forceModel?: string;
}

// ── Cloudflare Worker Env ─────────────────────────────────────────────────────

export interface Env {
  WORKER_SECRET: string;
}

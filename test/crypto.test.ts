import { describe, it, expect } from 'vitest';
import { encryptConfig, decryptConfig } from '../src/config/crypto.js';
import type { ProxyConfig } from '../src/config/types.js';

const SECRET = 'test-secret-32-chars-long-enough!!';

const sampleConfig: ProxyConfig = {
  version: 1,
  sourceProtocol: 'anthropic',
  targetProtocol: 'openai',
  targetBaseUrl: 'https://api.openai.com/v1',
  auth: { type: 'bearer', token: 'sk-test-key' },
  modelMap: { 'claude-sonnet-4-6': 'gpt-4o' },
};

describe('crypto', () => {
  it('round-trips a config', async () => {
    const token = await encryptConfig(sampleConfig, SECRET);
    const decoded = await decryptConfig(token, SECRET);
    expect(decoded).toEqual(sampleConfig);
  });

  it('produces different tokens for same config (random IV)', async () => {
    const t1 = await encryptConfig(sampleConfig, SECRET);
    const t2 = await encryptConfig(sampleConfig, SECRET);
    expect(t1).not.toBe(t2);
  });

  it('throws on wrong secret', async () => {
    const token = await encryptConfig(sampleConfig, SECRET);
    await expect(decryptConfig(token, 'wrong-secret')).rejects.toThrow();
  });

  it('throws on tampered token', async () => {
    const token = await encryptConfig(sampleConfig, SECRET);
    const tampered = token.slice(0, -4) + 'XXXX';
    await expect(decryptConfig(tampered, SECRET)).rejects.toThrow();
  });
});

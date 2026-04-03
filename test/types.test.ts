import { describe, it, expect } from 'vitest';
import type { ProtocolAuth } from '../src/config/types';

describe('ProtocolAuth type expansion', () => {
  it('can construct multiKey auth', () => {
    const a: ProtocolAuth = { type: 'multiKey', keys: ['key1', 'key2'] };
    expect(a.type).toBe('multiKey');
    expect(Array.isArray(a.keys)).toBe(true);
  });

  it('bearer can include optional keys array', () => {
    // with keys provided
    const b: ProtocolAuth = { type: 'bearer', token: 'tok', keys: ['k1', 'k2'] };
    expect(b.type).toBe('bearer');
    // with no keys
    const b2: ProtocolAuth = { type: 'bearer', token: 'tok' };
    expect(b2.type).toBe('bearer');
  });

  it('x-api-key can include optional keys array', () => {
    // with keys provided
    const x: ProtocolAuth = { type: 'x-api-key', key: 'abc', keys: ['k1'] };
    expect(x.type).toBe('x-api-key');
    // with no keys
    const x2: ProtocolAuth = { type: 'x-api-key', key: 'def' };
    expect(x2.type).toBe('x-api-key');
  });

  it('existing auth types still work', () => {
    const aaws: ProtocolAuth = { type: 'aws', accessKeyId: 'AK', secretAccessKey: 'SK', region: 'us-east-1' };
    expect(aaws.type).toBe('aws');
    const aaws2: ProtocolAuth = {
      type: 'aws',
      accessKeyId: 'AK',
      secretAccessKey: 'SK',
      sessionToken: 'token',
      region: 'us-west-2',
    };
    expect(aaws2.type).toBe('aws');

    const azure: ProtocolAuth = { type: 'azure', apiKey: 'key', apiVersion: '2024-01-01' };
    expect(azure.type).toBe('azure');

    const none: ProtocolAuth = { type: 'none' };
    expect(none.type).toBe('none');
  });
});

import { describe, it, expect } from 'vitest';
import type { ProtocolAuth } from '../src/config/types.js';
import { selectKey, getEffectiveAuth } from '../src/proxy/key-rotation.js';

describe('selectKey', () => {
  it('returns null for single key auth', () => {
    const auth: ProtocolAuth = { type: 'bearer', token: 'single-key' };
    expect(selectKey(auth)).toBeNull();
  });

  it('returns null for auth without keys array', () => {
    const auth: ProtocolAuth = { type: 'x-api-key', key: 'abc' };
    expect(selectKey(auth)).toBeNull();
  });

  it('returns null for aws/azure/none auth', () => {
    const aws: ProtocolAuth = { type: 'aws', accessKeyId: 'AK', secretAccessKey: 'SK', region: 'us-east-1' };
    const azure: ProtocolAuth = { type: 'azure', apiKey: 'key', apiVersion: 'v1' };
    const none: ProtocolAuth = { type: 'none' };
    expect(selectKey(aws)).toBeNull();
    expect(selectKey(azure)).toBeNull();
    expect(selectKey(none)).toBeNull();
  });

  it('returns a key from multiKey auth', () => {
    const auth: ProtocolAuth = { type: 'multiKey', keys: ['key-a', 'key-b', 'key-c'] };
    const key = selectKey(auth);
    expect(['key-a', 'key-b', 'key-c']).toContain(key);
  });

  it('returns a key from bearer with keys array', () => {
    const auth: ProtocolAuth = { type: 'bearer', token: 'primary', keys: ['k1', 'k2'] };
    const key = selectKey(auth);
    expect(['k1', 'k2']).toContain(key);
  });

  it('returns null when keys array has only one element', () => {
    const auth: ProtocolAuth = { type: 'multiKey', keys: ['only-one'] };
    expect(selectKey(auth)).toBeNull();
  });
});

describe('getEffectiveAuth', () => {
  it('returns original auth when no keys array', () => {
    const auth: ProtocolAuth = { type: 'bearer', token: 'single' };
    const effective = getEffectiveAuth(auth);
    expect(effective.type).toBe('bearer');
    if (effective.type === 'bearer') {
      expect(effective.token).toBe('single');
    }
  });

  it('returns bearer with selected key for multiKey auth', () => {
    const auth: ProtocolAuth = { type: 'multiKey', keys: ['key-1', 'key-2'] };
    const effective = getEffectiveAuth(auth);
    expect(effective.type).toBe('bearer');
    if (effective.type === 'bearer') {
      expect(['key-1', 'key-2']).toContain(effective.token);
    }
  });

  it('returns x-api-key with selected key', () => {
    const auth: ProtocolAuth = { type: 'x-api-key', key: 'original', keys: ['k1', 'k2'] };
    const effective = getEffectiveAuth(auth);
    expect(effective.type).toBe('x-api-key');
    if (effective.type === 'x-api-key') {
      expect(['k1', 'k2']).toContain(effective.key);
    }
  });

  it('returns original aws auth unchanged', () => {
    const auth: ProtocolAuth = { type: 'aws', accessKeyId: 'AK', secretAccessKey: 'SK', region: 'us-east-1' };
    const effective = getEffectiveAuth(auth);
    expect(effective).toEqual(auth);
  });

  it('returns original azure auth unchanged', () => {
    const auth: ProtocolAuth = { type: 'azure', apiKey: 'key', apiVersion: 'v1' };
    const effective = getEffectiveAuth(auth);
    expect(effective).toEqual(auth);
  });
});

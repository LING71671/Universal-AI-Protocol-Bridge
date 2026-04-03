import { describe, expect, test } from 'vitest';
import { resolveModel, DEFAULT_MODEL_MAP } from '../src/proxy/model-map';

describe('model-map wildcard resolution', () => {
  test('wildcard match: claude-* maps to gpt-4-*', () => {
    const userMap = { 'claude-*': 'gpt-4-*' } as Record<string, string>;
    expect(resolveModel('claude-sonnet-4-6', 'openai', userMap)).toBe('gpt-4-sonnet-4-6');
  });

  test('exact match priority over wildcard in user map', () => {
    const userMap = { 'claude-foo': 'openai-foo', 'claude-*': 'gpt-4-*' } as Record<string, string>;
    expect(resolveModel('claude-foo', 'openai', userMap)).toBe('openai-foo');
  });

  test('no match returns original model', () => {
    const userMap = { 'something-else': 'x' } as Record<string, string>;
    expect(resolveModel('claude-x', 'openai', userMap)).toBe('claude-x');
  });

  test('wildcard does NOT match empty string', () => {
    const userMap = { 'claude-*': 'gpt-4-*' } as Record<string, string>;
    expect(resolveModel('claude-', 'openai', userMap)).toBe('claude-');
  });

  test('multiple wildcards with substitution', () => {
    const userMap = { 'claude-*-v*': 'gpt-4-*-v*' } as Record<string, string>;
    expect(resolveModel('claude-sonnet-v2', 'openai', userMap)).toBe('gpt-4-sonnet-v2');
  });

  test('normalization strips suffix and uses exact user map', () => {
    const userMap = { 'claude-2': 'custom-gen' } as Record<string, string>;
    expect(resolveModel('claude-2[beta]', 'openai', userMap)).toBe('custom-gen');
  });

  test('forceModel overrides everything', () => {
    const userMap = { 'claude-sonnet-4-6': 'override' } as Record<string, string>;
    expect(resolveModel('claude-sonnet-4-6', 'openai', userMap, 'forced-model')).toBe('forced-model');
  });
});

describe('default map without user map', () => {
  test('openai default exact mapping preserves existing behavior', () => {
    // Using a known mapping from DEFAULT_MODEL_MAP for OpenAI
    const result = resolveModel('claude-sonnet-4-6', 'openai');
    expect(result).toBe('gpt-4o-mini');
  });
});

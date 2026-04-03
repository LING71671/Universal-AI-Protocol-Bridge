// Common model name mappings for convenience
// Users can override these via ProxyConfig.modelMap

export const DEFAULT_MODEL_MAP: Record<string, Record<string, string>> = {
  // When targeting OpenAI-compatible endpoints, map Claude model names to common alternatives
  openai: {
    'claude-opus-4-6': 'gpt-4o',
    'claude-sonnet-4-6': 'gpt-4o-mini',
    'claude-haiku-4-5': 'gpt-4o-mini',
  },
  // When targeting Gemini
  gemini: {
    'claude-opus-4-6': 'gemini-2.0-flash',
    'claude-sonnet-4-6': 'gemini-2.0-flash',
    'claude-haiku-4-5': 'gemini-1.5-flash',
  },
};

export function resolveModel(
  requestedModel: string,
  targetProtocol: string,
  userModelMap?: Record<string, string>,
  forceModel?: string
): string {
  // a) Force model
  if (forceModel) return forceModel;

  // b) Normalize: strip trailing [...] suffixes
  const normalize = (m: string) => m.replace(/\[.*?\]$/, '').trim();
  const normalizedModel = normalize(requestedModel);

  // c) Exact match in user map
  if (userModelMap?.[normalizedModel]) return userModelMap[normalizedModel]!;
  if (userModelMap?.[requestedModel]) return userModelMap[requestedModel]!;

  // d) Wildcard match in user map
  if (userModelMap) {
    for (const pattern of Object.keys(userModelMap)) {
      if (!pattern.includes('*')) continue;
      // Build regex by replacing '*' with '(.+)' and escaping other chars
      const parts = pattern.split('*');
      const escaped = parts.map(p => p.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'));
      const regex = new RegExp('^' + escaped.join('(.+)') + '$');
      const m = normalizedModel.match(regex);
      if (!m) continue;
      // captures correspond to '*' occurrences in pattern
      const captures = m.slice(1);
      let target = userModelMap?.[pattern];
      if (typeof target !== 'string') continue;
      for (const cap of captures) {
        target = target.replace('*', cap);
      }
      return target;
    }
  }

  // e) Exact match in DEFAULT_MODEL_MAP
  const defaultMap = DEFAULT_MODEL_MAP[targetProtocol];
  const exact1 = defaultMap?.[normalizedModel];
  if (typeof exact1 === 'string') return exact1;
  const exact2 = defaultMap?.[requestedModel];
  if (typeof exact2 === 'string') return exact2;

  // f) Wildcard match in DEFAULT_MODEL_MAP
  if (defaultMap) {
    for (const pattern of Object.keys(defaultMap)) {
      if (!pattern.includes('*')) continue;
      const parts = pattern.split('*');
      const escaped = parts.map(p => p.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'));
      const regex = new RegExp('^' + escaped.join('(.+)') + '$');
      const m = normalizedModel.match(regex);
      if (!m) continue;
      const captures = m.slice(1);
      let target = defaultMap?.[pattern];
      if (typeof target !== 'string') continue;
      for (const cap of captures) target = target.replace('*', cap);
      return target;
    }
  }

  // g) Fallback to original
  return requestedModel;
}

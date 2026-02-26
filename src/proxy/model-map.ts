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
  if (forceModel) return forceModel;
  // Normalize: strip trailing [...] suffixes (e.g. "[1m]" appended by Claude Code for 1M-context variants)
  const normalizedModel = requestedModel.replace(/\[.*?\]$/, '').trim();
  if (userModelMap?.[normalizedModel]) return userModelMap[normalizedModel]!;
  if (userModelMap?.[requestedModel]) return userModelMap[requestedModel]!;
  // Fall back to built-in default map
  const defaultMap = DEFAULT_MODEL_MAP[targetProtocol];
  if (defaultMap?.[normalizedModel]) return defaultMap[normalizedModel]!;
  if (defaultMap?.[requestedModel]) return defaultMap[requestedModel]!;
  return requestedModel;
}

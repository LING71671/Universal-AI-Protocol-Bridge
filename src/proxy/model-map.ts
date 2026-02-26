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
  if (userModelMap?.[requestedModel]) return userModelMap[requestedModel]!;
  return requestedModel; // pass through unchanged
}

// Mistral is OpenAI-compatible with minor differences
import { openAIAdapter, serializeOpenAIRequest, parseOpenAIRequest, parseOpenAIResponse, serializeOpenAIResponse, createOpenAIInboundStreamTransformer, createOpenAIOutboundStreamTransformer } from '../openai/index.js';
import type { ProtocolAdapter, SerializedRequest } from '../registry.js';
import type { CanonicalRequest } from '../../canonical/types.js';
import type { ProxyConfig } from '../../config/types.js';

export const mistralAdapter: ProtocolAdapter = {
  ...openAIAdapter,
  id: 'mistral',
  detect(_request, path) {
    // Mistral uses same path as OpenAI; disambiguated by config
    return false; // never auto-detected; always explicit in ProxyConfig
  },
  async serializeRequest(canonical: CanonicalRequest, config: ProxyConfig): Promise<SerializedRequest> {
    const result = serializeOpenAIRequest(canonical, config);
    // Mistral uses /v1/chat/completions same as OpenAI
    return result;
  },
};

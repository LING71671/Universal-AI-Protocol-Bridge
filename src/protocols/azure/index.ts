// Azure OpenAI: same format as OpenAI, different endpoint structure and auth
import { openAIAdapter, serializeOpenAIRequest, parseOpenAIRequest, parseOpenAIResponse, serializeOpenAIResponse, createOpenAIInboundStreamTransformer, createOpenAIOutboundStreamTransformer } from '../openai/index.js';
import type { ProtocolAdapter, SerializedRequest } from '../registry.js';
import type { CanonicalRequest } from '../../canonical/types.js';
import type { ProxyConfig } from '../../config/types.js';

export const azureAdapter: ProtocolAdapter = {
  ...openAIAdapter,
  id: 'azure',
  detect(_request, path) {
    return path.includes('/openai/deployments/');
  },
  async serializeRequest(canonical: CanonicalRequest, config: ProxyConfig): Promise<SerializedRequest> {
    const result = serializeOpenAIRequest(canonical, config);

    // Azure endpoint: {baseUrl}/openai/deployments/{model}/chat/completions?api-version={version}
    const auth = config.auth;
    const apiVersion = auth.type === 'azure' ? auth.apiVersion : '2024-10-21';
    result.url = `${config.targetBaseUrl}/openai/deployments/${canonical.model}/chat/completions?api-version=${apiVersion}`;

    // Azure uses api-key header instead of Authorization: Bearer
    if (auth.type === 'azure') {
      delete result.headers['Authorization'];
      result.headers['api-key'] = auth.apiKey;
    }

    // Azure doesn't use model in body (it's in the URL)
    const body = result.body as Record<string, unknown>;
    delete body['model'];

    return result;
  },
};

import type { Env } from './config/types.js';
import { decryptConfig } from './config/crypto.js';
import { handleUIRequest } from './ui/handler.js';
import { handleProxyRequest } from './proxy/handler.js';
import { registerAdapter } from './protocols/registry.js';

// Register all protocol adapters
import { anthropicAdapter } from './protocols/anthropic/index.js';
import { openAIAdapter } from './protocols/openai/index.js';
import { geminiAdapter } from './protocols/gemini/index.js';
import { bedrockAdapter } from './protocols/bedrock/index.js';
import { azureAdapter } from './protocols/azure/index.js';
import { ollamaAdapter } from './protocols/ollama/index.js';
import { cohereAdapter } from './protocols/cohere/index.js';
import { mistralAdapter } from './protocols/mistral/index.js';

registerAdapter(anthropicAdapter);
registerAdapter(openAIAdapter);
registerAdapter(geminiAdapter);
registerAdapter(bedrockAdapter);
registerAdapter(azureAdapter);
registerAdapter(ollamaAdapter);
registerAdapter(cohereAdapter);
registerAdapter(mistralAdapter);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // UI routes: /, /api/generate-url, /api/protocols
    if (path === '/' || path.startsWith('/api/')) {
      const response = await handleUIRequest(request, env);
      return addCORSHeaders(response);
    }

    // Proxy routes: /proxy/{token}/{...path}
    if (path.startsWith('/proxy/')) {
      const parts = path.slice(1).split('/'); // ['proxy', token, ...rest]
      const token = parts[1];
      if (!token) {
        return jsonError('Missing proxy token', 400);
      }

      let config;
      try {
        config = await decryptConfig(token, env.WORKER_SECRET);
      } catch {
        return jsonError('Invalid or expired proxy token', 401);
      }

      const upstreamPath = '/' + parts.slice(2).join('/');

      try {
        const response = await handleProxyRequest(request, config, upstreamPath);
        return addCORSHeaders(response);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        return addCORSHeaders(jsonError(message, 500));
      }
    }

    return addCORSHeaders(new Response('Not Found', { status: 404 }));
  },
} satisfies ExportedHandler<Env>;

function addCORSHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(response.body, { status: response.status, headers });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

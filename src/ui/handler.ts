import type { Env } from '../config/types.js';
import type { ProxyConfig } from '../config/types.js';
import { encryptConfig } from '../config/crypto.js';
import { generateConfigSnippets } from './config-generator.js';
import { getUITemplate } from './template.js';

export async function handleUIRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname === '/') {
    const workerUrl = `${url.protocol}//${url.host}`;
    return new Response(getUITemplate(workerUrl), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (request.method === 'POST' && url.pathname === '/api/generate-url') {
    return handleGenerateUrl(request, env);
  }

  if (request.method === 'GET' && url.pathname === '/api/protocols') {
    return new Response(JSON.stringify(PROTOCOL_INFO), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response('Not Found', { status: 404 });
}

async function handleGenerateUrl(request: Request, env: Env): Promise<Response> {
  let config: ProxyConfig;
  try {
    config = await request.json() as ProxyConfig;
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  if (!config.targetBaseUrl) return jsonError('targetBaseUrl is required', 400);
  if (!config.sourceProtocol) return jsonError('sourceProtocol is required', 400);
  if (!config.targetProtocol) return jsonError('targetProtocol is required', 400);
  if (config.version !== 1) config.version = 1;

  // Remove trailing slash from base URL
  config.targetBaseUrl = config.targetBaseUrl.replace(/\/$/, '');

  const token = await encryptConfig(config, env.WORKER_SECRET);
  const workerUrl = new URL(request.url);
  const proxyUrl = `${workerUrl.protocol}//${workerUrl.host}/proxy/${token}`;

  const snippets = generateConfigSnippets(proxyUrl, config.sourceProtocol);

  return new Response(JSON.stringify({ proxyUrl, snippets }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const PROTOCOL_INFO = {
  protocols: [
    { id: 'anthropic', name: 'Anthropic', authType: 'x-api-key', defaultUrl: 'https://api.anthropic.com' },
    { id: 'openai', name: 'OpenAI / NVIDIA / DeepSeek', authType: 'bearer', defaultUrl: 'https://api.openai.com/v1' },
    { id: 'gemini', name: 'Google Gemini', authType: 'bearer', defaultUrl: 'https://generativelanguage.googleapis.com' },
    { id: 'bedrock', name: 'AWS Bedrock', authType: 'aws', defaultUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com' },
    { id: 'azure', name: 'Azure OpenAI', authType: 'azure', defaultUrl: 'https://YOUR-RESOURCE.openai.azure.com' },
    { id: 'ollama', name: 'Ollama', authType: 'none', defaultUrl: 'http://localhost:11434' },
    { id: 'cohere', name: 'Cohere', authType: 'bearer', defaultUrl: 'https://api.cohere.com' },
    { id: 'mistral', name: 'Mistral', authType: 'bearer', defaultUrl: 'https://api.mistral.ai/v1' },
  ],
};

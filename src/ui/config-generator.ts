import type { ProtocolId } from '../canonical/types.js';

export interface ConfigSnippets {
  proxyUrl: string;
  claudeCode?: string;
  openaiPython?: string;
  openaiTS?: string;
  envBlock: string;
  curlExample: string;
}

export function generateConfigSnippets(proxyUrl: string, sourceProtocol: ProtocolId): ConfigSnippets {
  const baseUrl = proxyUrl.replace(/\/proxy\/[^/]+/, match => match); // keep full proxy URL

  const snippets: ConfigSnippets = {
    proxyUrl,
    envBlock: '',
    curlExample: '',
  };

  if (sourceProtocol === 'anthropic') {
    snippets.claudeCode = `export ANTHROPIC_BASE_URL="${proxyUrl}"
export ANTHROPIC_API_KEY="proxy-placeholder"`;

    snippets.envBlock = `ANTHROPIC_BASE_URL="${proxyUrl}"
ANTHROPIC_API_KEY="proxy-placeholder"`;

    snippets.curlExample = `curl -X POST "${proxyUrl}/v1/messages" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: proxy-placeholder" \\
  -H "anthropic-version: 2023-06-01" \\
  -d '{"model":"claude-sonnet-4-6","max_tokens":1024,"messages":[{"role":"user","content":"Hello!"}]}'`;
  } else if (sourceProtocol === 'openai' || sourceProtocol === 'mistral' || sourceProtocol === 'azure') {
    snippets.openaiPython = `from openai import OpenAI

client = OpenAI(
    base_url="${proxyUrl}/v1",
    api_key="proxy-placeholder"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)`;

    snippets.openaiTS = `import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: '${proxyUrl}/v1',
  apiKey: 'proxy-placeholder',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});`;

    snippets.envBlock = `OPENAI_BASE_URL="${proxyUrl}/v1"
OPENAI_API_KEY="proxy-placeholder"`;

    snippets.curlExample = `curl -X POST "${proxyUrl}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer proxy-placeholder" \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'`;
  } else if (sourceProtocol === 'gemini') {
    snippets.envBlock = `GEMINI_BASE_URL="${proxyUrl}"`;
    snippets.curlExample = `curl -X POST "${proxyUrl}/v1beta/models/gemini-2.0-flash:generateContent" \\
  -H "Content-Type: application/json" \\
  -H "x-goog-api-key: proxy-placeholder" \\
  -d '{"contents":[{"role":"user","parts":[{"text":"Hello!"}]}]}'`;
  } else if (sourceProtocol === 'ollama') {
    snippets.envBlock = `OLLAMA_HOST="${proxyUrl}"`;
    snippets.curlExample = `curl -X POST "${proxyUrl}/api/chat" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"llama3.2","messages":[{"role":"user","content":"Hello!"}],"stream":false}'`;
  } else {
    snippets.envBlock = `API_BASE_URL="${proxyUrl}"`;
    snippets.curlExample = `curl -X POST "${proxyUrl}" -H "Content-Type: application/json" -d '{}'`;
  }

  return snippets;
}

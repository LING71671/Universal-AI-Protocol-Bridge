export function getUITemplate(workerUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UAIPB - Universal AI Protocol Bridge</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f13; color: #e2e8f0; min-height: 100vh; }
  .container { max-width: 860px; margin: 0 auto; padding: 2rem 1.5rem; }
  h1 { font-size: 1.75rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.25rem; }
  .subtitle { color: #94a3b8; font-size: 0.9rem; margin-bottom: 2rem; }
  .card { background: #1e1e2e; border: 1px solid #2d2d3f; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .card h2 { font-size: 1rem; font-weight: 600; color: #c4b5fd; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.8rem; }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 600px) { .row { grid-template-columns: 1fr; } }
  label { display: block; font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.4rem; }
  input, select { width: 100%; background: #0f0f13; border: 1px solid #2d2d3f; border-radius: 8px; padding: 0.6rem 0.8rem; color: #e2e8f0; font-size: 0.9rem; outline: none; transition: border-color 0.2s; }
  input:focus, select:focus { border-color: #7c3aed; }
  select option { background: #1e1e2e; }
  .field { margin-bottom: 1rem; }
  .auth-fields { display: none; }
  .auth-fields.active { display: block; }
  .model-map-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: 0.5rem; margin-bottom: 0.5rem; align-items: center; }
  .btn { padding: 0.6rem 1.2rem; border-radius: 8px; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 500; transition: all 0.2s; }
  .btn-primary { background: #7c3aed; color: white; width: 100%; padding: 0.8rem; font-size: 1rem; margin-top: 0.5rem; }
  .btn-primary:hover { background: #6d28d9; }
  .btn-sm { background: #2d2d3f; color: #94a3b8; padding: 0.4rem 0.8rem; font-size: 0.8rem; }
  .btn-sm:hover { background: #3d3d4f; color: #e2e8f0; }
  .btn-danger { background: transparent; color: #ef4444; border: 1px solid #ef4444; padding: 0.3rem 0.6rem; font-size: 0.8rem; border-radius: 6px; cursor: pointer; }
  .output { display: none; }
  .output.active { display: block; }
  .url-box { background: #0f0f13; border: 1px solid #7c3aed; border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 0.85rem; word-break: break-all; color: #a78bfa; position: relative; }
  .copy-btn { position: absolute; top: 0.5rem; right: 0.5rem; background: #2d2d3f; border: none; color: #94a3b8; padding: 0.3rem 0.6rem; border-radius: 6px; cursor: pointer; font-size: 0.75rem; }
  .copy-btn:hover { color: #e2e8f0; }
  .tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
  .tab { padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid #2d2d3f; background: transparent; color: #94a3b8; cursor: pointer; font-size: 0.8rem; }
  .tab.active { background: #7c3aed; border-color: #7c3aed; color: white; }
  .code-block { background: #0f0f13; border: 1px solid #2d2d3f; border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 0.82rem; white-space: pre; overflow-x: auto; color: #a3e635; position: relative; }
  .snippet-panel { display: none; }
  .snippet-panel.active { display: block; }
  .error { background: #2d1515; border: 1px solid #ef4444; border-radius: 8px; padding: 1rem; color: #fca5a5; font-size: 0.85rem; margin-top: 1rem; display: none; }
  .error.active { display: block; }
  .badge { display: inline-block; background: #1e3a5f; color: #60a5fa; font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; margin-left: 0.5rem; vertical-align: middle; }
</style>
</head>
<body>
<div class="container">
  <h1>UAIPB <span class="badge">Universal AI Protocol Bridge</span></h1>
  <p class="subtitle">将任意 AI API 协议互转，生成加密代理 URL，零存储，无需服务器</p>

  <div class="card">
    <h2>协议配置</h2>
    <div class="row">
      <div class="field">
        <label>客户端协议（你的工具发送的格式）</label>
        <select id="sourceProtocol">
          <option value="anthropic">Anthropic (Claude Code / PentestGPT)</option>
          <option value="openai">OpenAI Chat Completions</option>
          <option value="gemini">Google Gemini</option>
          <option value="ollama">Ollama</option>
          <option value="cohere">Cohere</option>
          <option value="mistral">Mistral</option>
          <option value="azure">Azure OpenAI</option>
        </select>
      </div>
      <div class="field">
        <label>目标协议（转发到哪里）</label>
        <select id="targetProtocol">
          <option value="openai">OpenAI / NVIDIA / DeepSeek / Groq</option>
          <option value="anthropic">Anthropic Claude</option>
          <option value="gemini">Google Gemini</option>
          <option value="bedrock">AWS Bedrock</option>
          <option value="azure">Azure OpenAI</option>
          <option value="ollama">Ollama (本地)</option>
          <option value="cohere">Cohere</option>
          <option value="mistral">Mistral</option>
        </select>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>目标 API 配置</h2>
    <div class="field">
      <label>目标 API Base URL</label>
      <input type="url" id="targetBaseUrl" placeholder="https://integrate.api.nvidia.com/v1" />
    </div>

    <!-- Bearer token auth (OpenAI, Mistral, Cohere, Gemini) -->
    <div class="auth-fields" id="auth-bearer">
      <div class="field">
        <label>API Key</label>
        <input type="password" id="bearerToken" placeholder="sk-..." autocomplete="off" />
      </div>
    </div>

    <!-- x-api-key auth (Anthropic) -->
    <div class="auth-fields" id="auth-x-api-key">
      <div class="field">
        <label>API Key (x-api-key)</label>
        <input type="password" id="xApiKey" placeholder="sk-ant-..." autocomplete="off" />
      </div>
    </div>

    <!-- AWS Bedrock auth -->
    <div class="auth-fields" id="auth-aws">
      <div class="row">
        <div class="field">
          <label>AWS Access Key ID</label>
          <input type="text" id="awsAccessKeyId" placeholder="AKIAIOSFODNN7EXAMPLE" autocomplete="off" />
        </div>
        <div class="field">
          <label>AWS Secret Access Key</label>
          <input type="password" id="awsSecretAccessKey" autocomplete="off" />
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label>AWS Region</label>
          <input type="text" id="awsRegion" placeholder="us-east-1" />
        </div>
        <div class="field">
          <label>Session Token (可选)</label>
          <input type="password" id="awsSessionToken" autocomplete="off" />
        </div>
      </div>
    </div>

    <!-- Azure auth -->
    <div class="auth-fields" id="auth-azure">
      <div class="row">
        <div class="field">
          <label>Azure API Key</label>
          <input type="password" id="azureApiKey" autocomplete="off" />
        </div>
        <div class="field">
          <label>API Version</label>
          <input type="text" id="azureApiVersion" placeholder="2024-10-21" value="2024-10-21" />
        </div>
      </div>
    </div>
  </div>

  <div class="card">
    <h2>模型映射（可选）</h2>
    <p style="font-size:0.82rem;color:#64748b;margin-bottom:0.8rem">将客户端请求的模型名映射到目标模型名，留空则透传</p>
    <div id="modelMapRows"></div>
    <button class="btn btn-sm" onclick="addModelMapRow()">+ 添加映射</button>
    <div class="field" style="margin-top:1rem">
      <label>强制使用模型（覆盖所有请求，可选）</label>
      <input type="text" id="forceModel" placeholder="nvidia/llama-3.1-nemotron-70b-instruct" />
    </div>
  </div>

  <button class="btn btn-primary" onclick="generateUrl()">生成代理 URL</button>
  <div class="error" id="errorBox"></div>

  <div class="output" id="outputSection">
    <div class="card" style="margin-top:1.5rem">
      <h2>代理 URL</h2>
      <div class="url-box" id="proxyUrlBox">
        <button class="copy-btn" onclick="copyText('proxyUrlBox')">复制</button>
        <span id="proxyUrlText"></span>
      </div>
    </div>

    <div class="card">
      <h2>配置代码</h2>
      <div class="tabs" id="snippetTabs"></div>
      <div id="snippetPanels"></div>
    </div>
  </div>
</div>

<script>
const WORKER_URL = '${workerUrl}';

const AUTH_MAP = {
  openai: 'bearer', mistral: 'bearer', cohere: 'bearer', gemini: 'bearer',
  anthropic: 'x-api-key', bedrock: 'aws', azure: 'azure', ollama: 'none'
};

const DEFAULT_URLS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  bedrock: 'https://bedrock-runtime.us-east-1.amazonaws.com',
  azure: 'https://YOUR-RESOURCE.openai.azure.com',
  ollama: 'http://localhost:11434',
  cohere: 'https://api.cohere.com',
  mistral: 'https://api.mistral.ai/v1',
};

document.getElementById('targetProtocol').addEventListener('change', updateAuthFields);
updateAuthFields();

function updateAuthFields() {
  const target = document.getElementById('targetProtocol').value;
  const authType = AUTH_MAP[target] || 'bearer';
  document.querySelectorAll('.auth-fields').forEach(el => el.classList.remove('active'));
  if (authType !== 'none') {
    document.getElementById('auth-' + authType)?.classList.add('active');
  }
  const urlInput = document.getElementById('targetBaseUrl');
  if (!urlInput.value) urlInput.placeholder = DEFAULT_URLS[target] || '';
}

function addModelMapRow(from = '', to = '') {
  const container = document.getElementById('modelMapRows');
  const row = document.createElement('div');
  row.className = 'model-map-row';
  row.innerHTML = \`
    <input type="text" placeholder="claude-sonnet-4-6" value="\${from}" class="map-from" />
    <input type="text" placeholder="gpt-4o" value="\${to}" class="map-to" />
    <button class="btn-danger" onclick="this.parentElement.remove()">✕</button>
  \`;
  container.appendChild(row);
}

function getModelMap() {
  const map = {};
  document.querySelectorAll('.model-map-row').forEach(row => {
    const from = row.querySelector('.map-from').value.trim();
    const to = row.querySelector('.map-to').value.trim();
    if (from && to) map[from] = to;
  });
  return Object.keys(map).length ? map : undefined;
}

function getAuth() {
  const target = document.getElementById('targetProtocol').value;
  const authType = AUTH_MAP[target] || 'bearer';
  if (authType === 'bearer') return { type: 'bearer', token: document.getElementById('bearerToken').value.trim() };
  if (authType === 'x-api-key') return { type: 'x-api-key', key: document.getElementById('xApiKey').value.trim() };
  if (authType === 'aws') return {
    type: 'aws',
    accessKeyId: document.getElementById('awsAccessKeyId').value.trim(),
    secretAccessKey: document.getElementById('awsSecretAccessKey').value.trim(),
    region: document.getElementById('awsRegion').value.trim() || 'us-east-1',
    sessionToken: document.getElementById('awsSessionToken').value.trim() || undefined,
  };
  if (authType === 'azure') return {
    type: 'azure',
    apiKey: document.getElementById('azureApiKey').value.trim(),
    apiVersion: document.getElementById('azureApiVersion').value.trim() || '2024-10-21',
  };
  return { type: 'none' };
}

async function generateUrl() {
  const errorBox = document.getElementById('errorBox');
  errorBox.classList.remove('active');

  const config = {
    version: 1,
    sourceProtocol: document.getElementById('sourceProtocol').value,
    targetProtocol: document.getElementById('targetProtocol').value,
    targetBaseUrl: document.getElementById('targetBaseUrl').value.trim() || DEFAULT_URLS[document.getElementById('targetProtocol').value] || '',
    auth: getAuth(),
    modelMap: getModelMap(),
    forceModel: document.getElementById('forceModel').value.trim() || undefined,
  };

  if (!config.targetBaseUrl) { showError('请填写目标 API Base URL'); return; }

  try {
    const res = await fetch(WORKER_URL + '/api/generate-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || '生成失败'); return; }
    showOutput(data.proxyUrl, config.sourceProtocol, data.snippets);
  } catch (e) {
    showError('网络错误: ' + e.message);
  }
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  box.textContent = msg;
  box.classList.add('active');
}

function showOutput(proxyUrl, sourceProtocol, snippets) {
  document.getElementById('proxyUrlText').textContent = proxyUrl;
  document.getElementById('outputSection').classList.add('active');

  const tabsEl = document.getElementById('snippetTabs');
  const panelsEl = document.getElementById('snippetPanels');
  tabsEl.innerHTML = '';
  panelsEl.innerHTML = '';

  const tabs = [];
  if (snippets.claudeCode) tabs.push({ id: 'claude', label: 'Claude Code', content: snippets.claudeCode });
  if (snippets.openaiPython) tabs.push({ id: 'python', label: 'Python (OpenAI SDK)', content: snippets.openaiPython });
  if (snippets.openaiTS) tabs.push({ id: 'ts', label: 'TypeScript', content: snippets.openaiTS });
  tabs.push({ id: 'env', label: '环境变量', content: snippets.envBlock });
  tabs.push({ id: 'curl', label: 'curl', content: snippets.curlExample });

  tabs.forEach((tab, i) => {
    const btn = document.createElement('button');
    btn.className = 'tab' + (i === 0 ? ' active' : '');
    btn.textContent = tab.label;
    btn.onclick = () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.snippet-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + tab.id).classList.add('active');
    };
    tabsEl.appendChild(btn);

    const panel = document.createElement('div');
    panel.className = 'snippet-panel' + (i === 0 ? ' active' : '');
    panel.id = 'panel-' + tab.id;
    panel.innerHTML = \`<div class="code-block" id="code-\${tab.id}">\${escapeHtml(tab.content)}<button class="copy-btn" onclick="copyText('code-\${tab.id}')">复制</button></div>\`;
    panelsEl.appendChild(panel);
  });

  document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth' });
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function copyText(id) {
  const el = document.getElementById(id);
  const text = el.querySelector('span')?.textContent || el.textContent.replace('复制','').trim();
  await navigator.clipboard.writeText(text);
}
</script>
</body>
</html>`;
}

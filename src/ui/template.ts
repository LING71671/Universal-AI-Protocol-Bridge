export function getUITemplate(workerUrl: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>UAIPB - Universal AI Protocol Bridge</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg-deep: #08080c;
    --bg-body: #0c0c14;
    --bg-card: rgba(22, 22, 38, 0.7);
    --bg-input: rgba(8, 8, 16, 0.6);
    --border: rgba(56, 189, 248, 0.12);
    --border-hover: rgba(56, 189, 248, 0.3);
    --accent: #0ea5e9;
    --accent-light: #38bdf8;
    --accent-glow: rgba(14, 165, 233, 0.25);
    --text: #e2e8f0;
    --text-dim: #8892a8;
    --text-muted: #5a6478;
    --success: #34d399;
    --danger: #f87171;
    --radius: 14px;
    --radius-sm: 10px;
  }

  html { scroll-behavior: smooth; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Inter', sans-serif;
    background: var(--bg-body);
    color: var(--text);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* === Background Effects === */
  body::before {
    content: '';
    position: fixed;
    top: -40%; left: -20%;
    width: 80%; height: 80%;
    background: radial-gradient(ellipse, rgba(14,165,233,0.08) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  body::after {
    content: '';
    position: fixed;
    bottom: -30%; right: -20%;
    width: 70%; height: 70%;
    background: radial-gradient(ellipse, rgba(6,182,212,0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .page-wrapper { position: relative; z-index: 1; }

  /* === Language Toggle === */
  .lang-toggle {
    position: fixed;
    top: 1rem;
    right: 1.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    color: var(--accent-light);
    padding: 0.4rem 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    z-index: 100;
    backdrop-filter: blur(8px);
    transition: all 0.2s;
  }
  .lang-toggle:hover {
    border-color: var(--accent);
    background: rgba(14,165,233,0.1);
  }

  /* === Hero Header === */
  .hero {
    text-align: center;
    padding: 3.5rem 1.5rem 2rem;
    position: relative;
  }
  .hero-logo {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }
  .hero-icon {
    width: 48px; height: 48px;
    background: linear-gradient(135deg, #0ea5e9, #06b6d4);
    border-radius: 14px;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.5rem;
    box-shadow: 0 0 30px rgba(14,165,233,0.3);
  }
  .hero h1 {
    font-size: 2.2rem;
    font-weight: 800;
    background: linear-gradient(135deg, #e2e8f0 0%, #38bdf8 50%, #60a5fa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    letter-spacing: -0.02em;
  }
  .hero .tagline {
    color: var(--text-dim);
    font-size: 1.05rem;
    margin-top: 0.5rem;
    line-height: 1.6;
  }

  /* Feature pills */
  .features {
    display: flex;
    justify-content: center;
    gap: 0.6rem;
    margin-top: 1.5rem;
    flex-wrap: wrap;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(14,165,233,0.1);
    border: 1px solid rgba(14,165,233,0.2);
    color: var(--accent-light);
    padding: 0.35rem 0.85rem;
    border-radius: 100px;
    font-size: 0.78rem;
    font-weight: 500;
    backdrop-filter: blur(8px);
  }
  .pill-icon { font-size: 0.85rem; }

  /* === Container === */
  .container { max-width: 1100px; margin: 0 auto; padding: 0 2rem 3rem; }
  @media (min-width: 1400px) { .container { max-width: 1280px; } }
  /* === Step Flow === */
  .step {
    position: relative;
    margin-bottom: 1.5rem;
  }
  .step-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }
  .step-num {
    width: 32px; height: 32px;
    background: linear-gradient(135deg, var(--accent), #06b6d4);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.85rem;
    font-weight: 700;
    color: white;
    flex-shrink: 0;
    box-shadow: 0 0 20px var(--accent-glow);
  }
  .step-title {
    font-size: 0.82rem;
    font-weight: 600;
    color: var(--accent-light);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .step-connector {
    position: absolute;
    left: 15px;
    top: 44px;
    bottom: -1.5rem;
    width: 2px;
    background: linear-gradient(to bottom, var(--accent-glow), transparent);
    z-index: -1;
  }

  /* === Card === */
  .card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    backdrop-filter: blur(12px);
    transition: border-color 0.3s, box-shadow 0.3s;
  }
  .card:hover {
    border-color: var(--border-hover);
    box-shadow: 0 4px 30px rgba(14,165,233,0.06);
  }

  /* === Form Elements === */
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  @media (max-width: 600px) { .row { grid-template-columns: 1fr; } }

  .field { margin-bottom: 1rem; }
  label {
    display: block;
    font-size: 0.82rem;
    color: var(--text-dim);
    margin-bottom: 0.45rem;
    font-weight: 500;
  }

  input, select {
    width: 100%;
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 0.65rem 0.9rem;
    color: var(--text);
    font-size: 0.9rem;
    outline: none;
    transition: border-color 0.25s, box-shadow 0.25s;
    backdrop-filter: blur(4px);
  }
  input:focus, select:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px var(--accent-glow);
  }
  input::placeholder { color: var(--text-muted); }
  select option { background: #16162a; }

  .auth-fields { display: none; }
  .auth-fields.active { display: block; }
  /* Protocol selector enhanced */
  .protocol-grid {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 1rem;
    align-items: end;
  }
  .protocol-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    padding-bottom: 1.2rem;
    color: var(--accent-light);
    font-size: 1.4rem;
    opacity: 0.6;
  }
  @media (max-width: 600px) {
    .protocol-grid { grid-template-columns: 1fr; }
    .protocol-arrow { transform: rotate(90deg); padding: 0.5rem 0; }
  }

  /* === Model Mapping === */
  .model-map-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr auto;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    align-items: center;
  }
  .map-arrow { color: var(--text-muted); font-size: 1rem; text-align: center; }

  /* === Buttons === */
  .btn {
    padding: 0.6rem 1.2rem;
    border-radius: var(--radius-sm);
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: all 0.25s;
  }
  .btn-primary {
    background: linear-gradient(135deg, #0ea5e9, #0284c7);
    color: white;
    width: 100%;
    padding: 0.9rem;
    font-size: 1rem;
    font-weight: 600;
    margin-top: 0.5rem;
    border-radius: var(--radius);
    box-shadow: 0 4px 20px var(--accent-glow);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }
  .btn-primary:hover {
    background: linear-gradient(135deg, #0284c7, #0369a1);
    box-shadow: 0 6px 30px rgba(14,165,233,0.35);
    transform: translateY(-1px);
  }
  .btn-primary:active { transform: translateY(0); }
  .btn-primary.loading {
    pointer-events: none;
    opacity: 0.7;
  }
  .btn-primary.loading::after {
    content: '';
    width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    margin-left: 0.5rem;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .btn-sm {
    background: rgba(14,165,233,0.1);
    color: var(--accent-light);
    border: 1px dashed rgba(14,165,233,0.3);
    padding: 0.45rem 0.9rem;
    font-size: 0.8rem;
    border-radius: var(--radius-sm);
  }
  .btn-sm:hover {
    background: rgba(14,165,233,0.2);
    border-color: var(--accent);
  }
  .btn-danger {
    background: transparent;
    color: var(--danger);
    border: 1px solid rgba(248,113,113,0.3);
    padding: 0.35rem 0.65rem;
    font-size: 0.8rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .btn-danger:hover { background: rgba(248,113,113,0.1); }
  /* === Output Section (smooth transition) === */
  .output {
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    transform: translateY(20px);
    transition: opacity 0.5s ease, max-height 0.7s cubic-bezier(0.4, 0, 0.2, 1), transform 0.5s ease;
    pointer-events: none;
  }
  .output.active {
    opacity: 1;
    max-height: 3000px;
    transform: translateY(0);
    pointer-events: auto;
  }
  .output.active .step:nth-child(1) {
    animation: fadeIn 0.4s ease 0.15s both;
  }
  .output.active .step:nth-child(2) {
    animation: fadeIn 0.4s ease 0.35s both;
  }
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .url-box {
    background: var(--bg-input);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    padding: 1rem 3.5rem 1rem 1rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.82rem;
    word-break: break-all;
    color: var(--accent-light);
    position: relative;
    box-shadow: 0 0 20px var(--accent-glow);
  }
  .copy-btn {
    position: absolute;
    top: 0.5rem; right: 0.5rem;
    background: rgba(14,165,233,0.15);
    border: 1px solid rgba(14,165,233,0.3);
    color: var(--accent-light);
    padding: 0.35rem 0.7rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.2s;
  }
  .copy-btn:hover { background: rgba(14,165,233,0.3); }
  .copy-btn.copied { background: rgba(52,211,153,0.2); border-color: var(--success); color: var(--success); }

  /* === Tabs & Code === */
  .tabs {
    display: flex;
    gap: 0.4rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    background: rgba(8,8,16,0.4);
    padding: 0.3rem;
    border-radius: var(--radius-sm);
  }
  .tab {
    padding: 0.45rem 0.9rem;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 500;
    transition: all 0.2s;
  }
  .tab:hover { color: var(--text); background: rgba(14,165,233,0.1); }
  .tab.active {
    background: var(--accent);
    color: white;
    box-shadow: 0 2px 10px var(--accent-glow);
  }
  .code-block {
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 1.2rem;
    font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.82rem;
    white-space: pre;
    overflow-x: auto;
    color: #a3e635;
    position: relative;
    line-height: 1.6;
  }
  .snippet-panel { display: none; }
  .snippet-panel.active { display: block; }

  /* === Error (smooth transition) === */
  .error {
    background: rgba(248,113,113,0.08);
    border: 1px solid rgba(248,113,113,0.3);
    border-radius: var(--radius-sm);
    color: #fca5a5;
    font-size: 0.85rem;
    opacity: 0;
    max-height: 0;
    overflow: hidden;
    padding: 0 1rem;
    margin-top: 0;
    transition: opacity 0.3s ease, max-height 0.3s ease, padding 0.3s ease, margin 0.3s ease;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .error.active {
    opacity: 1;
    max-height: 100px;
    padding: 1rem;
    margin-top: 1rem;
  }

  .hint { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.8rem; line-height: 1.5; }

  .footer {
    text-align: center;
    padding: 2.5rem 1.5rem;
    color: var(--text-muted);
    font-size: 0.78rem;
    border-top: 1px solid var(--border);
    margin-top: 2rem;
  }
  .footer a { color: var(--accent-light); text-decoration: none; }
  .footer a:hover { text-decoration: underline; }
  .footer-links { display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 0.5rem; }

  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(14,165,233,0.3); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(14,165,233,0.5); }
</style>
</head>
<body>
<div class="page-wrapper">
  <!-- Language Toggle -->
  <button class="lang-toggle" onclick="toggleLang()" id="langToggle">EN</button>

  <!-- Hero -->
  <header class="hero">
    <div class="hero-logo">
      <div class="hero-icon">&#9889;</div>
      <h1>UAIPB</h1>
    </div>
    <p class="tagline" data-i18n="tagline">Universal AI Protocol Bridge &mdash; 将任意 AI API 协议互转<br>生成加密代理 URL，零存储，无需服务器</p>
    <div class="features">
      <span class="pill"><span class="pill-icon">&#128274;</span> <span data-i18n="pill_encrypt">AES-GCM 加密</span></span>
      <span class="pill"><span class="pill-icon">&#9889;</span> <span data-i18n="pill_zero">零存储架构</span></span>
      <span class="pill"><span class="pill-icon">&#127760;</span> <span data-i18n="pill_protocols">8 种协议互转</span></span>
      <span class="pill"><span class="pill-icon">&#9729;&#65039;</span> <span data-i18n="pill_cf">Cloudflare Workers</span></span>
    </div>
  </header>

  <div class="container">
    <!-- Step 1: Protocol -->
    <div class="step">
      <div class="step-connector"></div>
      <div class="step-header">
        <div class="step-num">1</div>
        <div class="step-title" data-i18n="step1_title">选择协议</div>
      </div>
      <div class="card">
        <div class="protocol-grid">
          <div class="field">
            <label data-i18n="label_source">&#128229; 客户端协议（你的工具发送的格式）</label>
            <select id="sourceProtocol">
              <option value="anthropic">Anthropic (Claude Code)</option>
              <option value="openai">OpenAI Chat Completions</option>
              <option value="gemini">Google Gemini</option>
              <option value="ollama" data-i18n="opt_ollama">Ollama</option>
              <option value="cohere">Cohere</option>
              <option value="mistral">Mistral</option>
              <option value="azure">Azure OpenAI</option>
            </select>
          </div>
          <div class="protocol-arrow">&#10132;</div>
          <div class="field">
            <label data-i18n="label_target">&#128640; 目标协议（转发到哪里）</label>
            <select id="targetProtocol">
              <option value="openai" data-i18n="opt_openai_group">OpenAI / NVIDIA / DeepSeek / Groq</option>
              <option value="anthropic">Anthropic Claude</option>
              <option value="gemini">Google Gemini</option>
              <option value="bedrock">AWS Bedrock</option>
              <option value="azure">Azure OpenAI</option>
              <option value="ollama" data-i18n="opt_ollama_local">Ollama (本地)</option>
              <option value="cohere">Cohere</option>
              <option value="mistral">Mistral</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    <!-- Step 2: API Config -->
    <div class="step">
      <div class="step-connector"></div>
      <div class="step-header">
        <div class="step-num">2</div>
        <div class="step-title" data-i18n="step2_title">目标 API 配置</div>
      </div>
      <div class="card">
        <div class="field">
          <label data-i18n="label_base_url">&#127760; 目标 API Base URL</label>
          <input type="url" id="targetBaseUrl" placeholder="https://integrate.api.nvidia.com/v1" />
        </div>
        <!-- Bearer token auth -->
        <div class="auth-fields" id="auth-bearer">
          <div class="field">
            <label data-i18n="label_api_key">&#128273; API Key</label>
            <input type="password" id="bearerToken" placeholder="sk-..." autocomplete="off" />
          </div>
        </div>
        <!-- x-api-key auth -->
        <div class="auth-fields" id="auth-x-api-key">
          <div class="field">
            <label data-i18n="label_api_key_x">&#128273; API Key (x-api-key)</label>
            <input type="password" id="xApiKey" placeholder="sk-ant-..." autocomplete="off" />
          </div>
        </div>
        <!-- AWS Bedrock auth -->
        <div class="auth-fields" id="auth-aws">
          <div class="row">
            <div class="field">
              <label data-i18n="label_aws_access">AWS Access Key ID</label>
              <input type="text" id="awsAccessKeyId" placeholder="AKIAIOSFODNN7EXAMPLE" autocomplete="off" />
            </div>
            <div class="field">
              <label data-i18n="label_aws_secret">AWS Secret Access Key</label>
              <input type="password" id="awsSecretAccessKey" autocomplete="off" />
            </div>
          </div>
          <div class="row">
            <div class="field">
              <label data-i18n="label_aws_region">AWS Region</label>
              <input type="text" id="awsRegion" placeholder="us-east-1" />
            </div>
            <div class="field">
              <label data-i18n="label_aws_session">Session Token (可选)</label>
              <input type="password" id="awsSessionToken" autocomplete="off" />
            </div>
          </div>
        </div>
        <!-- Azure auth -->
        <div class="auth-fields" id="auth-azure">
          <div class="row">
            <div class="field">
              <label data-i18n="label_azure_key">Azure API Key</label>
              <input type="password" id="azureApiKey" autocomplete="off" />
            </div>
            <div class="field">
              <label data-i18n="label_azure_ver">API Version</label>
              <input type="text" id="azureApiVersion" placeholder="2024-10-21" value="2024-10-21" />
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Step 3: Model Mapping -->
    <div class="step">
      <div class="step-header">
        <div class="step-num">3</div>
        <div class="step-title" data-i18n="step3_title">模型映射（可选）</div>
      </div>
      <div class="card">
        <p class="hint" data-i18n="hint_model">将客户端请求的模型名映射到目标模型名，留空则透传原始模型名</p>
        <div id="modelMapRows"></div>
        <button class="btn btn-sm" onclick="addModelMapRow()" data-i18n="btn_add_map">+ 添加映射</button>
        <div class="field" style="margin-top:1rem">
          <label data-i18n="label_force_model">&#127919; 强制使用模型（覆盖所有请求，可选）</label>
          <input type="text" id="forceModel" placeholder="nvidia/llama-3.1-nemotron-70b-instruct" />
        </div>
      </div>
    </div>

    <!-- Generate Button -->
    <button class="btn btn-primary" id="generateBtn" onclick="generateUrl()">
      <span>&#9889;</span> <span data-i18n="btn_generate">生成代理 URL</span>
    </button>
    <div class="error" id="errorBox"><span>&#9888;&#65039;</span> <span id="errorText"></span></div>

    <!-- Output -->
    <div class="output" id="outputSection">
      <div class="step" style="margin-top:1.5rem">
        <div class="step-header">
          <div class="step-num" style="background:linear-gradient(135deg,#34d399,#06b6d4)">&#10003;</div>
          <div class="step-title" style="color:#34d399" data-i18n="output_title">代理 URL 已生成</div>
        </div>
        <div class="card">
          <div class="url-box" id="proxyUrlBox">
            <button class="copy-btn" onclick="copyText('proxyUrlBox')" data-i18n="btn_copy">复制</button>
            <span id="proxyUrlText"></span>
          </div>
        </div>
      </div>

      <div class="step">
        <div class="step-header">
          <div class="step-num" style="background:linear-gradient(135deg,#34d399,#06b6d4)">&#128203;</div>
          <div class="step-title" style="color:#34d399" data-i18n="output_snippets">配置代码</div>
        </div>
        <div class="card">
          <div class="tabs" id="snippetTabs"></div>
          <div id="snippetPanels"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <footer class="footer">
    <div class="footer-links">
      <a href="https://github.com/LING71671/Universal-AI-Protocol-Bridge" target="_blank">GitHub</a>
      <span>&middot;</span>
      <span data-i18n="footer_powered">Powered by Cloudflare Workers</span>
    </div>
    <p>UAIPB &mdash; Universal AI Protocol Bridge</p>
  </footer>
</div>
<script>
const WORKER_URL = '${workerUrl}';

const I18N = {
  zh: {
    tagline: 'Universal AI Protocol Bridge &mdash; 将任意 AI API 协议互转<br>生成加密代理 URL，零存储，无需服务器',
    pill_encrypt: 'AES-GCM 加密',
    pill_zero: '零存储架构',
    pill_protocols: '8 种协议互转',
    pill_cf: 'Cloudflare Workers',
    step1_title: '选择协议',
    label_source: '&#128229; 客户端协议（你的工具发送的格式）',
    label_target: '&#128640; 目标协议（转发到哪里）',
    step2_title: '目标 API 配置',
    label_base_url: '&#127760; 目标 API Base URL',
    label_api_key: '&#128273; API Key',
    label_api_key_x: '&#128273; API Key (x-api-key)',
    label_aws_access: 'AWS Access Key ID',
    label_aws_secret: 'AWS Secret Access Key',
    label_aws_region: 'AWS Region',
    label_aws_session: 'Session Token (可选)',
    label_azure_key: 'Azure API Key',
    label_azure_ver: 'API Version',
    step3_title: '模型映射（可选）',
    hint_model: '将客户端请求的模型名映射到目标模型名，留空则透传原始模型名',
    btn_add_map: '+ 添加映射',
    label_force_model: '&#127919; 强制使用模型（覆盖所有请求，可选）',
    btn_generate: '生成代理 URL',
    output_title: '代理 URL 已生成',
    output_snippets: '配置代码',
    tab_env: '环境变量',
    btn_copy: '复制',
    btn_copied: '已复制',
    err_no_url: '请填写目标 API Base URL',
    err_fail: '生成失败',
    err_network: '网络错误: ',
    footer_powered: 'Powered by Cloudflare Workers',
    opt_ollama: 'Ollama',
    opt_openai_group: 'OpenAI / NVIDIA / DeepSeek / Groq',
    opt_ollama_local: 'Ollama (本地)',
  },
  en: {
    tagline: 'Universal AI Protocol Bridge &mdash; Convert any AI API protocol seamlessly<br>Generate encrypted proxy URLs, zero storage, serverless',
    pill_encrypt: 'AES-GCM Encryption',
    pill_zero: 'Zero Storage',
    pill_protocols: '8 Protocol Conversions',
    pill_cf: 'Cloudflare Workers',
    step1_title: 'Select Protocol',
    label_source: '&#128229; Client Protocol (format your tool sends)',
    label_target: '&#128640; Target Protocol (where to forward)',
    step2_title: 'Target API Configuration',
    label_base_url: '&#127760; Target API Base URL',
    label_api_key: '&#128273; API Key',
    label_api_key_x: '&#128273; API Key (x-api-key)',
    label_aws_access: 'AWS Access Key ID',
    label_aws_secret: 'AWS Secret Access Key',
    label_aws_region: 'AWS Region',
    label_aws_session: 'Session Token (optional)',
    label_azure_key: 'Azure API Key',
    label_azure_ver: 'API Version',
    step3_title: 'Model Mapping (optional)',
    hint_model: 'Map client model names to target model names. Leave empty to pass through original names.',
    btn_add_map: '+ Add Mapping',
    label_force_model: '&#127919; Force Model (override all requests, optional)',
    btn_generate: 'Generate Proxy URL',
    output_title: 'Proxy URL Generated',
    output_snippets: 'Config Snippets',
    tab_env: 'Env Variables',
    btn_copy: 'Copy',
    btn_copied: 'Copied',
    err_no_url: 'Please enter the target API Base URL',
    err_fail: 'Generation failed',
    err_network: 'Network error: ',
    footer_powered: 'Powered by Cloudflare Workers',
    opt_ollama: 'Ollama',
    opt_openai_group: 'OpenAI / NVIDIA / DeepSeek / Groq',
    opt_ollama_local: 'Ollama (Local)',
  }
};

let currentLang = localStorage.getItem('uaipb-lang') || 'zh';
function setLang(lang) {
  currentLang = lang;
  localStorage.setItem('uaipb-lang', lang);
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  const dict = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) el.innerHTML = dict[key];
  });
  document.getElementById('langToggle').textContent = lang === 'zh' ? 'EN' : '中文';
}

function toggleLang() {
  setLang(currentLang === 'zh' ? 'en' : 'zh');
}

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
    <span class="map-arrow">&#10132;</span>
    <input type="text" placeholder="gpt-4o" value="\${to}" class="map-to" />
    <button class="btn-danger" onclick="this.parentElement.remove()">&#10005;</button>
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
  const btn = document.getElementById('generateBtn');
  const errorBox = document.getElementById('errorBox');
  errorBox.classList.remove('active');
  btn.classList.add('loading');

  const config = {
    version: 1,
    sourceProtocol: document.getElementById('sourceProtocol').value,
    targetProtocol: document.getElementById('targetProtocol').value,
    targetBaseUrl: document.getElementById('targetBaseUrl').value.trim() || DEFAULT_URLS[document.getElementById('targetProtocol').value] || '',
    auth: getAuth(),
    modelMap: getModelMap(),
    forceModel: document.getElementById('forceModel').value.trim() || undefined,
  };

  if (!config.targetBaseUrl) {
    showError(I18N[currentLang].err_no_url);
    btn.classList.remove('loading');
    return;
  }

  try {
    const res = await fetch(WORKER_URL + '/api/generate-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || I18N[currentLang].err_fail);
      btn.classList.remove('loading');
      return;
    }
    showOutput(data.proxyUrl, config.sourceProtocol, data.snippets);
  } catch (e) {
    showError(I18N[currentLang].err_network + e.message);
  }
  btn.classList.remove('loading');
}

function showError(msg) {
  const box = document.getElementById('errorBox');
  document.getElementById('errorText').textContent = msg;
  box.classList.add('active');
}

function showOutput(proxyUrl, sourceProtocol, snippets) {
  document.getElementById('proxyUrlText').textContent = proxyUrl;
  document.getElementById('outputSection').classList.add('active');

  const tabsEl = document.getElementById('snippetTabs');
  const panelsEl = document.getElementById('snippetPanels');
  tabsEl.innerHTML = '';
  panelsEl.innerHTML = '';

  const dict = I18N[currentLang];
  const tabs = [];
  if (snippets.claudeCode) tabs.push({ id: 'claude', label: 'Claude Code', content: snippets.claudeCode });
  if (snippets.openaiPython) tabs.push({ id: 'python', label: 'Python', content: snippets.openaiPython });
  if (snippets.openaiTS) tabs.push({ id: 'ts', label: 'TypeScript', content: snippets.openaiTS });
  tabs.push({ id: 'env', label: dict.tab_env, content: snippets.envBlock });
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
    panel.innerHTML = \`<div class="code-block" id="code-\${tab.id}">\${escapeHtml(tab.content)}<button class="copy-btn" onclick="copyText('code-\${tab.id}')">\${dict.btn_copy}</button></div>\`;
    panelsEl.appendChild(panel);
  });

  setTimeout(() => {
    document.getElementById('outputSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 100);
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

async function copyText(id) {
  const el = document.getElementById(id);
  const span = el.querySelector('span');
  const dict = I18N[currentLang];
  const text = span ? span.textContent : el.textContent.replace(dict.btn_copy,'').replace(I18N.zh.btn_copy,'').replace(I18N.en.btn_copy,'').trim();
  await navigator.clipboard.writeText(text);
  const btn = el.querySelector('.copy-btn');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = dict.btn_copied;
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1500);
  }
}

// Initialize language
setLang(currentLang);
</script>
</body>
</html>`;
}

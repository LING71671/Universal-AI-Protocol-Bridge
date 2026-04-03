# Universal AI Protocol Bridge

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LING71671/Universal-AI-Protocol-Bridge)

**Universal AI Protocol Bridge** 是一个基于 Cloudflare Workers 构建的高性能、轻量级 AI 协议转换网关。它可以无缝地将一种 AI 供应商的 API 协议转换为另一种（例如：使用 OpenAI SDK 调用 Anthropic Claude 或 Google Gemini Pro）。

## 🌐 在线测试地址

如果您想快速体验，可以直接访问我们的测试节点：
👉 **[https://apibridge.071.cc.cd/](https://apibridge.071.cc.cd/)**

## ✨ 核心特性

- **多协议支持**: 原生支持以下多种主流 AI 供应商及协议：
  - **OpenAI** (ChatGPT-4o, o1, etc.)
  - **Anthropic** (Claude 3.5 Sonnet/Haiku/Opus)
  - **Google Gemini** (1.5 Pro/Flash)
  - **AWS Bedrock** (Llama 3, Claude, etc.)
  - **Azure OpenAI**
  - **Ollama** (本地模型接入)
  - **Cohere** & **Mistral**
- **动态协议转换**: 自动处理不同供应商之间的请求体（Request Body）、响应格式（Response Format）以及认证 Headers 的差异。
- **流式传输 (Streaming) 优化**: 针对 Server-Sent Events (SSE) 和 NDJSON 进行了深度优化，全程支持流式管道化输出，确保极致的响应速度。
- **智能模型映射 (Model Mapping)**:
  - 支持别名配置（推荐）（例如将 `gpt-4` 映射到 `claude-3-5-sonnet-latest`）
  - 支持通配符映射（例如 `claude-*` → `gpt-4-*`，自动保留后缀）
  - 支持强制模型（Force Model）模式，确保请求始终打到预期的模型
- **自动重试 (Auto Retry)**:
  - 遇到 429 (Rate Limit) 或 5xx 错误时自动重试，最多 3 次
  - 使用指数退避策略（1s → 2s → 4s），避免触发上游限流
  - 支持 `Retry-After` 响应头，优先使用服务端指定的等待时间
- **多 Key 轮询 (Multi-Key Rotation)**:
  - 支持配置多个 API Key，自动轮询使用，分散单 Key 的 Rate Limit 压力
  - 在模型映射中配置 `keys` 数组即可启用
- **结构化错误响应**:
  - 统一错误格式：`{ error_code, message, retry_after? }`
  - 机器可读的错误码（如 `RATE_LIMITED`, `RETRY_EXHAUSTED`）便于客户端处理
- **安全加固 (Security First)**:
  - 使用 Web Crypto API 实现 AES-GCM 工业级加密
  - 代理配置被封装在加密 Token 中，不在 Worker 侧存储任何敏感 Key
- **自适应前端**: 内置基于 Vue/Tailwind 风格的 Web 管理界面，支持直观地配置协议、生成代理 URL 和管理 Token
- **零存储架构**: 所有配置均通过加密 Token 传递，Worker 端无需持久化存储

## 🛠 技术架构

- **Runtime**: Cloudflare Workers (V8 Engine)
- **Language**: TypeScript (Strict Mode)
- **Bundler**: Wrangler 2 / Vite
- **Crypto**: Web Crypto API (SubtleCrypto, AES-GCM)
- **Streaming**: TransformStream (SSE, NDJSON, AWS Binary Events)

### 项目结构

```
src/
├── canonical/ # 标准格式定义 (CanonicalRequest/Response/StreamEvent)
├── config/ # 配置类型与加密/解密 (crypto.ts)
├── protocols/ # 各协议适配器 (anthropic, openai, gemini 等)
├── proxy/ # 代理核心逻辑 (handler.ts, model-map.ts)
├── streaming/ # 流式传输适配器 (SSE, JSON Lines, Bedrock Events)
├── ui/ # Web 管理界面 (handler, template, config-generator)
└── index.ts # Worker 入口点
```

## 🚀 快速启动

### 方式一：一键部署 (推荐)

点击上方的 "Deploy to Cloudflare Workers" 按钮。

### 方式二：手动部署

1. **获取代码并安装依赖**:
```bash
git clone https://github.com/LING71671/Universal-AI-Protocol-Bridge.git
cd Universal-AI-Protocol-Bridge
npm install
```

2. **配置安全密钥**:
生成用于加密代理配置的高强度密钥（建议 32 位以上字符串）：
```bash
npx wrangler secret put WORKER_SECRET
```

3. **发布到 Cloudflare**:
```bash
npm run deploy
```

---

## 📖 详细使用说明

### 工作原理

```
┌─────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  客户端 SDK  │ ──▶ │  UAIPB (Cloudflare)  │ ──▶ │   目标 AI API   │
│ (如 OpenAI) │     │    协议转换 + 加密     │     │ (如 Anthropic) │
└─────────────┘     └──────────────────────┘     └─────────────────┘
                            │
                            ▼
                    /proxy/{token}/{path}
                    token = AES-GCM(配置)
```

所有配置（目标协议、API Key、模型映射等）都被加密封装在 URL Token 中，Worker 无需存储任何敏感信息。

### Web UI 使用方法

访问部署后的域名（如 `https://your-worker.workers.dev`），按以下步骤操作：

#### 步骤 1：选择协议

| 字段 | 说明 |
|------|------|
| **客户端协议** | 你的应用/工具发送的请求格式。例如：使用 Claude Code 时选择 `Anthropic`，使用 OpenAI SDK 时选择 `OpenAI Chat Completions` |
| **目标协议** | 要转发到的 AI 服务商。例如：要调用 NVIDIA NIM API，选择 `OpenAI / NVIDIA / DeepSeek / Groq` |

**支持的协议组合**:

| 客户端协议 | 可转换到 |
|-----------|---------|
| Anthropic | OpenAI, Gemini, Bedrock, Azure, Cohere, Mistral, Ollama |
| OpenAI | Anthropic, Gemini, Bedrock, Azure, Cohere, Mistral, Ollama |
| Gemini | Anthropic, OpenAI, Bedrock, Azure, Cohere, Mistral, Ollama |
| Ollama | Anthropic, OpenAI, Gemini, Bedrock, Azure, Cohere, Mistral |
| Cohere | Anthropic, OpenAI, Gemini, Bedrock, Azure, Mistral, Ollama |
| Mistral | Anthropic, OpenAI, Gemini, Bedrock, Azure, Cohere, Ollama |
| Azure | Anthropic, OpenAI, Gemini, Bedrock, Cohere, Mistral, Ollama |

#### 步骤 2：配置目标 API

根据选择的目标协议，填写不同的认证信息：

**OpenAI / NVIDIA / DeepSeek / Groq / Cohere / Mistral / Gemini**:

> ⚠️ **重要提示**: "目标 API Base URL" 填的是**你想要调用的那个服务商的实际地址**，不是固定的 OpenAI 地址！
> 
> 例如：你选择 NVIDIA NIM，这里就应该填 NVIDIA 的地址 `https://integrate.api.nvidia.com/v1`，不是 OpenAI 的。

| 字段 | 说明 | 示例 |
|------|------|------|
| **目标 API Base URL** | **你想要调用的那个服务商的实际地址** | 见下方表格 |
| **API Key** | 对应服务商的 API Key | 见下方表格 |

**各服务商填写示例**:

| 服务商 | Base URL | API Key 格式 | Key 获取地址 |
|--------|----------|--------------|-------------|
| **OpenAI** | `https://api.openai.com/v1` | `sk-xxxxxxxx` | [platform.openai.com](https://platform.openai.com/api-keys) |
| **NVIDIA NIM** | `https://integrate.api.nvidia.com/v1` | `nvapi-xxxxxxxx` | [build.nvidia.com](https://build.nvidia.com/) |
| **DeepSeek** | `https://api.deepseek.com/v1` | `sk-xxxxxxxx` | [platform.deepseek.com](https://platform.deepseek.com/api_keys) |
| **Groq** | `https://api.groq.com/openai/v1` | `gsk_xxxxxxxx` | [console.groq.com](https://console.groq.com/keys) |
| **Cohere** | `https://api.cohere.com` | `xxxxxxxx` | [dashboard.cohere.ai](https://dashboard.cohere.ai/api-keys) |
| **Mistral** | `https://api.mistral.ai/v1` | `xxxxxxxx` | [console.mistral.ai](https://console.mistral.ai/api-keys) |
| **Gemini** | `https://generativelanguage.googleapis.com` | `AIzaSyxxxxxxxx` | [aistudio.google.com](https://aistudio.google.com/apikey) |

**Anthropic Claude**:

> ⚠️ **注意**: Anthropic 使用 `x-api-key` 认证，不是 Bearer Token。

| 字段 | 说明 | 示例 |
|------|------|------|
| **目标 API Base URL** | Anthropic API 地址（通常不用改） | `https://api.anthropic.com` |
| **API Key** | 你的 Anthropic API Key | `sk-ant-xxxxxxxx` |

**AWS Bedrock**:

> ⚠️ **注意**: 需要 AWS IAM 凭证，不是普通 API Key。

| 字段 | 说明 | 示例 |
|------|------|------|
| **目标 API Base URL** | Bedrock Runtime 地址（通常不用改） | `https://bedrock-runtime.us-east-1.amazonaws.com` |
| **AWS Access Key ID** | AWS IAM Access Key | `AKIAIOSFODNN7EXAMPLE` |
| **AWS Secret Access Key** | AWS IAM Secret Key | `wJalrXUtnFEMI/K7MDENG/...` |
| **AWS Region** | 你的 Bedrock 所在区域 | `us-east-1` / `us-west-2` |
| **Session Token** | 临时凭证（可选） | 一般留空 |

**Azure OpenAI**:

| 字段 | 说明 | 示例 |
|------|------|------|
| **目标 API Base URL** | 你的 Azure 资源地址 | `https://my-resource.openai.azure.com` |
| **Azure API Key** | Azure 密钥 | `xxxxxxxxxxxxxxxx` |
| **API Version** | API 版本 | `2024-10-21` |

**Ollama (本地)**:

| 字段 | 说明 | 示例 |
|------|------|------|
| **目标 API Base URL** | 本地 Ollama 地址 | `http://localhost:11434` |
| **认证** | 无需认证 | 留空 |

#### 步骤 3：模型映射（可选）

模型映射用于将客户端请求的模型名转换为实际的目标模型名。

**使用场景**:
- 客户端固定使用某个模型名，但你想切换到其他模型
- 不同服务商的模型命名不同，需要自动转换
- 测试或迁移时临时替换模型

**示例配置**:

| 客户端请求模型 | 映射到目标模型 |
|---------------|---------------|
| `claude-sonnet-4-6` | `gpt-4o-mini` |
| `claude-opus-4-6` | `gpt-4o` |
| `claude-*` | `gpt-4-*` |

**通配符映射**:

支持使用 `*` 作为通配符，自动保留匹配部分的后缀。例如：

| 通配符模式 | 请求模型 | 实际映射到 |
|-----------|---------|-----------|
| `claude-*` → `gpt-4-*` | `claude-sonnet-4-6` | `gpt-4-sonnet-4-6` |
| `claude-*-v*` → `gpt-4-*-v*` | `claude-sonnet-v2` | `gpt-4-sonnet-v2` |

> 💡 通配符 `*` 匹配一个或多个字符，精确匹配优先级高于通配符。

**内置默认映射**:

当目标协议为 OpenAI 时，系统自动应用以下映射：

| Claude 模型 | 映射到 OpenAI |
|------------|---------------|
| `claude-opus-4-6` | `gpt-4o` |
| `claude-sonnet-4-6` | `gpt-4o-mini` |
| `claude-haiku-4-5` | `gpt-4o-mini` |

当目标协议为 Gemini 时：

| Claude 模型 | 映射到 Gemini |
|------------|---------------|
| `claude-opus-4-6` | `gemini-2.0-flash` |
| `claude-sonnet-4-6` | `gemini-2.0-flash` |
| `claude-haiku-4-5` | `gemini-1.5-flash` |

**强制模型**: 如果需要所有请求都使用同一个模型（忽略客户端请求的模型名），填写"强制使用模型"字段。

**多 Key 轮询**: 如果配置了多个 API Key，系统会自动轮询使用，分散 Rate Limit 压力。在生成代理 URL 后，通过 API 直接生成 Token 时可在 `auth` 中使用 `keys` 数组：

```json
{
  "auth": {
    "type": "bearer",
    "token": "sk-key1",
    "keys": ["sk-key1", "sk-key2", "sk-key3"]
  }
}
```

> 💡 每次请求会自动从 `keys` 数组中选择一个 Key 使用，无需额外配置。

**特殊处理**: Claude Code 发送的模型名可能带有 `[1m]` 后缀（表示 1M 上下文），如 `claude-sonnet-4-6[1m]`。系统会自动去除后缀后再进行映射。

---

### 🚀 快速示例（看完就会填）

#### 场景 1：用 Claude Code 调用 OpenAI GPT-4o

| 步骤 | 字段 | 填写内容 |
|------|------|----------|
| 1 | 客户端协议 | `Anthropic (Claude Code)` |
| 1 | 目标协议 | `OpenAI / NVIDIA / DeepSeek / Groq` |
| 2 | 目标 API Base URL | `https://api.openai.com/v1` |
| 2 | API Key | 你的 OpenAI API Key（`sk-...`） |
| 3 | 模型映射（可选） | 留空（会自动映射 Claude → GPT） |

生成后设置环境变量：
```bash
export ANTHROPIC_BASE_URL="https://你的worker.workers.dev/proxy/xxx"
export ANTHROPIC_API_KEY="proxy-placeholder"
```

#### 场景 2：用 Claude Code 调用 NVIDIA NIM

| 步骤 | 字段 | 填写内容 |
|------|------|----------|
| 1 | 客户端协议 | `Anthropic (Claude Code)` |
| 1 | 目标协议 | `OpenAI / NVIDIA / DeepSeek / Groq` |
| 2 | 目标 API Base URL | `https://integrate.api.nvidia.com/v1` |
| 2 | API Key | 你的 NVIDIA API Key（`nvapi-...`） |
| 3 | 强制使用模型 | `nvidia/llama-3.1-nemotron-70b-instruct` |

#### 场景 3：用 OpenAI SDK 调用 Anthropic Claude

| 步骤 | 字段 | 填写内容 |
|------|------|----------|
| 1 | 客户端协议 | `OpenAI Chat Completions` |
| 1 | 目标协议 | `Anthropic Claude` |
| 2 | 目标 API Base URL | `https://api.anthropic.com` |
| 2 | API Key | 你的 Anthropic API Key（`sk-ant-...`） |
| 3 | 模型映射（可选） | 留空 |

生成后代码中设置：
```python
from openai import OpenAI
client = OpenAI(
    base_url="https://你的worker.workers.dev/proxy/xxx/v1",
    api_key="proxy-placeholder"
)
response = client.chat.completions.create(
    model="claude-sonnet-4-6",  # 这里填你想用的 Claude 模型
    messages=[{"role": "user", "content": "Hello!"}]
)
```

#### 场景 4：用 Claude Code 调用 DeepSeek

| 步骤 | 字段 | 填写内容 |
|------|------|----------|
| 1 | 客户端协议 | `Anthropic (Claude Code)` |
| 1 | 目标协议 | `OpenAI / NVIDIA / DeepSeek / Groq` |
| 2 | 目标 API Base URL | `https://api.deepseek.com/v1` |
| 2 | API Key | 你的 DeepSeek API Key（`sk-...`） |
| 3 | 强制使用模型 | `deepseek-chat` |

---

---

### 生成代理 URL

点击"生成代理 URL"按钮后，系统会返回：

1. **代理 URL**: 形如 `https://your-worker.workers.dev/proxy/{encrypted_token}`
2. **配置代码**: 多种语言的集成示例

### URL 格式说明

```
https://your-worker.workers.dev/proxy/{encrypted_token}/{upstream_path}
                                  │                │       │
                                  │                │       └── 可选：上游路径
                                  │                └── AES-GCM 加密的配置
                                  └── 代理路由前缀
```

**Token 内容** (加密前 JSON):

```json
{
  "version": 1,
  "sourceProtocol": "anthropic",
  "targetProtocol": "openai",
  "targetBaseUrl": "https://api.openai.com/v1",
  "auth": {
    "type": "bearer",
    "token": "sk-xxxxxxxx"
  },
  "modelMap": {
    "claude-sonnet-4-6": "gpt-4o-mini"
  },
  "forceModel": null
}
```

---

### ❌ 常见填写错误

| 错误 | 问题 | 正确做法 |
|------|------|----------|
| Base URL 填了 OpenAI 地址 | 想用 NVIDIA 却填了 `https://api.openai.com/v1` | 填实际想调用的服务地址，如 NVIDIA 填 `https://integrate.api.nvidia.com/v1` |
| API Key 填错了 | 用 NVIDIA 却填了 OpenAI 的 Key | 填对应服务商的 API Key |
| 忘记 `/v1` | Base URL 填 `https://api.openai.com` 少了 `/v1` | 要包含 `/v1`，如 `https://api.openai.com/v1` |
| 混淆客户端和目标协议 | 想用 OpenAI SDK 调 Claude，却选了反向 | 客户端 = 你用的 SDK，目标 = 你想调用的 API |

> 💡 **核心原则**: "目标协议"是上游 API 兼容什么格式，"Base URL"是那个上游 API 的实际地址。两者是一一对应的。

---

## 💻 代码集成示例

### Claude Code (Anthropic)

```bash
# 环境变量
export ANTHROPIC_BASE_URL="https://your-worker.workers.dev/proxy/{token}"
export ANTHROPIC_API_KEY="proxy-placeholder"  # 任意非空值即可
```

**注意**: API Key 可以填写任意非空字符串（如 `proxy-placeholder`），实际认证已封装在 Token 中。

### Python (OpenAI SDK)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-worker.workers.dev/proxy/{token}/v1",
    api_key="proxy-placeholder"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(response.choices[0].message.content)
```

### TypeScript / Node.js

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://your-worker.workers.dev/proxy/{token}/v1',
  apiKey: 'proxy-placeholder',
});

const response = await client.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### curl

```bash
curl -X POST "https://your-worker.workers.dev/proxy/{token}/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer proxy-placeholder" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Gemini API

```bash
curl -X POST "https://your-worker.workers.dev/proxy/{token}/v1beta/models/gemini-2.0-flash:generateContent" \
  -H "Content-Type: application/json" \
  -H "x-goog-api-key: proxy-placeholder" \
  -d '{
    "contents": [{"role": "user", "parts": [{"text": "Hello!"}]}]
  }'
```

### Ollama

```bash
curl -X POST "https://your-worker.workers.dev/proxy/{token}/api/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2",
    "messages": [{"role": "user", "content": "Hello!"}],
    "stream": false
  }'
```

---

## 🔧 高级用法

### 通过 API 直接生成 Token

如果需要在程序中动态生成代理 URL，可以直接调用 API：

```bash
curl -X POST "https://your-worker.workers.dev/api/generate-url" \
  -H "Content-Type: application/json" \
  -d '{
    "version": 1,
    "sourceProtocol": "openai",
    "targetProtocol": "anthropic",
    "targetBaseUrl": "https://api.anthropic.com",
    "auth": {
      "type": "x-api-key",
      "key": "sk-ant-xxxxxxxx"
    },
    "modelMap": {
      "gpt-4o": "claude-sonnet-4-6"
    }
  }'
```

**响应**:

```json
{
  "proxyUrl": "https://your-worker.workers.dev/proxy/xxxxxx",
  "snippets": {
    "claudeCode": "...",
    "openaiPython": "...",
    "openaiTS": "...",
    "envBlock": "...",
    "curlExample": "..."
  }
}
```

### 获取支持的协议列表

```bash
curl "https://your-worker.workers.dev/api/protocols"
```

**响应**:

```json
{
  "protocols": [
    {"id": "anthropic", "name": "Anthropic", "authType": "x-api-key", "defaultUrl": "https://api.anthropic.com"},
    {"id": "openai", "name": "OpenAI / NVIDIA / DeepSeek", "authType": "bearer", "defaultUrl": "https://api.openai.com/v1"},
    {"id": "gemini", "name": "Google Gemini", "authType": "bearer", "defaultUrl": "https://generativelanguage.googleapis.com"},
    {"id": "bedrock", "name": "AWS Bedrock", "authType": "aws", "defaultUrl": "https://bedrock-runtime.us-east-1.amazonaws.com"},
    {"id": "azure", "name": "Azure OpenAI", "authType": "azure", "defaultUrl": "https://YOUR-RESOURCE.openai.azure.com"},
    {"id": "ollama", "name": "Ollama", "authType": "none", "defaultUrl": "http://localhost:11434"},
    {"id": "cohere", "name": "Cohere", "authType": "bearer", "defaultUrl": "https://api.cohere.com"},
    {"id": "mistral", "name": "Mistral", "authType": "bearer", "defaultUrl": "https://api.mistral.ai/v1"}
  ]
}
```

---

## 🧪 研发、测试与风格

- **本地实时预览**: `npm run dev`
- **单元测试**: `npm test` (基于 Vitest)
- **类型安全性验证**: `npm run type-check`

## 🤝 贡献与反馈

如果您在使用过程中遇到任何问题，或者希望支持更多的 AI 协议，欢迎提交 [Issue](https://github.com/LING71671/Universal-AI-Protocol-Bridge/issues) 或 Pull Request。

## 📄 开源协议

本项目采用 [GPL-3.0](LICENSE) 协议开源。

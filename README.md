# Universal AI Protocol Bridge

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LING71671/Universal-AI-Protocol-Bridge)

**Universal AI Protocol Bridge** 是一个基于 Cloudflare Workers 构建的高性能、轻量级 AI 协议转换网关。它可以无缝地将一种 AI 供应商的 API 协议转换为另一种（例如：使用 OpenAI SDK 调用 Anthropic Claude 3.5 或 Google Gemini Pro）。

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
  - 支持别名配置（例如将 `gpt-4` 映射到 `claude-3-5-sonnet-latest`）。（推荐）
  - 支持强制模型（Force Model）模式，确保请求始终打到预期的模型。
- **安全加固 (Security First)**: 
  - 使用 Web Crypto API 实现 AES-GCM 工业级加密。
  - 代理配置被封装在加密 Token 中，不在 Worker 侧存储任何敏感 Key。
- **自适应前端**: 内置基于 Vue/Tailwind 风格的 Web 管理界面，支持直观地配置协议、生成代理 URL 和管理 Token。

## 🛠 技术架构

- **Runtime**: Cloudflare Workers (V8 Engine)
- **Language**: TypeScript (Strict Mode)
- **Bundler**: Wrangler
- **Crypto**: Web Crypto API (SubtleCrypto)
- **Streaming**: TransformStream Logic

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

## � 使用说明

1. **生成代理 URL**: 访问您的部署域名或 [测试地址](https://apibridge.071.cc.cd/)。
2. **选择协议**: 填入目标供应商（如 Anthropic）和您的 API Key。
3. **获取 Token**: 点击生成按钮，系统将为你创建一个包含加密配置的专属 Endpoint。
4. **集成**: 将您的应用中的 `baseURL` 替换为生成的代理 URL 即可。

## 🧪 研发、测试与风格

- **本地实时预览**: `npm run dev`
- **单元测试**: `npm test` (基于 Vitest)
- **类型安全性验证**: `npm run type-check`

## 🤝 贡献与反馈

如果您在使用过程中遇到任何问题，或者希望支持更多的 AI 协议，欢迎提交 [Issue](https://github.com/LING71671/Universal-AI-Protocol-Bridge/issues) 或 Pull Request。

## 📄 开源协议

本项目采用 [MIT](LICENSE) 协议开源。

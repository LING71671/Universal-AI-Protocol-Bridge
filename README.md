# Universal AI Protocol Bridge

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/LING71671/Universal-AI-Protocol-Bridge)

**Universal AI Protocol Bridge** 是一个基于 Cloudflare Workers 构建的高性能、轻量级 AI 协议转换网关。它可以无缝地将一种 AI 供应商的 API 协议转换为另一种（例如：使用 OpenAI SDK 调用 Anthropic Claude 3.5 或 Google Gemini Pro）。

## ✨ 核心特性

- **多协议支持**: 原生支持 OpenAI, Anthropic, Google Gemini, AWS Bedrock, Azure OpenAI, Ollama, Cohere, 以及 Mistral。
- **动态协议转换**: 自动处理不同供应商之间的请求体、响应体以及 Headers 差异。
- **流式传输 (Streaming)**: 全程支持流式管道化输出，确保极低的延迟（TTFT）。
- **智能模型映射**: 支持基于配置的模型重命名和强制模型匹配。
- **安全加固**: 使用 AES-GCM 加密代理令牌，保护您的 API 密钥和上游配置。
- **自托管前端**: 内置简单易用的 Web 界面，用于生成和管理加密的代理 URL。

## 🚀 快速开始

### 部署到 Cloudflare Workers

1. 克隆代码库：
   ```bash
   git clone https://github.com/LING71671/Universal-AI-Protocol-Bridge.git
   cd Universal-AI-Protocol-Bridge
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

3. 设置工作密钥（用于加密令牌）：
   ```bash
   npx wrangler secret put WORKER_SECRET
   ```

4. 部署：
   ```bash
   npm run deploy
   ```

## 🛠 开发与测试

- **本地开发**: `npm run dev`
- **运行测试**: `npm test`
- **类型检查**: `npm run type-check`

## 📖 使用示例

部署完成后，访问您的 Worker 根地址（如 `https://ai-bridge.your-subdomain.workers.dev`），使用 UI 生成代理 URL。

生成的 URL 格式如下：
`https://ai-bridge.your-subdomain.workers.dev/proxy/{encrypted_token}/v1/chat/completions`

您可以像使用普通 OpenAI API 一样使用此 URL。

## 🤝 贡献

欢迎提交 Issue 或 Pull Request！

## 📄 开源协议

MIT

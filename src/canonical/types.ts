// Canonical intermediate format - the hub of the hub-and-spoke translation architecture.
// All protocol adapters translate to/from these types.

export type ProtocolId =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'bedrock'
  | 'azure'
  | 'ollama'
  | 'cohere'
  | 'mistral';

// ── Content Parts ─────────────────────────────────────────────────────────────

export interface CanonicalTextPart {
  type: 'text';
  text: string;
}

export interface CanonicalImagePart {
  type: 'image';
  mediaType: string; // e.g. 'image/jpeg'
  data: string;      // base64 encoded
}

export interface CanonicalToolCallPart {
  type: 'tool_call';
  id: string;
  name: string;
  arguments: Record<string, unknown>; // always parsed object, never raw JSON string
}

export interface CanonicalToolResultPart {
  type: 'tool_result';
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface CanonicalThinkingPart {
  type: 'thinking';
  thinking: string;
}

export type CanonicalContentPart =
  | CanonicalTextPart
  | CanonicalImagePart
  | CanonicalToolCallPart
  | CanonicalToolResultPart
  | CanonicalThinkingPart;

// ── Messages ──────────────────────────────────────────────────────────────────

export type CanonicalRole = 'system' | 'user' | 'assistant' | 'tool';

export interface CanonicalMessage {
  role: CanonicalRole;
  content: CanonicalContentPart[];
  name?: string;
}

// ── Tool Definitions ──────────────────────────────────────────────────────────

export interface CanonicalToolDefinition {
  name: string;
  description?: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export type CanonicalToolChoice =
  | { type: 'auto' }
  | { type: 'none' }
  | { type: 'required' }
  | { type: 'specific'; name: string };

// ── Stop Reasons ──────────────────────────────────────────────────────────────

export type CanonicalStopReason =
  | 'end_turn'
  | 'tool_use'
  | 'max_tokens'
  | 'stop_sequence'
  | 'error';

// ── Request / Response ────────────────────────────────────────────────────────

export interface CanonicalRequest {
  model: string;
  messages: CanonicalMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  stream: boolean;
  tools?: CanonicalToolDefinition[];
  toolChoice?: CanonicalToolChoice;
  userId?: string;
  extensions?: Record<string, unknown>;
}

export interface CanonicalResponse {
  id: string;
  model: string;
  content: CanonicalContentPart[];
  stopReason: CanonicalStopReason;
  stopSequence?: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ── Streaming Events ──────────────────────────────────────────────────────────

export type CanonicalStreamEvent =
  | { type: 'message_start'; id: string; model: string; inputTokens: number }
  | { type: 'text_delta'; index: number; text: string }
  | { type: 'thinking_delta'; index: number; thinking: string }
  | { type: 'tool_call_start'; index: number; id: string; name: string }
  | { type: 'tool_call_delta'; index: number; argumentsChunk: string }
  | { type: 'tool_call_end'; index: number }
  | { type: 'content_block_end'; index: number }
  | { type: 'message_end'; stopReason: CanonicalStopReason; outputTokens: number }
  | { type: 'error'; message: string; code?: number };

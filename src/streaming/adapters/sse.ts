// SSE (Server-Sent Events) encoder/decoder
// Used by: Anthropic, OpenAI, Gemini, Cohere, Mistral, Azure

export interface SSEEvent {
  event?: string;
  data: string;
}

/** Decodes a raw byte stream into SSE event objects */
export function createSSEDecoder(): TransformStream<Uint8Array, SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = '';

  return new TransformStream<Uint8Array, SSEEvent>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        const lines = part.split('\n');
        let event: string | undefined;
        let data = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            event = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            data = line.slice(6);
          }
        }

        if (data) {
          controller.enqueue({ event, data });
        }
      }
    },
    flush(controller) {
      // Handle any remaining buffer content
      if (buffer.trim()) {
        const lines = buffer.split('\n');
        let event: string | undefined;
        let data = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) event = line.slice(7).trim();
          else if (line.startsWith('data: ')) data = line.slice(6);
        }
        if (data) controller.enqueue({ event, data });
      }
    }
  });
}

/** Encodes SSE events to bytes */
export function formatSSE(event: string | undefined, data: unknown): Uint8Array {
  let str = '';
  if (event) str += `event: ${event}\n`;
  str += `data: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(str);
}

export function formatSSEDone(): Uint8Array {
  return new TextEncoder().encode('data: [DONE]\n\n');
}

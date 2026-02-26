// JSON-lines decoder for Ollama streaming
// Each line is a complete JSON object terminated by \n

export function createJSONLinesDecoder(): TransformStream<Uint8Array, unknown> {
  const decoder = new TextDecoder();
  let buffer = '';

  return new TransformStream<Uint8Array, unknown>({
    transform(chunk, controller) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          controller.enqueue(JSON.parse(trimmed));
        } catch {
          // skip malformed lines
        }
      }
    },
    flush(controller) {
      if (buffer.trim()) {
        try {
          controller.enqueue(JSON.parse(buffer.trim()));
        } catch {
          // ignore
        }
      }
    }
  });
}

export function formatJSONLine(data: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data) + '\n');
}

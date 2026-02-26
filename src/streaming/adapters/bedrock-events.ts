// AWS event-stream binary frame decoder for Bedrock streaming
// Frame format: [total_length:4][headers_length:4][prelude_crc:4][headers][payload][message_crc:4]

export interface BedrockEvent {
  eventType: string;
  payload: unknown;
}

function readUint32BE(buf: Uint8Array, offset: number): number {
  return ((buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!) >>> 0;
}

function parseHeaders(buf: Uint8Array): Record<string, string> {
  const headers: Record<string, string> = {};
  let i = 0;
  while (i < buf.length) {
    const nameLen = buf[i]!;
    i++;
    const name = new TextDecoder().decode(buf.slice(i, i + nameLen));
    i += nameLen;
    const valueType = buf[i]!;
    i++;
    if (valueType === 7) { // string type
      const valueLen = (buf[i]! << 8) | buf[i + 1]!;
      i += 2;
      headers[name] = new TextDecoder().decode(buf.slice(i, i + valueLen));
      i += valueLen;
    } else {
      break; // unsupported header type, stop parsing
    }
  }
  return headers;
}

export function createBedrockEventStreamDecoder(): TransformStream<Uint8Array, BedrockEvent> {
  let buffer = new Uint8Array(0);

  return new TransformStream<Uint8Array, BedrockEvent>({
    transform(chunk, controller) {
      // Append chunk to buffer
      const newBuf = new Uint8Array(buffer.length + chunk.length);
      newBuf.set(buffer, 0);
      newBuf.set(chunk, buffer.length);
      buffer = newBuf;

      // Process complete frames
      while (buffer.length >= 12) {
        const totalLength = readUint32BE(buffer, 0);
        if (buffer.length < totalLength) break; // wait for more data

        const headersLength = readUint32BE(buffer, 4);
        // prelude_crc at bytes 8-11 (skip validation for now)

        const headersStart = 12;
        const headersEnd = headersStart + headersLength;
        const payloadEnd = totalLength - 4; // last 4 bytes are message CRC

        const headersBuf = buffer.slice(headersStart, headersEnd);
        const payloadBuf = buffer.slice(headersEnd, payloadEnd);

        const headers = parseHeaders(headersBuf);
        const eventType = headers[':event-type'] ?? headers[':exception-type'] ?? 'unknown';

        try {
          const payload = JSON.parse(new TextDecoder().decode(payloadBuf));
          controller.enqueue({ eventType, payload });
        } catch {
          // skip malformed payload
        }

        buffer = buffer.slice(totalLength);
      }
    }
  });
}

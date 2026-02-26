import type { CanonicalStreamEvent } from '../canonical/types.js';

/**
 * Chains two TransformStreams: source → middle → output
 * Returns a single TransformStream that represents the full pipeline.
 */
export function chainTransformStreams<A, B, C>(
  first: TransformStream<A, B>,
  second: TransformStream<B, C>
): TransformStream<A, C> {
  first.readable.pipeTo(second.writable).catch(() => {});
  return {
    writable: first.writable,
    readable: second.readable,
  };
}

/**
 * Creates a streaming pipeline that:
 * 1. Takes the upstream response body
 * 2. Passes it through the inbound transformer (protocol bytes → CanonicalStreamEvents)
 * 3. Passes it through the outbound transformer (CanonicalStreamEvents → client bytes)
 * 4. Returns an HTTP Response with the resulting stream
 */
export function createStreamingResponse(
  upstreamBody: ReadableStream<Uint8Array>,
  inboundTransformer: TransformStream<Uint8Array, CanonicalStreamEvent>,
  outboundTransformer: TransformStream<CanonicalStreamEvent, Uint8Array>,
  contentType: string
): Response {
  const outputStream = upstreamBody
    .pipeThrough(inboundTransformer)
    .pipeThrough(outboundTransformer);

  return new Response(outputStream, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}

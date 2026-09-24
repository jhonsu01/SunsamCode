/**
 * Envuelve un stream de respuesta sin alterarlo: decodifica texto para el acumulador y mide el
 * primer chunk. `onEnd` se ejecuta exactamente una vez (fin normal, error o cancelación del cliente).
 */
import type { Clock } from "./ports.js";

interface StreamEnd {
  firstChunkAt?: number;
  endedAt: number;
  failed: boolean;
  cancelled: boolean;
}

interface StreamObserverHooks {
  onChunk(text: string): void;
  onEnd(end: StreamEnd): void;
}

export function observeStream(
  upstream: ReadableStream<Uint8Array>,
  clock: Clock,
  hooks: StreamObserverHooks,
): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  let firstChunkAt: number | undefined;
  let finished = false;
  const finish = (failed: boolean, cancelled: boolean) => {
    if (finished) return;
    finished = true;
    const tail = decoder.decode();
    if (tail) hooks.onChunk(tail);
    hooks.onEnd({ firstChunkAt, endedAt: clock.now(), failed, cancelled });
  };
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          finish(false, false);
          controller.close();
          return;
        }
        firstChunkAt ??= clock.now();
        hooks.onChunk(decoder.decode(value, { stream: true }));
        controller.enqueue(value);
      } catch (error) {
        finish(true, false);
        controller.error(error);
      }
    },
    async cancel(reason) {
      finish(false, true);
      await reader.cancel(reason);
    },
  });
}

/**
 * Métricas normalizadas por bytes (arXiv 2609.12303): BPB y throughput en bytes/s permiten comparar
 * modelos con tokenizadores distintos, algo que tokens/s o perplexity por token no permiten.
 */

interface ScoredToken {
  logprob: number;
  /** Número de bytes UTF-8 del token. */
  byteLength: number;
}

/** Bits-per-byte = Σ −ln p(token) / (ln 2 · Σ bytes). `null` si no hay bytes puntuables. */
export function bitsPerByte(tokens: readonly ScoredToken[]): number | null {
  let nats = 0;
  let bytes = 0;
  for (const token of tokens) {
    if (!Number.isFinite(token.logprob) || token.byteLength <= 0) continue;
    nats -= token.logprob;
    bytes += token.byteLength;
  }
  return bytes > 0 ? nats / (Math.LN2 * bytes) : null;
}

/** Throughput independiente del tokenizador. */
export function bytesPerSecond(bytes: number, elapsedMs: number): number | null {
  if (bytes <= 0 || elapsedMs <= 0) return null;
  return (bytes * 1000) / elapsedMs;
}

/** Media móvil exponencial; con `previous` indefinido devuelve la muestra. */
export function ewma(previous: number | undefined, sample: number, alpha = 0.3): number {
  return previous === undefined ? sample : previous + alpha * (sample - previous);
}

/** Bytes UTF-8 medios por token observados (≈4.5 en el paper para Llama 3). */
export function bytesPerToken(tokens: readonly ScoredToken[]): number | null {
  const counted = tokens.filter((token) => token.byteLength > 0);
  if (counted.length === 0) return null;
  return counted.reduce((sum, token) => sum + token.byteLength, 0) / counted.length;
}

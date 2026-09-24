/**
 * Conversión de logits de tokens a logits de bytes en una sola pasada, según
 * "Breaking the Token Ceiling: Distilling Smaller, Stronger Byte Models" (arXiv 2609.12303, §2).
 *
 * - Marginalize-It (aproximado): en el byte j sólo cuentan los tokens que siguen *más allá* del
 *   prefijo; la masa de los tokens que terminan en el prefijo se pierde y se renormaliza.
 * - End-Of-Token (exacto): se añade `<eot>` (índice 256) al vocabulario de bytes; la masa de los
 *   tokens que terminan exactamente en el prefijo va a `<eot>`, así no se pierde probabilidad.
 */

export const EOT_BYTE = 256;

/** Un token candidato de la distribución del teacher: sus bytes UTF-8 y su log-probabilidad. */
export interface TokenCandidate {
  bytes: readonly number[];
  logprob: number;
}

/** Distribución dispersa sobre bytes (0..255) y `<eot>` (256), ordenada por probabilidad desc. */
export type ByteDistribution = ReadonlyArray<readonly [byte: number, prob: number]>;

export interface BytePosition {
  /** Byte objetivo (ground truth) en esta posición; `EOT_BYTE` para el cierre del token. */
  target: number;
  dist: ByteDistribution;
  /** Masa del teacher (sobre el total del top-k conocido) que cae dentro de los candidatos. */
  coverage: number;
}

const encoder = new TextEncoder();

/** Bytes UTF-8 de un token; usa `bytes` de la API si viene (tokens parciales de UTF-8). */
export function tokenBytes(token: string, bytes?: readonly number[] | null): number[] {
  return bytes && bytes.length > 0 ? [...bytes] : [...encoder.encode(token)];
}

function hasPrefix(bytes: readonly number[], prefix: readonly number[], length: number): boolean {
  if (bytes.length < length) return false;
  for (let index = 0; index < length; index += 1) {
    if (bytes[index] !== prefix[index]) return false;
  }
  return true;
}

function toSortedDistribution(masses: Map<number, number>, total: number): ByteDistribution {
  if (total <= 0) return [];
  return [...masses.entries()]
    .map(([byte, mass]) => [byte, mass / total] as const)
    .sort((left, right) => right[1] - left[1] || left[0] - right[0]);
}

/** Probabilidades normalizadas; añade el token objetivo si el top-k no lo incluía. */
function normalizeCandidates(
  candidates: readonly TokenCandidate[],
  target: readonly number[],
  targetLogprob?: number,
): { items: Array<{ bytes: readonly number[]; prob: number }>; knownMass: number } {
  const items = candidates
    .filter((candidate) => candidate.bytes.length > 0 && Number.isFinite(candidate.logprob))
    .map((candidate) => ({ bytes: candidate.bytes, prob: Math.exp(candidate.logprob) }));
  const hasTarget = items.some(
    (item) => item.bytes.length === target.length && hasPrefix(item.bytes, target, target.length),
  );
  if (!hasTarget && targetLogprob !== undefined && Number.isFinite(targetLogprob)) {
    items.push({ bytes: target, prob: Math.exp(targetLogprob) });
  }
  const knownMass = items.reduce((sum, item) => sum + item.prob, 0);
  return { items, knownMass };
}

function assertTarget(target: readonly number[]): void {
  if (target.length === 0) {
    throw new Error("byteLogits: el token objetivo no puede estar vacío");
  }
}

/**
 * Marginalize-It: devuelve `target.length` distribuciones (una por byte del token objetivo).
 * El primer byte es exacto; los siguientes renormalizan sobre los tokens que continúan el prefijo.
 */
export function marginalizeItByteDistributions(
  candidates: readonly TokenCandidate[],
  target: readonly number[],
  targetLogprob?: number,
): BytePosition[] {
  assertTarget(target);
  const { items, knownMass } = normalizeCandidates(candidates, target, targetLogprob);
  const positions: BytePosition[] = [];
  for (let position = 0; position < target.length; position += 1) {
    const masses = new Map<number, number>();
    let total = 0;
    for (const item of items) {
      if (item.bytes.length <= position || !hasPrefix(item.bytes, target, position)) continue;
      const byte = item.bytes[position]!;
      masses.set(byte, (masses.get(byte) ?? 0) + item.prob);
      total += item.prob;
    }
    positions.push({
      target: target[position]!,
      dist: toSortedDistribution(masses, total),
      coverage: knownMass > 0 ? total / knownMass : 0,
    });
  }
  return positions;
}

/**
 * End-Of-Token: devuelve `target.length + 1` distribuciones; la última predice `<eot>` tras el
 * token completo. La masa de los tokens que terminan exactamente en el prefijo va a `<eot>`.
 */
export function endOfTokenByteDistributions(
  candidates: readonly TokenCandidate[],
  target: readonly number[],
  targetLogprob?: number,
): BytePosition[] {
  assertTarget(target);
  const { items, knownMass } = normalizeCandidates(candidates, target, targetLogprob);
  const positions: BytePosition[] = [];
  for (let position = 0; position <= target.length; position += 1) {
    const masses = new Map<number, number>();
    let total = 0;
    for (const item of items) {
      if (!hasPrefix(item.bytes, target, position)) continue;
      const byte = item.bytes.length === position ? EOT_BYTE : item.bytes[position]!;
      masses.set(byte, (masses.get(byte) ?? 0) + item.prob);
      total += item.prob;
    }
    positions.push({
      target: position === target.length ? EOT_BYTE : target[position]!,
      dist: toSortedDistribution(masses, total),
      coverage: knownMass > 0 ? total / knownMass : 0,
    });
  }
  return positions;
}

/**
 * Probabilidad de cada etiqueta a partir de la distribución del primer byte (exacta en ambos
 * métodos, §2.1), independiente del tokenizador del teacher. Las etiquetas deben empezar por
 * bytes distintos (p. ej. "A"/"B"). Se usa para etiquetas blandas al destilar un router Laya.
 */
export function firstByteLabelDistribution(
  candidates: readonly TokenCandidate[],
  labels: readonly string[],
): Record<string, number> {
  const firstBytes = labels.map((label) => tokenBytes(label)[0]);
  if (firstBytes.some((byte) => byte === undefined) || new Set(firstBytes).size !== labels.length) {
    throw new Error("byteLogits: las etiquetas deben ser no vacías y empezar por bytes distintos");
  }
  const masses = new Map<number, number>();
  for (const candidate of candidates) {
    // Los espacios iniciales de tokens tipo " A" no cambian la etiqueta elegida.
    const bytes = candidate.bytes.filter((byte, index) => index > 0 || byte !== 0x20);
    const byte = bytes[0] ?? candidate.bytes[0];
    if (byte === undefined || !Number.isFinite(candidate.logprob)) continue;
    masses.set(byte, (masses.get(byte) ?? 0) + Math.exp(candidate.logprob));
  }
  const labelMass = firstBytes.map((byte) => masses.get(byte!) ?? 0);
  const total = labelMass.reduce((sum, mass) => sum + mass, 0);
  return Object.fromEntries(
    labels.map((label, index) => [
      label,
      total > 0 ? labelMass[index]! / total : 1 / labels.length,
    ]),
  );
}

/**
 * Superficie pública de Sunsam Mesh. Otros módulos sólo importan desde aquí.
 * Semántica e invariantes: ver CONTRACT.md y SPEC.md.
 */
export type { MeshConfig, PeerConfig, Tier } from "./domain/config.js";
export { DEFAULT_MESH_CONFIG, parseMeshConfig } from "./domain/config.js";
export type { ApiFormat } from "./domain/requestShape.js";
export type { BytePosition, ByteDistribution, TokenCandidate } from "./domain/byteLogits.js";
export {
  EOT_BYTE,
  endOfTokenByteDistributions,
  firstByteLabelDistribution,
  marginalizeItByteDistributions,
} from "./domain/byteLogits.js";
export { bitsPerByte, bytesPerSecond } from "./domain/bitsPerByte.js";
export { VIRTUAL_MODELS } from "./domain/routing.js";
export type { MeshHandle } from "./adapters/startMesh.js";
export { startMesh } from "./adapters/startMesh.js";

/** Puerto mínimo que expone un nodo en ejecución. */
export interface SunsamMeshPort {
  listModels(): string[];
  recordFeedback(decisionId: string, localSufficient: boolean): Promise<boolean>;
}

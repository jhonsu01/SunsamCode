/**
 * Una ronda de sondas de salud y BPB. El intervalo lo programa el adapter de arranque; aquí sólo se
 * decide qué sondear y se publican los hechos en `PeerRegistry`.
 */
import type { PeerRegistry } from "./peerRegistry.js";
import type { MeshLogger, PeerTransport } from "./ports.js";

/**
 * Texto de calibración fijo (código + prosa, ES/EN). Al ser el mismo para todos los peers, su BPB es
 * comparable entre modelos con tokenizadores distintos (arXiv 2609.12303).
 */
const BPB_CALIBRATION_TEXT = [
  "def fibonacci(n: int) -> int:",
  '    """Return the n-th Fibonacci number iteratively."""',
  "    a, b = 0, 1",
  "    for _ in range(n):",
  "        a, b = b, a + b",
  "    return a",
  "",
  "El enrutador decide si una petición puede resolverse con un modelo local pequeño o si necesita",
  "un modelo grande en la red. Una métrica por byte permite comparar modelos con tokenizadores distintos.",
].join("\n");

export class HealthMonitor {
  private rounds = 0;

  constructor(
    private readonly registry: PeerRegistry,
    private readonly transport: PeerTransport,
    private readonly logger: MeshLogger,
    private readonly bpbEveryRounds = 20,
  ) {}

  async runRound(): Promise<void> {
    const probeBpb = this.rounds % this.bpbEveryRounds === 0;
    this.rounds += 1;
    await Promise.all(
      this.registry.views().map(async (peer) => {
        const healthy = await this.transport.probeHealth(peer.config).catch(() => false);
        this.registry.recordHealth(peer.config.id, healthy);
        if (!healthy || !probeBpb || !peer.config.bpbProbe) return;
        try {
          const bpb = await this.transport.probeBitsPerByte(peer.config, BPB_CALIBRATION_TEXT);
          if (bpb !== null) {
            this.registry.recordBitsPerByte(peer.config.id, bpb);
            this.logger.info("BPB medido", { peer: peer.config.id, bpb: Number(bpb.toFixed(4)) });
          }
        } catch (error) {
          this.logger.debug("sonda BPB no soportada", {
            peer: peer.config.id,
            error: String(error),
          });
        }
      }),
    );
  }
}

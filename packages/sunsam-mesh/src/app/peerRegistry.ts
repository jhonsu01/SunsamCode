/**
 * Único propietario del estado de peers. Los demás componentes sólo leen `views()` y envían
 * hechos (inicio/fin de petición, resultado de sondas, beacons LAN).
 */
import { ewma } from "../domain/bitsPerByte.js";
import type { PeerConfig } from "../domain/config.js";
import type { PeerRuntimeView } from "../domain/routing.js";
import type { Clock } from "./ports.js";

interface PeerState extends PeerRuntimeView {
  /** Peers descubiertos por LAN caducan si dejan de anunciarse. */
  expiresAt?: number;
  lastError?: string;
}

interface PeerStatus extends PeerRuntimeView {
  lastError?: string;
  discovered: boolean;
}

export class PeerRegistry {
  private readonly peers = new Map<string, PeerState>();

  constructor(
    staticPeers: readonly PeerConfig[],
    private readonly clock: Clock,
  ) {
    for (const config of staticPeers) {
      this.peers.set(config.id, { config, healthy: true, inflight: 0 });
    }
  }

  views(): PeerRuntimeView[] {
    this.evictExpired();
    return [...this.peers.values()];
  }

  status(): PeerStatus[] {
    return this.views().map((peer) => ({
      ...peer,
      config: { ...peer.config, apiKey: peer.config.apiKey ? "***" : undefined },
      discovered: (peer as PeerState).expiresAt !== undefined,
    }));
  }

  get(peerId: string): PeerConfig | undefined {
    return this.peers.get(peerId)?.config;
  }

  ids(): Set<string> {
    return new Set(this.views().map((peer) => peer.config.id));
  }

  /** Alta/refresco idempotente de un peer anunciado por LAN; no pisa peers estáticos. */
  upsertDiscovered(config: PeerConfig, ttlMs: number): void {
    const existing = this.peers.get(config.id);
    if (existing && existing.expiresAt === undefined) return;
    this.peers.set(config.id, {
      ...(existing ?? { healthy: true, inflight: 0 }),
      config,
      expiresAt: this.clock.now() + ttlMs,
    });
  }

  begin(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) peer.inflight += 1;
  }

  end(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) peer.inflight = Math.max(0, peer.inflight - 1);
  }

  recordSuccess(peerId: string, sample: { ttftMs?: number; bytesPerSecond?: number | null }): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.healthy = true;
    peer.lastError = undefined;
    if (sample.ttftMs !== undefined) peer.ttftMs = ewma(peer.ttftMs, sample.ttftMs);
    if (sample.bytesPerSecond)
      peer.bytesPerSecond = ewma(peer.bytesPerSecond, sample.bytesPerSecond);
  }

  recordFailure(peerId: string, error: string): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.healthy = false;
    peer.lastError = error;
  }

  recordHealth(peerId: string, healthy: boolean): void {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.healthy = healthy;
    if (healthy) peer.lastError = undefined;
  }

  recordBitsPerByte(peerId: string, bpb: number): void {
    const peer = this.peers.get(peerId);
    if (peer) peer.bpb = bpb;
  }

  private evictExpired(): void {
    const now = this.clock.now();
    for (const [id, peer] of this.peers) {
      if (peer.expiresAt !== undefined && peer.expiresAt < now) this.peers.delete(id);
    }
  }
}

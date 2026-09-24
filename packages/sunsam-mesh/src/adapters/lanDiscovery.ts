/**
 * Descubrimiento P2P en LAN: cada nodo anuncia por broadcast UDP qué tiers sirve. Los beacons van
 * firmados con HMAC-SHA256 (secreto compartido de la mesh) y con marca de tiempo (±30 s) para
 * descartar nodos ajenos y repeticiones antiguas.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { createSocket, type Socket } from "node:dgram";
import { networkInterfaces } from "node:os";
import type { PeerRegistry } from "../app/peerRegistry.js";
import type { Clock, MeshLogger } from "../app/ports.js";
import type { MeshConfig, PeerConfig, Tier } from "../domain/config.js";
import { VIRTUAL_MODELS } from "../domain/routing.js";

const MAX_SKEW_MS = 30_000;

interface BeaconPayload {
  v: 1;
  nodeId: string;
  url: string;
  tiers: Tier[];
  ts: number;
}

/** Token de gateway que aceptan todos los nodos de la misma mesh (derivado del secreto). */
export function meshGatewayToken(sharedSecret: string): string {
  return createHmac("sha256", sharedSecret).update("sunsam-mesh-gateway").digest("hex");
}

export function signBeacon(payload: BeaconPayload, secret: string): string {
  const body = JSON.stringify(payload);
  const sig = createHmac("sha256", secret).update(body).digest("hex");
  return JSON.stringify({ body, sig });
}

export function verifyBeacon(message: string, secret: string, now: number): BeaconPayload | null {
  try {
    const { body, sig } = JSON.parse(message) as { body?: unknown; sig?: unknown };
    if (typeof body !== "string" || typeof sig !== "string") return null;
    const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"), "hex");
    const received = Buffer.from(sig, "hex");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
    const payload = JSON.parse(body) as BeaconPayload;
    if (payload.v !== 1 || Math.abs(now - payload.ts) > MAX_SKEW_MS) return null;
    if (!/^https?:\/\//u.test(payload.url) || !Array.isArray(payload.tiers)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Un nodo remoto aparece como un peer `mesh` por tier, usando sus modelos virtuales. */
export function peersFromBeacon(payload: BeaconPayload, token: string): PeerConfig[] {
  return payload.tiers
    .filter((tier): tier is Tier => tier === "local" || tier === "swarm")
    .map((tier) => ({
      id: `${payload.nodeId}:${tier}`,
      baseUrl: payload.url,
      apiFormats: ["openai", "anthropic"],
      apiKey: token,
      tier,
      models: [tier === "local" ? VIRTUAL_MODELS.local : VIRTUAL_MODELS.swarm],
      kind: "mesh",
      bpbProbe: false,
      maxInflight: 8,
    }));
}

function firstLanAddress(): string {
  for (const addresses of Object.values(networkInterfaces())) {
    const ipv4 = addresses?.find((address) => address.family === "IPv4" && !address.internal);
    if (ipv4) return ipv4.address;
  }
  return "127.0.0.1";
}

export class LanDiscovery {
  private socket: Socket | null = null;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: MeshConfig,
    private readonly registry: PeerRegistry,
    private readonly clock: Clock,
    private readonly logger: MeshLogger,
  ) {}

  start(listeningPort: number): void {
    const { discovery, mesh } = this.config;
    const secret = discovery.sharedSecret!;
    const token = meshGatewayToken(secret);
    const url = discovery.advertiseUrl ?? `http://${firstLanAddress()}:${listeningPort}`;
    const socket = createSocket({ type: "udp4", reuseAddr: true });
    this.socket = socket;
    socket.on("message", (message) => {
      const payload = verifyBeacon(message.toString("utf8"), secret, this.clock.now());
      if (!payload || payload.nodeId === mesh.nodeId) return;
      for (const peer of peersFromBeacon(payload, token)) {
        this.registry.upsertDiscovered(peer, discovery.intervalMs * 3);
      }
    });
    socket.on("error", (error) =>
      this.logger.warn("discovery UDP error", { error: error.message }),
    );
    socket.bind(discovery.port, () => {
      socket.setBroadcast(true);
      this.logger.info("discovery LAN activo", { port: discovery.port, url });
    });
    const announce = () => {
      // Sólo se anuncian tiers servidos por peers directos: un nodo no re-anuncia peers mesh ajenos.
      const tiers = [
        ...new Set(
          this.registry
            .views()
            .filter((peer) => peer.config.kind === "direct")
            .map((peer) => peer.config.tier),
        ),
      ];
      if (tiers.length === 0) return;
      const beacon = signBeacon(
        { v: 1, nodeId: mesh.nodeId, url, tiers, ts: this.clock.now() },
        secret,
      );
      socket.send(beacon, discovery.port, "255.255.255.255");
    };
    this.timer = setInterval(announce, discovery.intervalMs);
    this.timer.unref();
    setTimeout(announce, 200).unref();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.socket?.close();
    this.socket = null;
  }
}

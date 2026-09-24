/**
 * Composición de Sunsam Mesh: crea los propietarios (registry, router, cola de feedback), conecta
 * adapters y programa las sondas. Devuelve un handle para parar todo de forma ordenada.
 */
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { FeedbackJobs } from "../app/feedbackJobs.js";
import { HealthMonitor } from "../app/healthMonitor.js";
import { HeuristicClassifier } from "../app/heuristicClassifier.js";
import { MeshRouter } from "../app/meshRouter.js";
import { PeerRegistry } from "../app/peerRegistry.js";
import type { Classifier, DatasetSink, MeshLogger, PeerTransport } from "../app/ports.js";
import { assertSafeServerBinding, type MeshConfig } from "../domain/config.js";
import { createGatewayServer } from "./httpGateway.js";
import { HttpPeerTransport } from "./httpPeerTransport.js";
import { JsonlDatasetSink } from "./jsonlSink.js";
import { LanDiscovery, meshGatewayToken } from "./lanDiscovery.js";
import { LayaClassifier } from "./layaClassifier.js";

interface MeshOverrides {
  transport?: PeerTransport;
  classifier?: Classifier;
  sink?: DatasetSink;
  random?: () => number;
  /** Desactiva sondas periódicas (tests). */
  disableHealthLoop?: boolean;
}

export interface MeshHandle {
  port: number;
  router: MeshRouter;
  registry: PeerRegistry;
  jobs: FeedbackJobs;
  close(): Promise<void>;
}

export async function startMesh(
  config: MeshConfig,
  logger: MeshLogger,
  overrides: MeshOverrides = {},
): Promise<MeshHandle> {
  assertSafeServerBinding(config);
  const clock = { now: () => Date.now() };
  const transport = overrides.transport ?? new HttpPeerTransport();
  const sink = overrides.sink ?? new JsonlDatasetSink(config.feedback.dataDir);
  const registry = new PeerRegistry(config.peers, clock);
  const classifier =
    overrides.classifier ??
    (config.router.classifier === "laya"
      ? new LayaClassifier(
          {
            ...config.router.laya,
            heuristicBias: config.router.heuristicBias,
            heuristicWeights: config.router.heuristicWeights,
          },
          logger,
        )
      : new HeuristicClassifier(config.router.heuristicBias, config.router.heuristicWeights));
  const jobs = new FeedbackJobs({
    config,
    registry,
    transport,
    sink,
    logger,
    random: { next: overrides.random ?? Math.random },
  });
  const router = new MeshRouter({
    config,
    registry,
    transport,
    classifier,
    jobs,
    sink,
    logger,
    clock,
    newId: randomUUID,
  });

  const acceptedKeys = [
    ...(config.server.apiKey ? [config.server.apiKey] : []),
    ...(config.discovery.enabled && config.discovery.sharedSecret
      ? [meshGatewayToken(config.discovery.sharedSecret)]
      : []),
  ];
  const server = createGatewayServer({
    router,
    registry,
    jobs,
    logger,
    acceptedKeys,
    nodeId: config.mesh.nodeId,
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.server.port, config.server.host, () => resolve());
  });
  const port = (server.address() as AddressInfo).port;

  const monitor = new HealthMonitor(registry, transport, logger);
  let healthTimer: NodeJS.Timeout | null = null;
  if (!overrides.disableHealthLoop) {
    const runRound = () =>
      void monitor
        .runRound()
        .catch((error: unknown) => logger.warn("ronda de salud falló", { error: String(error) }));
    runRound();
    healthTimer = setInterval(runRound, config.health.intervalMs);
    healthTimer.unref();
  }

  const discovery = config.discovery.enabled
    ? new LanDiscovery(config, registry, clock, logger)
    : null;
  discovery?.start(port);

  logger.info("Sunsam Mesh escuchando", {
    url: `http://${config.server.host}:${port}`,
    peers: config.peers.map((peer) => `${peer.id}(${peer.tier})`),
    classifier: config.router.classifier,
    threshold: config.router.threshold,
  });

  return {
    port,
    router,
    registry,
    jobs,
    async close() {
      if (healthTimer) clearInterval(healthTimer);
      discovery?.stop();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      server.closeAllConnections?.();
      await jobs.idle();
    },
  };
}
